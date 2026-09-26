import '@testing-library/jest-dom';
import { vi } from 'vitest';

if (typeof window !== 'undefined') {
  (window as any).electronAPI = {
    invoke: vi.fn(async () => ({ ok: true })),
    on: vi.fn(() => () => {}),
    send: vi.fn(),
    removeListener: vi.fn(),
  };
}
