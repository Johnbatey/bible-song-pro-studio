import { useEffect, useRef } from 'react';
import { useAppStore } from '../stores/appStore';
import {
  startBroadcastChannelSync,
  onBroadcastMessage,
  sendBroadcastState,
  stopBroadcastChannelSync,
} from '../services/broadcast-channel-sync';
import { publishStage } from '../services/stage-bus';

export function useBroadcastSync() {
  const prevSceneRef = useRef<string | null>(null);
  const currentScene = useAppStore((s) => s.display.currentScene);

  useEffect(() => {
    startBroadcastChannelSync();

    const unsub = onBroadcastMessage((data) => {
      const p = data.payload as Record<string, unknown> | undefined;
      if (!p) return;
      if (p.kind === 'content' && p.current) {
        const store = useAppStore.getState();
        const current = p.current as Record<string, unknown>;
        const scene: import('../types').Scene = {
          id: String(current.id || 'bc-content'),
          name: String(current.title || 'From Sync'),
          type: 'presentation',
          content: {
            text: String(current.body || ''),
            reference: String(current.reference || ''),
            html: String(current.html || ''),
          },
        };
        store.setCurrentScene(scene);
      }
      if (p.kind === 'timer-command' as string) {
      }
      if (p.kind === 'message' as string) {
        const store = useAppStore.getState();
        const text = String(p.text || '');
        if (text) {
          store.triggerAlert({
            id: `bc-${Date.now()}`,
            text,
            type: 'info',
            duration: 5000,
            animation: 'fade',
          });
        }
      }
      if (p.kind === 'config' as string) {
        const config = p.config as Record<string, unknown> | undefined;
        if (config && config.theme) {
        }
      }
    });

    return () => {
      unsub();
      stopBroadcastChannelSync();
    };
  }, []);

  useEffect(() => {
    const scene = currentScene;
    const sceneId = scene?.id || null;
    if (sceneId === prevSceneRef.current) return;
    prevSceneRef.current = sceneId;
    if (!scene) return;

    const content = {
      kind: 'content',
      current: {
        id: scene.id,
        title: scene.content?.reference || scene.name,
        body: scene.content?.text || '',
        html: scene.content?.html || '',
      },
    };

    /* Through the stage bus, not straight onto the channel: the bus is what
       the dock panel's preview reads, and it forwards to the stage windows
       over IPC. A BroadcastChannel never delivers to the context that posted,
       so publishing only there would leave this window's own preview blank. */
    publishStage(content);
    sendBroadcastState(content);
  }, [currentScene]);
}
