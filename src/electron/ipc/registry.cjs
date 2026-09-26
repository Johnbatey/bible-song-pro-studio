/**
 * =========================================================================
 * IPC Protocol Registry & Lifecycle Manager
 * -------------------------------------------------------------------------
 * Provides unified registration, safe error containment, channel lifecycle
 * tracking, and hot-teardown for Electron main process IPC domains.
 * =========================================================================
 */

class IpcRegistry {
  constructor(ipcMainInstance) {
    this.ipcMain = ipcMainInstance;
    this.registeredHandlers = new Map(); // channel -> { handler, rawHandler, domain }
    this.registeredListeners = new Map(); // channel -> { listener, rawListener, domain }
    this.domains = new Set();
  }

  /**
   * Register a handle (invoke/handle) with error containment and logging
   */
  handle(channel, handler, options = {}) {
    const domain = options.domain || 'general';
    if (this.registeredHandlers.has(channel)) {
      try {
        this.ipcMain?.removeHandler?.(channel);
      } catch (_) {}
    }

    const safeHandler = async (event, ...args) => {
      try {
        return await handler(event, ...args);
      } catch (err) {
        console.error(`[IpcRegistry] Error in handler for channel "${channel}" [${domain}]:`, err);
        return { ok: false, error: err?.message || String(err) };
      }
    };

    this.registeredHandlers.set(channel, { handler: safeHandler, rawHandler: handler, domain });
    this.domains.add(domain);
    this.ipcMain?.handle?.(channel, safeHandler);
  }

  /**
   * Register an event listener (send/on) with safe error containment
   */
  on(channel, listener, options = {}) {
    const domain = options.domain || 'general';
    const safeListener = (event, ...args) => {
      try {
        listener(event, ...args);
      } catch (err) {
        console.error(`[IpcRegistry] Error in listener for channel "${channel}" [${domain}]:`, err);
      }
    };

    this.registeredListeners.set(channel, { listener: safeListener, rawListener: listener, domain });
    this.domains.add(domain);
    this.ipcMain?.on?.(channel, safeListener);
  }

  /**
   * Register a full domain module (e.g. registerBibleIpc(context))
   */
  registerDomain(domainName, registerFn, context = {}) {
    try {
      registerFn({ ...context, ipc: this });
      this.domains.add(domainName);
      return true;
    } catch (err) {
      console.error(`[IpcRegistry] Failed to register IPC domain "${domainName}":`, err);
      return false;
    }
  }

  /**
   * Unregister all handlers and listeners for a specific domain or all domains
   */
  unregisterDomain(domainName) {
    // Unregister handles
    for (const [channel, info] of Array.from(this.registeredHandlers.entries())) {
      if (!domainName || info.domain === domainName) {
        try {
          this.ipcMain?.removeHandler?.(channel);
        } catch (_) {}
        this.registeredHandlers.delete(channel);
      }
    }

    // Unregister listeners
    for (const [channel, info] of Array.from(this.registeredListeners.entries())) {
      if (!domainName || info.domain === domainName) {
        try {
          this.ipcMain?.removeListener?.(channel, info.listener);
        } catch (_) {}
        this.registeredListeners.delete(channel);
      }
    }

    if (domainName) {
      this.domains.delete(domainName);
    } else {
      this.domains.clear();
    }
  }

  /**
   * Get list of all registered channels, listeners and domains
   */
  getRegisteredChannels() {
    return {
      handles: Array.from(this.registeredHandlers.entries()).map(([channel, info]) => ({
        channel,
        domain: info.domain,
      })),
      listeners: Array.from(this.registeredListeners.entries()).map(([channel, info]) => ({
        channel,
        domain: info.domain,
      })),
      domains: Array.from(this.domains),
    };
  }
}

module.exports = {
  IpcRegistry,
};
