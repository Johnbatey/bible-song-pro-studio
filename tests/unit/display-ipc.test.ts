import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const { registerDisplayIpc } = require('../../src/electron/ipc/display-ipc.cjs');

describe('Display IPC Handler Registration', () => {
  it('registers display and stage handlers with ipcMain', () => {
    const handlers = new Map<string, Function>();
    const mockIpc = {
      handle: vi.fn((channel, handler) => {
        handlers.set(channel, handler);
      }),
      on: vi.fn(),
    };

    const mockWindowManager = {
      createDisplayWindow: vi.fn(),
      getDisplayWindow: vi.fn(() => ({
        isDestroyed: () => false,
        isVisible: () => true,
        __isFrameless: true,
        getBounds: () => ({ x: 0, y: 0, width: 1920, height: 1080 }),
      })),
      getDisplayPayload: vi.fn(() => [{ id: '1', name: 'Main Display' }]),
    };

    registerDisplayIpc({
      windowManager: mockWindowManager,
      getDisplayState: () => ({ theme: { name: 'Dark Studio' } }),
      setDisplayState: vi.fn(),
      getStageState: () => ({}),
      setStageState: vi.fn(),
      stageLayoutsService: { list: vi.fn(() => []) },
      getActiveDisplayId: () => '1',
      setActiveDisplayId: vi.fn(),
      broadcastDisplayState: vi.fn(),
      broadcastStageWindows: vi.fn(),
      broadcastStageLayouts: vi.fn(),
      ipc: mockIpc,
    });

    expect(mockIpc.handle).toHaveBeenCalledWith('display:open', expect.any(Function));
    expect(mockIpc.handle).toHaveBeenCalledWith('display:getDisplays', expect.any(Function));
    expect(mockIpc.handle).toHaveBeenCalledWith('display:getStatus', expect.any(Function));

    const getStatusHandler = handlers.get('display:getStatus');
    const status = getStatusHandler?.();
    expect(status?.isOpen).toBe(true);
    expect(status?.isFullScreen).toBe(true);
    expect(status?.theme).toBe('Dark Studio');
  });
});
