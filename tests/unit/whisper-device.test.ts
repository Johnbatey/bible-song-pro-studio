/* =========================================================================
   The CUDA opt-in, exercised rather than read
   -------------------------------------------------------------------------
   Installing the provider is one thing; asking for it is another. These tests
   drive warmup() with a stand-in for transformers.js, so the device request,
   the one CPU retry, the device that status() reports and the fallback reason
   surviving a transcript are all observed on this machine — no
   onnxruntime-node, no GPU, no download.

   The service's only seam is `importTransformers`; everything below goes
   through the real warmup/transcribe/status code.
   ========================================================================= */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { createOnnxWhisperService } = require('../../src/electron/whisper-onnx-service.cjs');

const REAL_PLATFORM = process.platform;
const REAL_ARCH = process.arch;
let root: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-device-test-'));
  delete process.env.BSP_WHISPER_DEVICE;
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
  delete process.env.BSP_WHISPER_DEVICE;
  Object.defineProperty(process, 'platform', { value: REAL_PLATFORM, configurable: true });
  Object.defineProperty(process, 'arch', { value: REAL_ARCH, configurable: true });
});

/** The platform gate reads the process globals; both are configurable. */
function pretendPlatform(platform: string, arch: string) {
  Object.defineProperty(process, 'platform', { value: platform, configurable: true });
  Object.defineProperty(process, 'arch', { value: arch, configurable: true });
}

type PipelineCall = { task: string; model: string; options: Record<string, unknown> };

/**
 * A transformers.js stand-in that records every pipeline() attempt and lets
 * each one succeed or fail. Attempt 1 is the CUDA request, attempt 2 the retry.
 */
function fakeTransformers(behave: (attempt: number) => unknown) {
  const calls: PipelineCall[] = [];
  const module = {
    env: {} as Record<string, unknown>,
    pipeline: async (task: string, model: string, options: Record<string, unknown>) => {
      calls.push({ task, model, options });
      return behave(calls.length);
    },
  };
  return { module, calls };
}

/** Recognisers in this service are callable: pipe(audio, options) -> result. */
const recogniser = () => async () => ({ text: 'amen', chunks: [] });

function serviceWith(module: unknown) {
  return createOnnxWhisperService({
    app: { getPath: () => root },
    importTransformers: async () => module,
  });
}

describe('CUDA opt-in', () => {
  it('leaves the pipeline on the default device when the variable is unset', async () => {
    const { module, calls } = fakeTransformers(recogniser);
    const service = serviceWith(module);

    const warmed = await service.warmup();

    expect(warmed.ok).toBe(true);
    expect(calls).toHaveLength(1);
    expect('device' in calls[0].options).toBe(false);
    expect(service.status().device).toBe('cpu');
  });

  it('requests device cuda when BSP_WHISPER_DEVICE=cuda on linux/x64', async () => {
    pretendPlatform('linux', 'x64');
    process.env.BSP_WHISPER_DEVICE = 'cuda';
    const { module, calls } = fakeTransformers(recogniser);

    const service = serviceWith(module);
    await service.warmup();

    expect(calls[0].options.device).toBe('cuda');
    expect(service.status().device).toBe('cuda');
    expect(service.status().ready).toBe(true);
  });

  it('ignores the variable off linux/x64 rather than asking for an unsupported device', async () => {
    pretendPlatform('darwin', 'x64');
    process.env.BSP_WHISPER_DEVICE = 'cuda';
    const { module, calls } = fakeTransformers(recogniser);

    const service = serviceWith(module);
    await service.warmup();

    expect('device' in calls[0].options).toBe(false);
    expect(service.status().device).toBe('cpu');
  });
});

describe('CPU fallback', () => {
  async function warmWithFailingCuda() {
    pretendPlatform('linux', 'x64');
    process.env.BSP_WHISPER_DEVICE = 'cuda';
    const { module, calls } = fakeTransformers((attempt) => {
      if (attempt === 1) throw new Error('libonnxruntime_providers_cuda.so: cannot open shared object file');
      return recogniser();
    });
    const service = serviceWith(module);
    const warmed = await service.warmup();
    return { service, calls, warmed };
  }

  it('retries once without a device and still builds a recogniser', async () => {
    const { service, calls, warmed } = await warmWithFailingCuda();

    expect(warmed.ok).toBe(true);
    expect(calls).toHaveLength(2);
    expect(calls[0].options.device).toBe('cuda');
    expect('device' in calls[1].options).toBe(false);
    expect(service.status().device).toBe('cpu');
    expect(service.status().ready).toBe(true);
    expect(service.status().warmupState).toBe('ready');
  });

  it('reports why it fell back, naming the CUDA error', async () => {
    const { service } = await warmWithFailingCuda();

    expect(service.status().lastNotice).toContain('CUDA was requested but did not load');
    expect(service.status().lastNotice).toContain('libonnxruntime_providers_cuda.so');
  });

  it('keeps that reason after a successful transcript clears the per-run notice', async () => {
    const { service } = await warmWithFailingCuda();

    const transcript = await service.transcribe({ audioData: [0.1, 0.2] });

    expect(transcript.ok).toBe(true);
    expect(transcript.text).toBe('amen');
    expect(service.status().lastNotice).toContain('CUDA was requested but did not load');
    expect(service.status().device).toBe('cpu');
  });
});
