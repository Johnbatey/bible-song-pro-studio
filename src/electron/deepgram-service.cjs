const { createClient, LiveTranscriptionEvents } = require('@deepgram/sdk');

const SAMPLE_RATE = 16000;
const MAX_RECONNECT_ATTEMPTS = 6;
const MAX_HANDSHAKE_FAILURES = 3;
const STALL_TIMEOUT_MS = 15000;
const HANDSHAKE_TIMEOUT_MS = 10000;
const BACKOFF_BASE_MS = 500;
const BACKOFF_MAX_MS = 10000;

/**
 * Streaming speech-to-text over Deepgram's live websocket.
 *
 * The failure handling here is the point: a flaky network during a service must not
 * turn into an infinite reconnect loop, and "connected but silent" has to be
 * distinguishable from "nobody is speaking". So we track handshake failures separately
 * from drops, and watch for audio going out with nothing coming back.
 */
function createDeepgramService({ emit }) {
  let connection = null;
  let running = false;
  let closingIntentionally = false;

  let apiKey = '';
  let model = 'nova-2';
  let language = 'en';

  let reconnectAttempts = 0;
  let handshakeFailures = 0;
  let everConnected = false;
  let reconnectTimer = null;
  let stallTimer = null;
  let connectTimer = null;
  // One connection must produce at most one failure, however many events the SDK emits
  // for it (a rejected handshake can raise Error, Close, both, or neither). Keyed by
  // generation rather than a flag so a drop *after* a successful connect still retries.
  let generation = 0;
  let settledGeneration = -1;

  let bytesSent = 0;
  let bytesSinceLastResult = 0;
  let lastResultAt = 0;
  let lastError = '';
  let state = 'idle'; // idle | connecting | live | reconnecting | stalled | error

  function setState(next, detail) {
    state = next;
    emit?.({ type: 'state', state: next, detail: detail || '', status: status() });
  }

  function status() {
    return {
      ok: true,
      provider: 'deepgram',
      state,
      running,
      configured: Boolean(apiKey),
      model,
      language,
      sampleRate: SAMPLE_RATE,
      bytesSent,
      lastResultAt,
      reconnectAttempts,
      handshakeFailures,
      lastError,
    };
  }

  function clearTimers() {
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    if (stallTimer) { clearInterval(stallTimer); stallTimer = null; }
    if (connectTimer) { clearTimeout(connectTimer); connectTimer = null; }
  }

  /**
   * Single funnel for "this connection attempt did not survive". The SDK does not
   * guarantee a Close after a failed handshake — a bad key surfaces only as Error —
   * so without this the service would sit in `connecting` forever.
   */
  function failAttempt(reason) {
    if (settledGeneration === generation) return;
    settledGeneration = generation;
    if (connectTimer) { clearTimeout(connectTimer); connectTimer = null; }
    if (!everConnected) handshakeFailures += 1;
    if (connection) {
      try { connection.requestClose(); } catch { /* already gone */ }
      connection = null;
    }
    scheduleReconnect(reason);
  }

  /**
   * Audio is flowing but Deepgram has returned nothing for a while — usually a
   * half-open socket. Pause instead of reconnecting forever, and say why.
   */
  function startStallWatch() {
    if (stallTimer) clearInterval(stallTimer);
    stallTimer = setInterval(() => {
      if (!running || state !== 'live') return;
      const quietFor = Date.now() - lastResultAt;
      if (bytesSinceLastResult > SAMPLE_RATE * 2 * 5 && quietFor > STALL_TIMEOUT_MS) {
        lastError = 'Audio is reaching the app but no transcripts are coming back. Live transcription paused.';
        setState('stalled', lastError);
        stop({ keepConfig: true });
      }
    }, 2000);
  }

  function scheduleReconnect(reason) {
    if (!running || closingIntentionally) return;

    // Never connected + repeated handshake rejections almost always means a bad key.
    // Retrying that is pointless and burns quota.
    if (!everConnected && handshakeFailures >= MAX_HANDSHAKE_FAILURES) {
      lastError = `Could not connect to Deepgram after ${handshakeFailures} attempts — check the API key. (${reason})`;
      setState('error', lastError);
      running = false;
      clearTimers();
      return;
    }
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      lastError = `Gave up reconnecting to Deepgram after ${reconnectAttempts} attempts. (${reason})`;
      setState('error', lastError);
      running = false;
      clearTimers();
      return;
    }

    reconnectAttempts += 1;
    const delay = Math.min(BACKOFF_BASE_MS * Math.pow(2, reconnectAttempts - 1), BACKOFF_MAX_MS);
    setState('reconnecting', `attempt ${reconnectAttempts} in ${delay}ms — ${reason}`);
    reconnectTimer = setTimeout(() => { openConnection(); }, delay);
  }

  let pendingAudioQueue = [];

  function openConnection() {
    if (!apiKey) {
      lastError = 'Deepgram API key is not set (Settings → Transcription).';
      setState('error', lastError);
      running = false;
      return;
    }

    try {
      setState('connecting');
      generation += 1;
      if (connectTimer) clearTimeout(connectTimer);
      connectTimer = setTimeout(() => failAttempt('handshake timed out'), HANDSHAKE_TIMEOUT_MS);

      const client = createClient(apiKey);
      connection = client.listen.live({
        model: model || 'nova-2',
        language: language || 'en',
        encoding: 'linear16',
        sample_rate: SAMPLE_RATE,
        channels: 1,
        punctuate: true,
        smart_format: true,
        interim_results: true,
        endpointing: 250,
        vad_events: true,
        utterance_end_ms: 1000,
        keywords: [
          'Genesis:2.5', 'Exodus:2.5', 'Leviticus:2.5', 'Numbers:2.5', 'Deuteronomy:2.5',
          'Joshua:2.5', 'Judges:2.5', 'Ruth:2.5', 'Samuel:2.5', 'Kings:2.5',
          'Chronicles:2.5', 'Ezra:2.5', 'Nehemiah:2.5', 'Esther:2.5', 'Job:2.5',
          'Psalms:2.5', 'Proverbs:2.5', 'Ecclesiastes:2.5', 'Song of Solomon:2.5',
          'Isaiah:2.5', 'Jeremiah:2.5', 'Lamentations:2.5', 'Ezekiel:2.5', 'Daniel:2.5',
          'Hosea:2.5', 'Joel:2.5', 'Amos:2.5', 'Obadiah:2.5', 'Jonah:2.5',
          'Micah:2.5', 'Nahum:2.5', 'Habakkuk:2.5', 'Zephaniah:2.5', 'Haggai:2.5',
          'Zechariah:2.5', 'Malachi:2.5', 'Matthew:2.5', 'Mark:2.5', 'Luke:2.5',
          'John:2.5', 'Acts:2.5', 'Romans:2.5', 'Corinthians:2.5', 'Galatians:2.5',
          'Ephesians:2.5', 'Philippians:2.5', 'Colossians:2.5', 'Thessalonians:2.5',
          'Timothy:2.5', 'Titus:2.5', 'Philemon:2.5', 'Hebrews:2.5', 'James:2.5',
          'Peter:2.5', 'Jude:2.5', 'Revelation:2.5', 'Chapter:2.0', 'Verse:2.0',
          'Scripture:2.0', 'Bible:2.0', 'Hallelujah:1.8', 'Amen:1.8',
        ],
      });

      connection.on(LiveTranscriptionEvents.Open, () => {
        if (connectTimer) { clearTimeout(connectTimer); connectTimer = null; }
        everConnected = true;
        reconnectAttempts = 0;
        handshakeFailures = 0;
        lastError = '';
        lastResultAt = Date.now();
        bytesSinceLastResult = 0;
        setState('live');
        startStallWatch();

        // Flush any audio chunks captured while establishing the connection
        if (pendingAudioQueue.length > 0) {
          const queue = pendingAudioQueue;
          pendingAudioQueue = [];
          for (const buf of queue) {
            try {
              connection.send(buf);
              bytesSent += buf.length;
              bytesSinceLastResult += buf.length;
            } catch (_) {}
          }
        }
      });

      connection.on(LiveTranscriptionEvents.Transcript, (data) => {
        const alt = data?.channel?.alternatives?.[0];
        const text = alt?.transcript || '';
        lastResultAt = Date.now();
        bytesSinceLastResult = 0;
        if (!text) return;
        emit?.({
          type: 'transcript',
          text,
          isFinal: Boolean(data.is_final),
          speechFinal: Boolean(data.speech_final),
          confidence: typeof alt?.confidence === 'number' ? alt.confidence : 0,
        });
      });

      connection.on(LiveTranscriptionEvents.UtteranceEnd, () => {
        emit?.({ type: 'utterance-end' });
      });

      connection.on(LiveTranscriptionEvents.Metadata, () => {
        lastResultAt = Date.now();
        bytesSinceLastResult = 0;
      });

      connection.on(LiveTranscriptionEvents.Error, (err) => {
        lastError = err?.message || String(err);
        emit?.({ type: 'error', error: lastError });
        if (running && !closingIntentionally) failAttempt(lastError);
      });

      connection.on(LiveTranscriptionEvents.Close, (event) => {
        connection = null;
        pendingAudioQueue = [];
        if (closingIntentionally || !running) { setState('idle'); return; }
        failAttempt(`socket closed${event?.code ? ' code=' + event.code : ''}`);
      });
    } catch (err) {
      lastError = err?.message || String(err);
      failAttempt(lastError);
    }
  }

  function configure(payload = {}) {
    if (typeof payload.apiKey === 'string' && payload.apiKey) apiKey = payload.apiKey;
    if (payload.model) model = payload.model;
    if (payload.language) language = payload.language;
    return status();
  }

  function start(payload = {}) {
    if (running) return { ok: true, alreadyRunning: true, status: status() };
    configure(payload);
    if (!apiKey) {
      lastError = 'Deepgram API key is not set (Settings → Transcription).';
      setState('error', lastError);
      return { ok: false, error: lastError, status: status() };
    }
    running = true;
    closingIntentionally = false;
    everConnected = false;
    reconnectAttempts = 0;
    handshakeFailures = 0;
    bytesSent = 0;
    bytesSinceLastResult = 0;
    lastError = '';
    pendingAudioQueue = [];
    openConnection();
    return { ok: true, status: status() };
  }

  /** `chunk` is 16 kHz mono signed 16-bit PCM. */
  function sendAudio(chunk) {
    if (!running) return false;
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    if (state === 'connecting') {
      // Buffer up to 4 seconds of audio while handshake completes
      if (pendingAudioQueue.length < 60) {
        pendingAudioQueue.push(buffer);
      }
      return true;
    }
    if (!connection || state !== 'live') return false;
    try {
      connection.send(buffer);
      bytesSent += buffer.length;
      bytesSinceLastResult += buffer.length;
      return true;
    } catch (err) {
      lastError = err?.message || String(err);
      emit?.({ type: 'error', error: lastError });
      return false;
    }
  }

  function stop(opts = {}) {
    closingIntentionally = true;
    running = false;
    pendingAudioQueue = [];
    clearTimers();
    if (connection) {
      try { connection.requestClose(); } catch { /* already gone */ }
      connection = null;
    }
    if (!opts.keepConfig) lastError = '';
    if (state !== 'stalled' && state !== 'error') setState('idle');
    return { ok: true, status: status() };
  }

  function destroy() {
    stop();
    return { ok: true };
  }

  return { configure, start, sendAudio, stop, status, destroy };
}

module.exports = { createDeepgramService, SAMPLE_RATE };
