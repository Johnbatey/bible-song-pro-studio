const crypto = require('crypto');
const WebSocket = require('ws');

// obs-websocket v5 opcodes
const OP = { HELLO: 0, IDENTIFY: 1, IDENTIFIED: 2, REIDENTIFY: 3, EVENT: 5, REQUEST: 6, REQUEST_RESPONSE: 7 };

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 15000;
const MAX_RECONNECT_ATTEMPTS = 5;
const REQUEST_TIMEOUT_MS = 8000;

/**
 * OBS Studio control over obs-websocket v5, spoken directly on the existing `ws`
 * dependency rather than pulling in another client library.
 *
 * Auth is OBS's challenge/salt scheme: base64(sha256(base64(sha256(password + salt)) + challenge)).
 */
function createObsService({ emit }) {
  let socket = null;
  let connected = false;
  let identified = false;
  let closingIntentionally = false;

  let url = 'ws://127.0.0.1:4455';
  let password = '';
  let reconnectAttempts = 0;
  let reconnectTimer = null;
  let requestId = 0;
  const pending = new Map();

  let currentScene = '';
  let scenes = [];
  let streaming = false;
  let recording = false;
  let lastError = '';
  let obsVersion = '';

  function status() {
    return {
      ok: true,
      connected, identified,
      url,
      hasPassword: Boolean(password),
      currentScene, scenes,
      streaming, recording,
      obsVersion,
      reconnectAttempts,
      lastError,
    };
  }

  function push() {
    emit?.({ type: 'obs:status', status: status() });
  }

  function authHash(pass, salt, challenge) {
    const secret = crypto.createHash('sha256').update(pass + salt).digest('base64');
    return crypto.createHash('sha256').update(secret + challenge).digest('base64');
  }

  function send(op, d) {
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify({ op, d }));
    return true;
  }

  /** Requests resolve on their matching REQUEST_RESPONSE, or reject on timeout. */
  function request(requestType, requestData) {
    return new Promise((resolve, reject) => {
      if (!identified) { reject(new Error('Not connected to OBS')); return; }
      const id = String(++requestId);
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`OBS request timed out: ${requestType}`));
      }, REQUEST_TIMEOUT_MS);
      pending.set(id, { resolve, reject, timer });
      send(OP.REQUEST, { requestType, requestId: id, requestData: requestData || {} });
    });
  }

  async function refreshState() {
    try {
      const sceneList = await request('GetSceneList');
      scenes = (sceneList.scenes || []).map((s) => s.sceneName).reverse(); // OBS lists bottom-up
      currentScene = sceneList.currentProgramSceneName || '';
      const streamStatus = await request('GetStreamStatus').catch(() => null);
      if (streamStatus) streaming = Boolean(streamStatus.outputActive);
      const recordStatus = await request('GetRecordStatus').catch(() => null);
      if (recordStatus) recording = Boolean(recordStatus.outputActive);
      push();
    } catch (err) {
      lastError = err.message;
      push();
    }
  }

  function handleMessage(raw) {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.op === OP.HELLO) {
      const auth = msg.d?.authentication;
      const payload = { rpcVersion: msg.d?.rpcVersion || 1, eventSubscriptions: 0x7ff };
      if (auth) {
        if (!password) {
          lastError = 'OBS requires a password — set one in Settings → Streaming.';
          push();
          closingIntentionally = true;
          socket?.close();
          return;
        }
        payload.authentication = authHash(password, auth.salt, auth.challenge);
      }
      send(OP.IDENTIFY, payload);
      return;
    }

    if (msg.op === OP.IDENTIFIED) {
      identified = true;
      reconnectAttempts = 0;
      lastError = '';
      request('GetVersion').then((v) => { obsVersion = v.obsVersion || ''; push(); }).catch(() => {});
      refreshState();
      push();
      return;
    }

    if (msg.op === OP.REQUEST_RESPONSE) {
      const entry = pending.get(msg.d?.requestId);
      if (!entry) return;
      pending.delete(msg.d.requestId);
      clearTimeout(entry.timer);
      if (msg.d?.requestStatus?.result) entry.resolve(msg.d.responseData || {});
      else entry.reject(new Error(msg.d?.requestStatus?.comment || 'OBS request failed'));
      return;
    }

    if (msg.op === OP.EVENT) {
      const { eventType, eventData } = msg.d || {};
      if (eventType === 'CurrentProgramSceneChanged') { currentScene = eventData?.sceneName || ''; push(); }
      else if (eventType === 'SceneListChanged') { refreshState(); }
      else if (eventType === 'StreamStateChanged') { streaming = Boolean(eventData?.outputActive); push(); }
      else if (eventType === 'RecordStateChanged') { recording = Boolean(eventData?.outputActive); push(); }
    }
  }

  function scheduleReconnect(reason) {
    if (closingIntentionally) return;
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      lastError = `Could not reach OBS after ${reconnectAttempts} attempts (${reason}). Is obs-websocket enabled?`;
      push();
      return;
    }
    reconnectAttempts += 1;
    const delay = Math.min(RECONNECT_BASE_MS * Math.pow(2, reconnectAttempts - 1), RECONNECT_MAX_MS);
    reconnectTimer = setTimeout(() => connect({}), delay);
  }

  function connect(payload = {}) {
    if (payload.url) url = payload.url;
    if (typeof payload.password === 'string') password = payload.password;

    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
      return { ok: true, alreadyConnected: true, status: status() };
    }
    closingIntentionally = false;
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }

    try {
      socket = new WebSocket(url, { handshakeTimeout: 5000 });
    } catch (err) {
      lastError = err.message;
      push();
      return { ok: false, error: lastError, status: status() };
    }

    socket.on('open', () => { connected = true; lastError = ''; push(); });
    socket.on('message', (data) => handleMessage(data.toString()));
    socket.on('error', (err) => { lastError = err.message; push(); });
    socket.on('close', () => {
      connected = false;
      identified = false;
      socket = null;
      pending.forEach((entry) => { clearTimeout(entry.timer); entry.reject(new Error('OBS disconnected')); });
      pending.clear();
      push();
      if (!closingIntentionally) scheduleReconnect('socket closed');
    });

    return { ok: true, status: status() };
  }

  function disconnect() {
    closingIntentionally = true;
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    reconnectAttempts = 0;
    if (socket) { try { socket.close(); } catch { /* already closed */ } }
    connected = false;
    identified = false;
    push();
    return { ok: true, status: status() };
  }

  const setScene = (name) => request('SetCurrentProgramScene', { sceneName: name })
    .then(() => ({ ok: true })).catch((err) => ({ ok: false, error: err.message }));

  const toggleStream = () => request('ToggleStream')
    .then((d) => ({ ok: true, active: d.outputActive })).catch((err) => ({ ok: false, error: err.message }));

  const toggleRecord = () => request('ToggleRecord')
    .then((d) => ({ ok: true, active: d.outputActive })).catch((err) => ({ ok: false, error: err.message }));

  function destroy() {
    disconnect();
    return { ok: true };
  }

  return { connect, disconnect, status, setScene, toggleStream, toggleRecord, refreshState, destroy };
}

module.exports = { createObsService };
