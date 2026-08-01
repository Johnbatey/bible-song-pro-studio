import { programSurfaceFixtures } from '../renderer/components/display/programSurfaceFixtures';

const fixtureName = new URLSearchParams(window.location.search).get('fixture') || 'Lower Third';
const fixture = programSurfaceFixtures.find((item) => item.name === fixtureName) || programSurfaceFixtures[2];
const initialState = fixture.state;
const updatedState = fixture.state;
const listeners = new Set<(msg: any) => void>();

window.BSP = {
  ...(window.BSP || {}),
  media: {
    ...(window.BSP?.media || {}),
    baseUrl: async () => window.location.origin === 'null' ? '' : window.location.origin,
  },
  display: {
    ...(window.BSP?.display || {}),
    getState: async () => initialState,
    onMessage: (callback: (msg: any) => void) => {
      listeners.add(callback);
      setTimeout(() => {
        callback({ type: 'display:update', state: updatedState });
      }, 250);
      return () => listeners.delete(callback);
    },
  },
} as any;

(window as any).__BSP_AUDIENCE_FIXTURE__ = {
  initialState,
  updatedState,
  listenerCount: () => listeners.size,
};
