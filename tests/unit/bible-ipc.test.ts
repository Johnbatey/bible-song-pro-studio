import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const { registerBibleIpc } = require('../../src/electron/ipc/bible-ipc.cjs');

describe('Bible IPC Handler Registration', () => {
  it('registers bible and scripture handlers with ipcMain', () => {
    const handlers = new Map<string, Function>();
    const mockIpc = {
      handle: vi.fn((channel, handler) => {
        handlers.set(channel, handler);
      }),
    };

    const mockBibleService = {
      getVersions: vi.fn(() => [{ id: 'KJV', name: 'King James Version' }]),
      getBooks: vi.fn(() => [{ id: 'GEN', name: 'Genesis' }]),
      getChapter: vi.fn(() => ({ verses: [] })),
      search: vi.fn(() => ({ results: [] })),
    };

    registerBibleIpc({
      bibleService: mockBibleService,
      verseDetectionService: {},
      lexiconService: {},
      ipc: mockIpc,
    });

    expect(mockIpc.handle).toHaveBeenCalledWith('bible:getVersions', expect.any(Function));
    expect(mockIpc.handle).toHaveBeenCalledWith('bible:getBooks', expect.any(Function));
    expect(mockIpc.handle).toHaveBeenCalledWith('bible:getChapter', expect.any(Function));
    expect(mockIpc.handle).toHaveBeenCalledWith('bible:search', expect.any(Function));

    // Test invoking handler
    const getVersionsHandler = handlers.get('bible:getVersions');
    expect(getVersionsHandler).toBeDefined();
    const versions = getVersionsHandler?.();
    expect(versions).toEqual([{ id: 'KJV', name: 'King James Version' }]);
  });
});
