/* =========================================================================
   The CUDA opt-in, exercised rather than read
   -------------------------------------------------------------------------
   Installing the provider is one thing; asking for it is another. These tests
   drive warmup() with a stand-in for transformers.js, so the device request,
   the one CPU retry, the device status() reports and the fallback reason
   surviving a transcript are observed here — no onnxruntime-node, no GPU.

   `importTransformers` is the service's only seam; everything below it is the
   real warmup/transcribe/status code.
   ========================================================================= */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
  vi.unstubAllEnvs();
  Object.defineProperty(process, 'platform', { value: REAL_PLATFORM, configurable: true });
  Object.defineProperty(process, 'arch', { value: REAL_ARCH, configurable: true });
});

/** The gate reads the process globals; both properties are configurable. */
function pretendPlatform(platform: string, arch: string) {
  Object.defineProperty(process, 'platform', { value: platform, configurable: true });
  Object.defineProperty(process, 'arch', { value: arch, configurable: true });
}

/**
 * transformers.js stand-in. Records the options of every pipeline() attempt;
 * `behave(attempt)` decides what that attempt returns. Attempt 1 is the CUDA
 * request, attempt 2 the retry.
 */
function fakeTransformers(behave: (attempt: number) => unknown) {
  const calls: Record<string, unknown>[] = [];
  const module = {
    env: {} as Record<string, unknown>,
    pipeline: async (_task: string, _model: string, options: Record<string, unknown>) => {
      calls.push(options);
      return behave(calls.length);
    },
  };
  return { module, calls };
}

/** A recogniser is callable: pipe(audio, options) -> result. */
const recogniser = () => async () => ({ text: 'amen', chunks: [] });

function serviceWith(module: unknown) {
  return createOnnxWhisperService({
    app: { getPath: () => root },
    importTransformers: async () => module,
  });
}

/** The opt-in as an operator would set it: variable plus a CUDA host. */
function requestCudaOnLinux() {
  vi.stubEnv('BSP_WHISPER_DEVICE', 'cuda');
  pretendPlatform('linux', 'x64');
}

describe('CUDA opt-in', () => {
  it('leaves the pipeline on the default device when the variable is unset', async () => {
    const { module, calls } = fakeTransformers(recogniser);
    const service = serviceWith(module);

    expect((await service.warmup()).ok).toBe(true);
    expect(calls).toHaveLength(1);
    expect('device' in calls[0]).toBe(false);
    expect(service.status().device).toBe('cpu');
  });

  it('requests device cuda when BSP_WHISPER_DEVICE=cuda on linux/x64', async () => {
    requestCudaOnLinux();
    const { module, calls } = fakeTransformers(recogniser);
    const service = serviceWith(module);

    await service.warmup();

    expect(calls[0].device).toBe('cuda');
    expect(service.status().ready).toBe(true);
    expect(service.status().device).toBe('cuda');
  });

  it('ignores the variable off linux/x64 rather than asking for an unsupported device', async () => {
    vi.stubEnv('BSP_WHISPER_DEVICE', 'cuda');
    pretendPlatform('darwin', 'x64');
    const { module, calls } = fakeTransformers(recogniser);
    const service = serviceWith(module);

    await service.warmup();

    expect('device' in calls[0]).toBe(false);
    expect(service.status().device).toBe('cpu');
  });
});

describe('CPU fallback', () => {
  async function warmWithFailingCuda() {
    requestCudaOnLinux();
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
    expect(calls[0].device).toBe('cuda');
    expect('device' in calls[1]).toBe(false);
    expect(service.status().ready).toBe(true);
    expect(service.status().device).toBe('cpu');
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
