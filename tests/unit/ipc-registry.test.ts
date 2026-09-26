import { describe, it, expect, vi, beforeEach } from 'vitest';
const { IpcRegistry } = require('../../src/electron/ipc/registry.cjs');

describe('IPC Protocol Registry & Lifecycle Manager', () => {
  let mockIpcMain: any;
  let registry: any;

  beforeEach(() => {
    mockIpcMain = {
      handle: vi.fn(),
      removeHandler: vi.fn(),
      on: vi.fn(),
      removeListener: vi.fn(),
    };
    registry = new IpcRegistry(mockIpcMain);
  });

  it('registers handlers and forwards them to ipcMain.handle', async () => {
    const handler = vi.fn().mockResolvedValue({ ok: true, version: '1.0' });
    registry.handle('app:version', handler, { domain: 'app' });

    expect(mockIpcMain.handle).toHaveBeenCalledWith('app:version', expect.any(Function));
    
    // Call the wrapped safe handler
    const safeHandler = mockIpcMain.handle.mock.calls[0][1];
    const res = await safeHandler({}, 'arg1');
    expect(handler).toHaveBeenCalledWith({}, 'arg1');
    expect(res).toEqual({ ok: true, version: '1.0' });
  });

  it('contains unexpected errors thrown in handlers and returns structured error envelope', async () => {
    const failingHandler = vi.fn().mockImplementation(() => {
      throw new Error('Database disk full');
    });
    registry.handle('db:query', failingHandler, { domain: 'database' });

    const safeHandler = mockIpcMain.handle.mock.calls[0][1];
    const res = await safeHandler({});
    expect(res).toEqual({ ok: false, error: 'Database disk full' });
  });

  it('registers event listeners and forwards them to ipcMain.on', () => {
    const listener = vi.fn();
    registry.on('stream:status', listener, { domain: 'streaming' });

    expect(mockIpcMain.on).toHaveBeenCalledWith('stream:status', expect.any(Function));
    const safeListener = mockIpcMain.on.mock.calls[0][1];
    safeListener({}, { active: true });
    expect(listener).toHaveBeenCalledWith({}, { active: true });
  });

  it('registers full domain modules cleanly via registerDomain', () => {
    const mockDomainRegistrar = vi.fn(({ ipc }) => {
      ipc.handle('media:list', () => ({ ok: true, items: [] }), { domain: 'media' });
    });

    const success = registry.registerDomain('media', mockDomainRegistrar, {});
    expect(success).toBe(true);
    expect(mockDomainRegistrar).toHaveBeenCalled();
    expect(mockIpcMain.handle).toHaveBeenCalledWith('media:list', expect.any(Function));
  });

  it('supports unregistering handlers by domain for clean teardown', () => {
    registry.handle('bible:search', vi.fn(), { domain: 'bible' });
    registry.handle('media:play', vi.fn(), { domain: 'media' });

    expect(registry.getRegisteredChannels().domains).toContain('bible');
    expect(registry.getRegisteredChannels().domains).toContain('media');

    registry.unregisterDomain('bible');
    expect(mockIpcMain.removeHandler).toHaveBeenCalledWith('bible:search');
    expect(registry.getRegisteredChannels().domains).not.toContain('bible');
    expect(registry.getRegisteredChannels().domains).toContain('media');
  });

  it('provides complete introspection of registered channels and domains', () => {
    registry.handle('window:minimize', vi.fn(), { domain: 'window' });
    registry.on('display:bounds', vi.fn(), { domain: 'display' });

    const info = registry.getRegisteredChannels();
    expect(info.handles).toEqual([{ channel: 'window:minimize', domain: 'window' }]);
    expect(info.listeners).toEqual([{ channel: 'display:bounds', domain: 'display' }]);
    expect(info.domains).toContain('window');
    expect(info.domains).toContain('display');
  });
});
