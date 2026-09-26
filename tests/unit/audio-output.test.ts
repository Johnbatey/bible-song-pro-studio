import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getAudioOutputDevices,
  isAudioOutputDeviceAvailable,
  resolveValidAudioDeviceId,
  attachAudioOutputSink,
  routeAudioContextSink,
  subscribeAudioDeviceChanges,
} from '../../src/renderer/utils/audio-output';

describe('Cross-Platform Audio Device Routing & Fallback System', () => {
  const mockDevices = [
    { deviceId: 'default', kind: 'audiooutput', label: 'Default Output' },
    { deviceId: 'usb-dac-1', kind: 'audiooutput', label: 'USB Sound Card' },
    { deviceId: 'hdmi-out-2', kind: 'audiooutput', label: 'HDMI Sanctuary Display Audio' },
    { deviceId: 'mic-1', kind: 'audioinput', label: 'Pulpit Mic' },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        enumerateDevices: vi.fn().mockResolvedValue(mockDevices),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
      configurable: true,
      writable: true,
    });
  });

  describe('getAudioOutputDevices', () => {
    it('enumerates only audiooutput devices and formats device information', async () => {
      const outputs = await getAudioOutputDevices();
      expect(outputs).toHaveLength(3);
      expect(outputs.map((d) => d.deviceId)).toEqual(['default', 'usb-dac-1', 'hdmi-out-2']);
      expect(outputs[1].label).toBe('USB Sound Card');
    });

    it('handles environments where mediaDevices is unavailable', async () => {
      Object.defineProperty(navigator, 'mediaDevices', {
        value: undefined,
        configurable: true,
        writable: true,
      });
      const outputs = await getAudioOutputDevices();
      expect(outputs).toEqual([]);
    });
  });

  describe('isAudioOutputDeviceAvailable', () => {
    it('returns true for default, empty or present device IDs', async () => {
      expect(await isAudioOutputDeviceAvailable('default')).toBe(true);
      expect(await isAudioOutputDeviceAvailable('')).toBe(true);
      expect(await isAudioOutputDeviceAvailable('usb-dac-1')).toBe(true);
    });

    it('returns false for disconnected or stale device IDs', async () => {
      expect(await isAudioOutputDeviceAvailable('disconnected-bluetooth-headset')).toBe(false);
    });
  });

  describe('resolveValidAudioDeviceId', () => {
    const activeDevices = [
      { deviceId: 'device-1', label: 'Main Output' },
      { deviceId: 'device-2', label: 'Headphones' },
    ];

    it('resolves active device IDs correctly', () => {
      expect(resolveValidAudioDeviceId('device-1', activeDevices)).toBe('device-1');
      expect(resolveValidAudioDeviceId('device-2', activeDevices)).toBe('device-2');
    });

    it('falls back to default if device is disconnected or missing from active devices', () => {
      expect(resolveValidAudioDeviceId('stale-device-99', activeDevices)).toBe('default');
      expect(resolveValidAudioDeviceId(undefined, activeDevices)).toBe('default');
      expect(resolveValidAudioDeviceId('', activeDevices)).toBe('default');
    });
  });

  describe('attachAudioOutputSink', () => {
    it('returns false if media element is null or setSinkId is not supported', async () => {
      expect(await attachAudioOutputSink(null, 'usb-dac-1')).toBe(false);

      const legacyElement = {} as HTMLMediaElement;
      expect(await attachAudioOutputSink(legacyElement, 'usb-dac-1')).toBe(false);
    });

    it('attaches sinkId to media element when supported', async () => {
      const setSinkIdMock = vi.fn().mockResolvedValue(undefined);
      const element = { setSinkId: setSinkIdMock } as unknown as HTMLMediaElement;

      const result = await attachAudioOutputSink(element, 'usb-dac-1');
      expect(result).toBe(true);
      expect(setSinkIdMock).toHaveBeenCalledWith('usb-dac-1');
    });

    it('automatically falls back to default sink if target device rejects or fails', async () => {
      const setSinkIdMock = vi.fn()
        .mockRejectedValueOnce(new Error('Device unavailable'))
        .mockResolvedValueOnce(undefined);
      const element = { setSinkId: setSinkIdMock } as unknown as HTMLMediaElement;

      const result = await attachAudioOutputSink(element, 'disconnected-device');
      expect(result).toBe(true);
      expect(setSinkIdMock).toHaveBeenCalledWith('disconnected-device');
      expect(setSinkIdMock).toHaveBeenCalledWith('');
    });
  });

  describe('routeAudioContextSink', () => {
    it('routes AudioContext sink to target device', async () => {
      const setSinkIdMock = vi.fn().mockResolvedValue(undefined);
      const ctx = { setSinkId: setSinkIdMock } as unknown as AudioContext;

      const result = await routeAudioContextSink(ctx, 'hdmi-out-2');
      expect(result).toBe(true);
      expect(setSinkIdMock).toHaveBeenCalledWith('hdmi-out-2');
    });

    it('falls back to default if AudioContext setSinkId fails on target device', async () => {
      const setSinkIdMock = vi.fn()
        .mockRejectedValueOnce(new Error('Sink failed'))
        .mockResolvedValueOnce(undefined);
      const ctx = { setSinkId: setSinkIdMock } as unknown as AudioContext;

      const result = await routeAudioContextSink(ctx, 'failed-device');
      expect(result).toBe(true);
      expect(setSinkIdMock).toHaveBeenCalledWith('default');
    });
  });

  describe('subscribeAudioDeviceChanges', () => {
    it('registers devicechange listener and unbinds cleanly', () => {
      const callback = vi.fn();
      const unsubscribe = subscribeAudioDeviceChanges(callback);

      expect(navigator.mediaDevices.addEventListener).toHaveBeenCalledWith('devicechange', expect.any(Function));

      unsubscribe();
      expect(navigator.mediaDevices.removeEventListener).toHaveBeenCalledWith('devicechange', expect.any(Function));
    });
  });
});
