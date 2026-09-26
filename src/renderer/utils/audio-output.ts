import type { AudioOutputDevice } from '../types';

/**
 * Enumerate all available audio output devices (HDMI, Dante, Sound Desk, Headphone jack, USB Audio).
 */
export async function getAudioOutputDevices(): Promise<AudioOutputDevice[]> {
  try {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter((d) => d.kind === 'audiooutput')
      .map((d, index) => ({
        deviceId: d.deviceId,
        label: d.label || `Audio Output ${index + 1} (${d.deviceId ? d.deviceId.slice(0, 8) : 'default'})`,
      }));
  } catch (err) {
    console.warn('[AudioOutput] Could not enumerate audio output devices:', err);
    return [];
  }
}

/**
 * Check if a specific audio device ID exists among active system devices.
 */
export async function isAudioOutputDeviceAvailable(deviceId?: string): Promise<boolean> {
  if (!deviceId || deviceId === 'default' || deviceId === '') return true;
  try {
    const devices = await getAudioOutputDevices();
    return devices.some((d) => d.deviceId === deviceId);
  } catch {
    return false;
  }
}

/**
 * Resolves a requested device ID against active devices; if disconnected/stale, falls back to 'default'.
 */
export function resolveValidAudioDeviceId(
  requestedId?: string,
  availableDevices?: AudioOutputDevice[]
): string {
  if (!requestedId || requestedId === 'default' || requestedId === '') {
    return 'default';
  }
  if (!availableDevices || availableDevices.length === 0) {
    return requestedId;
  }
  const match = availableDevices.some((d) => d.deviceId === requestedId);
  return match ? requestedId : 'default';
}

/**
 * Attach audio sink ID (setSinkId) to an HTML media element (video or audio)
 * with automatic validation and seamless fallback to system default if unavailable.
 */
export async function attachAudioOutputSink(
  element: HTMLMediaElement | null,
  deviceId?: string
): Promise<boolean> {
  if (!element) return false;
  const targetId = deviceId || 'default';

  // Check if setSinkId is supported on HTMLMediaElement in Chromium
  if (typeof (element as any).setSinkId !== 'function') {
    return false;
  }

  try {
    await (element as any).setSinkId(targetId);
    return true;
  } catch (err) {
    console.warn(`[AudioOutput] Failed to set sinkId to "${targetId}", falling back to default device:`, err);
    if (targetId !== 'default' && targetId !== '') {
      try {
        await (element as any).setSinkId('');
        return true;
      } catch (fallbackErr) {
        console.warn('[AudioOutput] Fallback to default sinkId also failed:', fallbackErr);
      }
    }
  }
  return false;
}

/**
 * Route an AudioContext sink to a specific device with safe default fallback.
 */
export async function routeAudioContextSink(
  ctx: AudioContext | null | undefined,
  deviceId?: string
): Promise<boolean> {
  if (!ctx || typeof (ctx as any).setSinkId !== 'function') return false;
  const targetId = deviceId || 'default';

  try {
    await (ctx as any).setSinkId(targetId);
    return true;
  } catch (err) {
    console.warn(`[AudioOutput] Failed to route AudioContext to "${targetId}", attempting fallback:`, err);
    if (targetId !== 'default' && targetId !== '') {
      try {
        await (ctx as any).setSinkId('default');
        return true;
      } catch (_) {}
    }
  }
  return false;
}

/**
 * Subscribe to hardware audio device plug/unplug changes.
 * Returns an unsubscription cleanup function.
 */
export function subscribeAudioDeviceChanges(callback: () => void): () => void {
  const media = typeof navigator !== 'undefined' ? navigator.mediaDevices : null;
  if (!media?.addEventListener) return () => {};

  const handler = () => {
    try {
      callback();
    } catch (err) {
      console.warn('[AudioOutput] Error during devicechange callback:', err);
    }
  };

  media.addEventListener('devicechange', handler);
  return () => {
    media.removeEventListener('devicechange', handler);
  };
}
