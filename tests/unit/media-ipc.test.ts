import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const { registerMediaIpc } = require('../../src/electron/ipc/media-ipc.cjs');

describe('Media IPC Handler Registration', () => {
  it('registers media, streaming, and settings handlers with ipcMain', () => {
    const handlers = new Map<string, Function>();
    const mockIpc = {
      handle: vi.fn((channel, handler) => {
        handlers.set(channel, handler);
      }),
      on: vi.fn(),
    };

    const mockMediaService = {
      list: vi.fn(() => ({ ok: true, items: [{ id: '1', name: 'Background.mp4' }] })),
      remove: vi.fn(),
    };

    registerMediaIpc({
      getMainWindow: () => null,
      mediaService: mockMediaService,
      ndiService: { status: vi.fn(() => ({ running: false })) },
      streamingService: { status: vi.fn(() => ({ running: false })) },
      sessionHistory: {},
      songImportService: {},
      settingsService: { getPublic: vi.fn(() => ({ ok: true, settings: {} })) },
      deepgramService: {},
      obsService: {},
      transcriptionService: { status: vi.fn(() => ({ ok: true, engine: 'whisper' })) },
      recordingsService: {},
      windowManager: {},
      displayPort: 8942,
      getActiveDisplayId: () => null,
      setDisplayState: vi.fn(),
      ipc: mockIpc,
    });

    expect(mockIpc.handle).toHaveBeenCalledWith('media:list', expect.any(Function));
    expect(mockIpc.handle).toHaveBeenCalledWith('ai:status', expect.any(Function));
    expect(mockIpc.handle).toHaveBeenCalledWith('stream:status', expect.any(Function));
    expect(mockIpc.handle).toHaveBeenCalledWith('ndi:status', expect.any(Function));

    const mediaListHandler = handlers.get('media:list');
    const media = mediaListHandler?.();
    expect(media).toEqual({ ok: true, items: [{ id: '1', name: 'Background.mp4' }] });
  });
});
