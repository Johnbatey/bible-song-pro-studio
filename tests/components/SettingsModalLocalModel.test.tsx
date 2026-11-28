import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { SettingsModal } from '../../src/renderer/components/SettingsModal';
import { useAppStore } from '../../src/renderer/stores/appStore';
import type { LocalModelStatus } from '../../src/renderer/types';

/* The fallback notice the main process puts in status() when a CUDA request
   lands on the CPU session instead. */
const FALLBACK_NOTICE =
  'CUDA requested but onnxruntime could not create a CUDA session; running on CPU.';

/* What a wheel that copied but cannot resolve its libraries reports. */
const LOAD_ERROR = 'libcudnn.so.9: cannot open shared object file: No such file or directory';

/** Only the fields the row paints, so the status cannot carry values the
    engine would never report. */
type OnnxStatus = Pick<
  LocalModelStatus,
  'ready' | 'warmupState' | 'device' | 'lastNotice' | 'lastError'
>;

function onnxStatus(overrides: Partial<OnnxStatus> = {}): OnnxStatus {
  return {
    ready: true,
    warmupState: 'ready',
    device: 'cpu',
    lastNotice: '',
    lastError: '',
    ...overrides,
  };
}

function mockBsp(onnx: OnnxStatus) {
  (window as any).BSP = {
    settings: { get: async () => ({ ok: true, settings: { sttEngine: 'local' } }) },
    ai: { status: async () => ({ engines: { onnx } }) },
  };
}

describe('SettingsModal local model row', () => {
  beforeEach(() => {
    useAppStore.setState({ isSettingsOpen: true, activeSettingsCategory: 'scripture' });
  });

  it('shows the execution provider when the engine is ready', async () => {
    mockBsp(onnxStatus());
    render(<SettingsModal />);

    const line = await screen.findByText(/Loaded and ready to transcribe\. · /);
    expect(line.textContent).toBe('Loaded and ready to transcribe. · CPU');
    // Nothing went wrong, so there is nothing to explain on hover.
    expect(line).not.toHaveAttribute('title');
  });

  it('puts the fallback notice in status() in the status line title', async () => {
    mockBsp(onnxStatus({ lastNotice: FALLBACK_NOTICE }));
    render(<SettingsModal />);

    const line = await screen.findByText(/Loaded and ready to transcribe\. · /);
    /* The row still reports the device actually in use, and the reason CUDA is
       not the one is one hover away — without a Linux GPU. */
    expect(line.textContent).toBe('Loaded and ready to transcribe. · CPU');
    expect(line).toHaveAttribute('title', FALLBACK_NOTICE);
  });

  it('shows lastError in place of the provider when warmup failed', async () => {
    mockBsp(onnxStatus({ ready: false, warmupState: 'error', lastError: LOAD_ERROR }));
    render(<SettingsModal />);

    const line = await screen.findByText(LOAD_ERROR);
    expect(line.textContent).toBe(LOAD_ERROR);
    // The provider suffix gives way to the failure, so the row never claims a
    // device it did not manage to load.
    expect(screen.queryByText(/Loaded and ready to transcribe\./)).toBeNull();
  });
});
