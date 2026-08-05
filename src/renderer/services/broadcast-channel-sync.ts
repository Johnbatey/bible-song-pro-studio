const CHANNEL_NAME = 'bsp-display-sync';

type SyncHandler = (payload: Record<string, unknown>) => void;

let channel: BroadcastChannel | null = null;
const listeners = new Set<SyncHandler>();
let initialized = false;

export function startBroadcastChannelSync() {
  if (initialized) return;
  initialized = true;

  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
  } catch {
    console.warn('BroadcastChannel not available — cross-window sync disabled');
    return;
  }

  channel.addEventListener('message', (event) => {
    const data = event.data;
    if (!data || typeof data !== 'object') return;

    for (const handler of listeners) {
      try {
        handler(data as Record<string, unknown>);
      } catch {
        /* isolate listener errors */
      }
    }
  });
}

export function onBroadcastMessage(handler: SyncHandler) {
  listeners.add(handler);
  return () => listeners.delete(handler);
}

export function sendBroadcastState(payload: Record<string, unknown>) {
  if (!channel) return;
  try {
    const msg = { __bspDisplayState: true, payload, atMs: Date.now() };
    channel.postMessage(msg);
  } catch {
    /* channel may be closed */
  }
}

export function stopBroadcastChannelSync() {
  if (channel) {
    channel.close();
    channel = null;
  }
  listeners.clear();
  initialized = false;
}
