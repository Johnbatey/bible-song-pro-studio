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
        label: d.label || `Audio Output ${index + 1} (${d.deviceId.slice(0, 8)})`,
      }));
  } catch (err) {
    console.warn('[AudioOutput] Could not enumerate audio output devices:', err);
    return [];
  }
}

/**
 * Attach audio sink ID (setSinkId) to an HTML media element (video or audio).
 */
export async function attachAudioOutputSink(
  element: HTMLMediaElement | null,
  deviceId?: string
): Promise<boolean> {
  if (!element) return false;
  const targetId = deviceId || 'default';
  
  try {
    // Check if setSinkId is supported on HTMLMediaElement in Chromium
    if (typeof (element as any).setSinkId === 'function') {
      await (element as any).setSinkId(targetId);
      return true;
    }
  } catch (err) {
    console.warn(`[AudioOutput] Failed to set sinkId to ${targetId}:`, err);
  }
  return false;
}
