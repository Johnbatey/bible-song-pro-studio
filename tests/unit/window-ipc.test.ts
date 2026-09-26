import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const { registerWindowIpc } = require('../../src/electron/ipc/window-ipc.cjs');

describe('Window IPC Handler Registration', () => {
  it('registers window control handlers with ipcMain', () => {
    const handlers = new Map<string, Function>();
    const mockIpc = {
      handle: vi.fn((channel, handler) => {
        handlers.set(channel, handler);
      }),
      on: vi.fn(),
    };

    const mockMainWindow = {
      minimize: vi.fn(),
      maximize: vi.fn(),
      unmaximize: vi.fn(),
      isMaximized: vi.fn(() => false),
      isFullScreen: vi.fn(() => true),
      close: vi.fn(),
    };

    registerWindowIpc({
      getMainWindow: () => mockMainWindow,
      createDockPopoutWindow: vi.fn(),
      getDockPopoutWindows: () => new Map(),
      broadcastDockPopouts: vi.fn(),
      buildAppMenu: vi.fn(),
      updateMenuWorkspaces: vi.fn(),
      setMenuLocale: vi.fn(),
      ipc: mockIpc,
    });

    expect(mockIpc.handle).toHaveBeenCalledWith('window:minimize', expect.any(Function));
    expect(mockIpc.handle).toHaveBeenCalledWith('window:maximize', expect.any(Function));
    expect(mockIpc.handle).toHaveBeenCalledWith('window:close', expect.any(Function));
    expect(mockIpc.handle).toHaveBeenCalledWith('window:isFullScreen', expect.any(Function));

    const isFullScreenHandler = handlers.get('window:isFullScreen');
    expect(isFullScreenHandler?.()).toBe(true);
  });
});
