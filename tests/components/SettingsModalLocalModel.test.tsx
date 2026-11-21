import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { SettingsModal } from '../../src/renderer/components/SettingsModal';
import { useAppStore } from '../../src/renderer/stores/appStore';
import type { LocalModelStatus, TranscriptionStatus } from '../../src/renderer/types';

/* The fallback notice the main process puts in status() when a CUDA request
   lands on the CPU session instead. */
const FALLBACK_NOTICE =
  'CUDA requested but onnxruntime could not create a CUDA session; running on CPU.';

function onnxStatus(overrides: Partial<LocalModelStatus> = {}): LocalModelStatus {
  return {
    ok: true,
    name: 'onnx',
    modelId: 'onnx-community/moonshine-base-ONNX',
    modelKey: 'moonshine-base',
    modelLabel: 'Moonshine Base',
    approxSize: '145 MB',
    family: 'moonshine',
    available: true,
    ready: true,
    warmupState: 'ready',
    downloadProgress: 100,
    device: 'cpu',
    cacheDir: '',
    lastError: '',
    lastNotice: '',
    multilingual: false,
    supportedLanguages: [],
    models: [
      {
        key: 'moonshine-base',
        id: 'onnx-community/moonshine-base-ONNX',
        label: 'Moonshine Base',
        note: 'English, fast, runs on this computer',
        approxSize: '145 MB',
        family: 'moonshine',
        multilingual: false,
        downloaded: true,
      },
    ],
    ...overrides,
  };
}

function mockBsp(onnx: LocalModelStatus) {
  const status: TranscriptionStatus = {
    ok: true,
    activeEngine: 'onnx',
    platform: { os: 'linux', arch: 'x64', isAppleSilicon: false },
    engines: {
      onnx,
      mlx: {
        ok: false,
        name: 'mlx',
        available: false,
        ready: false,
        warmupState: 'unavailable',
        lastError: '',
      },
    },
  };

  (window as any).BSP = {
    version: async () => '3.4.0',
    settings: {
      get: async () => ({
        ok: true,
        settings: {
          sttEngine: 'local',
          sttLocalModel: 'moonshine-base',
          deepgramApiKeySet: false,
        },
      }),
      set: async () => ({ ok: true, settings: {} }),
      onUpdated: () => () => {},
      clearSecret: async () => ({ ok: true, settings: {} }),
    },
    ai: {
      status: async () => status,
      setLocalModel: async () => ({ ok: true }),
      setEngine: async () => ({ ok: true }),
      warmup: async () => ({ ok: true }),
    },
    ndi: {
      getFeeds: async () => ({ ok: true, feeds: [] }),
      status: async () => ({ running: false, feeds: [] }),
    },
    display: {
      getDisplays: async () => [],
      getStatus: async () => ({ clients: 0 }),
    },
    fonts: { getSystemFonts: async () => [] },
    updates: { check: async () => ({}) },
    openExternal: async () => ({ ok: true }),
  };
}

/** The status line beside the model row: the only span in the modal whose
    text is built from the engine status. */
async function findStatusLine() {
  return screen.findByText(/Loaded and ready to transcribe\. · /);
}

describe('SettingsModal local model row', () => {
  beforeEach(() => {
    useAppStore.setState({
      isSettingsOpen: true,
      activeSettingsCategory: 'scripture',
      typingFont: '',
    } as any);
  });

  it('shows the execution provider when the engine is ready', async () => {
    mockBsp(onnxStatus({ ready: true, warmupState: 'ready', device: 'cpu' }));
    render(<SettingsModal />);

    const line = await findStatusLine();
    expect(line.textContent).toBe('Loaded and ready to transcribe. · CPU');
    // Nothing went wrong, so there is nothing to explain on hover.
    expect(line).not.toHaveAttribute('title');
  });

  it('puts the fallback notice in status() in the status line title', async () => {
    mockBsp(
      onnxStatus({
        ready: true,
        warmupState: 'ready',
        device: 'cpu',
        lastNotice: FALLBACK_NOTICE,
      })
    );
    render(<SettingsModal />);

    const line = await findStatusLine();
    /* The row still reports the device actually in use, and the reason CUDA is
       not the one is one hover away — without a Linux GPU. */
    expect(line.textContent).toBe('Loaded and ready to transcribe. · CPU');
    await waitFor(() => expect(line).toHaveAttribute('title', FALLBACK_NOTICE));
  });
});
