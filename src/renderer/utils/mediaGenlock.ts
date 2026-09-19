/**
 * Genlock Media Timecode Synchronization Service
 * 
 * Provides bit-for-bit, frame-for-frame synchronization across multiple Electron
 * BrowserWindows (Main Studio, Audience Display, Projector, Stage Display) via
 * high-precision BroadcastChannel and Electron IPC bridge.
 * 
 * Program Viewport = Master Timecode Clock Leader
 * Audience / Projector / Stage Viewports = Phase-Locked Followers (PLL)
 */

export type GenlockMessageType = 'timecode' | 'command' | 'request_sync';

export interface GenlockMessage {
  type: GenlockMessageType;
  sourceId: string;
  mediaUrl?: string;
  currentTime: number;
  playing: boolean;
  playbackRate: number;
  t: number;
  command?: 'seek' | 'restart' | 'play' | 'pause' | 'stop' | 'speed';
  nonce?: number;
}

class MediaGenlockService {
  private channel: BroadcastChannel | null = null;
  private masterUnsubs = new Map<string, () => void>();
  private followerUnsubs = new Map<string, () => void>();
  private latestClocks = new Map<string, GenlockMessage>();
  private registeredMasters = new Set<string>();

  constructor() {
    if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
      try {
        this.channel = new BroadcastChannel('bsp-media-genlock');
        this.channel.addEventListener('message', (event: MessageEvent<GenlockMessage>) => {
          this.handleIncomingMessage(event.data);
        });
      } catch (err) {
        console.warn('BroadcastChannel not available for genlock:', err);
      }
    }
  }

  private handleIncomingMessage(data: GenlockMessage) {
    if (!data) return;
    if (data.type === 'timecode' || data.type === 'command') {
      this.latestClocks.set(data.sourceId, data);
      if (data.mediaUrl) {
        this.latestClocks.set(data.mediaUrl, data);
      }
    }
  }

  /**
   * Broadcast an explicit transport command (seek, restart, play, pause, stop, speed)
   * to all connected followers immediately with zero delay.
   */
  public broadcastCommand(
    sourceId: string,
    action: 'seek' | 'restart' | 'play' | 'pause' | 'stop' | 'speed',
    params: {
      currentTime?: number;
      playing?: boolean;
      playbackRate?: number;
      mediaUrl?: string;
    } = {}
  ) {
    const msg: GenlockMessage = {
      type: 'command',
      command: action,
      sourceId,
      mediaUrl: params.mediaUrl,
      currentTime: params.currentTime ?? 0,
      playing: params.playing ?? true,
      playbackRate: params.playbackRate ?? 1.0,
      t: performance.now(),
      nonce: Date.now() + Math.random(),
    };

    this.handleIncomingMessage(msg);

    try {
      this.channel?.postMessage(msg);
    } catch {}

    if (typeof window !== 'undefined' && (window as any).BSP?.sendDisplayMessage) {
      (window as any).BSP.sendDisplayMessage({ type: 'genlock:command', genlock: msg });
    }
  }

  /**
   * Registers a Program video element as the Master Timecode Source.
   */
  public registerMaster(
    sourceId: string,
    video: HTMLVideoElement,
    mediaUrl?: string
  ): () => void {
    this.unregisterMaster(sourceId);
    if (!video) return () => {};

    this.registeredMasters.add(sourceId);

    const broadcast = (isCommand = false, commandType?: 'seek' | 'restart') => {
      if (video.readyState < 1 && !isCommand) return;
      const msg: GenlockMessage = {
        type: isCommand ? 'command' : 'timecode',
        command: commandType,
        sourceId,
        mediaUrl,
        currentTime: video.currentTime,
        playing: !video.paused && !video.ended,
        playbackRate: video.playbackRate || 1.0,
        t: performance.now(),
      };

      this.latestClocks.set(sourceId, msg);
      if (mediaUrl) this.latestClocks.set(mediaUrl, msg);

      try {
        this.channel?.postMessage(msg);
      } catch {}

      // Cross-window Electron IPC broadcast fallback
      if (typeof window !== 'undefined' && (window as any).BSP?.sendDisplayMessage) {
        (window as any).BSP.sendDisplayMessage({
          type: isCommand ? 'genlock:command' : 'genlock:timecode',
          genlock: msg,
        });
      }
    };

    // Immediate initial timecode broadcast
    broadcast();

    // High-frequency master clock broadcast (every 40ms = 25 beacons/sec for sub-frame tracking)
    const interval = setInterval(() => broadcast(false), 40);

    const onPlay = () => broadcast(true);
    const onPause = () => broadcast(true);
    const onSeeked = () => broadcast(true, 'seek');
    const onRateChange = () => broadcast();
    const onLoadedMetadata = () => broadcast();
    const onEnded = () => broadcast(true);

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('ratechange', onRateChange);
    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('ended', onEnded);

    // Respond to follower sync requests immediately via BroadcastChannel
    const handleFollowerRequest = (event: MessageEvent<GenlockMessage>) => {
      if (event.data?.type === 'request_sync' && (event.data.sourceId === sourceId || !event.data.sourceId)) {
        broadcast(false);
      }
    };
    this.channel?.addEventListener('message', handleFollowerRequest);

    // Respond to follower sync requests immediately via Electron IPC
    let ipcMasterCleanup: (() => void) | undefined;
    if (typeof window !== 'undefined' && (window as any).BSP?.display?.onMessage) {
      ipcMasterCleanup = (window as any).BSP.display.onMessage((msg: any) => {
        if (msg?.type === 'genlock:request_sync') {
          const req = msg.genlock;
          if (req && (req.sourceId === sourceId || !req.sourceId || (mediaUrl && req.mediaUrl === mediaUrl))) {
            broadcast(false);
          }
        }
      });
    }

    const cleanup = () => {
      clearInterval(interval);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('ratechange', onRateChange);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('ended', onEnded);
      this.channel?.removeEventListener('message', handleFollowerRequest);
      ipcMasterCleanup?.();
      this.registeredMasters.delete(sourceId);
      this.masterUnsubs.delete(sourceId);
    };

    this.masterUnsubs.set(sourceId, cleanup);
    return cleanup;
  }

  public unregisterMaster(sourceId: string) {
    const unsub = this.masterUnsubs.get(sourceId);
    if (unsub) {
      unsub();
      this.masterUnsubs.delete(sourceId);
    }
    this.registeredMasters.delete(sourceId);
  }

  /**
   * Registers an Audience/Projector/Stage video element as a Phase-Locked Follower.
   */
  public registerFollower(
    sourceId: string,
    video: HTMLVideoElement,
    mediaUrl?: string
  ): () => void {
    this.unregisterFollower(sourceId);
    if (!video) return () => {};

    let pendingMessage: GenlockMessage | null = null;

    const applyCommand = (msg: GenlockMessage) => {
      if (!msg) return;
      if (video.readyState < 1) {
        pendingMessage = msg;
        return;
      }

      if (msg.command === 'seek' || msg.command === 'restart') {
        video.currentTime = Math.max(0, msg.currentTime);
        if (msg.playing) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      } else if (msg.command === 'play') {
        if (video.paused) {
          video.play().catch(() => {});
        }
      } else if (msg.command === 'pause') {
        if (!video.paused) {
          video.pause();
        }
      } else if (msg.command === 'stop') {
        video.pause();
        video.currentTime = 0;
      } else if (msg.command === 'speed') {
        video.playbackRate = msg.playbackRate || 1.0;
      }
    };

    const applyTimecode = (msg: GenlockMessage) => {
      if (!msg) return;
      if (video.readyState < 2) {
        pendingMessage = msg;
        return;
      }

      const elapsed = Math.max(0, (performance.now() - msg.t) / 1000);
      const expectedTime = msg.currentTime + (msg.playing ? elapsed * (msg.playbackRate || 1.0) : 0);
      const drift = expectedTime - video.currentTime;

      // 1. Hard Frame Snap: If drift exceeds 40ms (~1 frame at 25-30fps), snap time immediately
      if (Math.abs(drift) > 0.040) {
        video.currentTime = Math.max(0, expectedTime);
        video.playbackRate = msg.playbackRate || 1.0;
      }
      // 2. Micro-drift PLL: 8ms to 40ms smooth phase-lock adjustment without video decode stutter
      else if (Math.abs(drift) > 0.008) {
        const nudge = Math.max(-0.06, Math.min(0.06, drift * 1.5));
        video.playbackRate = (msg.playbackRate || 1.0) * (1.0 + nudge);
      }
      // 3. Locked (< 8ms sub-frame alignment): Normal playback speed
      else {
        video.playbackRate = msg.playbackRate || 1.0;
      }

      // 4. Play / Pause state sync
      if (msg.playing) {
        if (video.paused && !video.seeking) {
          video.play().catch(() => {});
        }
      } else {
        if (!video.paused) {
          video.pause();
        }
      }
    };

    const handleMessageData = (msg: GenlockMessage) => {
      if (!msg) return;

      const matches =
        msg.sourceId === sourceId ||
        (mediaUrl && msg.mediaUrl && (msg.mediaUrl === mediaUrl || msg.mediaUrl.endsWith(mediaUrl) || mediaUrl.endsWith(msg.mediaUrl))) ||
        (!sourceId && !mediaUrl);

      if (!matches) return;

      if (msg.type === 'command') {
        applyCommand(msg);
      } else if (msg.type === 'timecode') {
        applyTimecode(msg);
      }
    };

    const onMetadata = () => {
      if (pendingMessage) {
        if (pendingMessage.type === 'command') {
          applyCommand(pendingMessage);
        } else {
          applyTimecode(pendingMessage);
        }
        pendingMessage = null;
      } else {
        const cached = this.latestClocks.get(sourceId) || (mediaUrl ? this.latestClocks.get(mediaUrl) : null);
        if (cached) {
          if (cached.type === 'command') applyCommand(cached);
          else applyTimecode(cached);
        }
      }
    };

    video.addEventListener('loadedmetadata', onMetadata);
    video.addEventListener('canplay', onMetadata);

    // Initial sync check from cached master clock
    const cached = this.latestClocks.get(sourceId) || (mediaUrl ? this.latestClocks.get(mediaUrl) : null);
    if (cached) {
      if (video.readyState >= 2) {
        if (cached.type === 'command') applyCommand(cached);
        else applyTimecode(cached);
      } else {
        pendingMessage = cached;
      }
    }

    const requestMsg: GenlockMessage = {
      type: 'request_sync',
      sourceId,
      mediaUrl,
      currentTime: 0,
      playing: false,
      playbackRate: 1.0,
      t: performance.now(),
    };

    // Request immediate sync update from master in case master is already running
    try {
      this.channel?.postMessage(requestMsg);
    } catch {}

    if (typeof window !== 'undefined' && (window as any).BSP?.sendDisplayMessage) {
      (window as any).BSP.sendDisplayMessage({ type: 'genlock:request_sync', genlock: requestMsg });
    }

    const onBroadcastMessage = (event: MessageEvent<GenlockMessage>) => {
      handleMessageData(event.data);
    };
    this.channel?.addEventListener('message', onBroadcastMessage);

    // Electron IPC listener
    let ipcCleanup: (() => void) | undefined;
    if (typeof window !== 'undefined' && (window as any).BSP?.display?.onMessage) {
      ipcCleanup = (window as any).BSP.display.onMessage((msg: any) => {
        if ((msg?.type === 'genlock:timecode' || msg?.type === 'genlock:command') && msg.genlock) {
          handleMessageData(msg.genlock);
        }
      });
    }

    const cleanup = () => {
      video.removeEventListener('loadedmetadata', onMetadata);
      video.removeEventListener('canplay', onMetadata);
      this.channel?.removeEventListener('message', onBroadcastMessage);
      ipcCleanup?.();
      this.followerUnsubs.delete(sourceId);
    };

    this.followerUnsubs.set(sourceId, cleanup);
    return cleanup;
  }

  public unregisterFollower(sourceId: string) {
    const unsub = this.followerUnsubs.get(sourceId);
    if (unsub) {
      unsub();
      this.followerUnsubs.delete(sourceId);
    }
  }
}

export const mediaGenlock = new MediaGenlockService();
