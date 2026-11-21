/* =========================================================================
   setup-cuda-ep — the parts that can be proven without Linux or a GPU
   -------------------------------------------------------------------------
   The script itself refuses to run outside linux/x64, so this drives its
   exported steps directly: a wheel built in the test (the same layout PyPI
   serves, including which datasets are present), a fake node_modules with two
   onnxruntime-node copies, and the smoke-test model lookup that has to fall
   back when the wheel moves a dataset.

   What this cannot prove is the CUDA provider loading — that needs the real
   wheel and a driver, and is exactly what `npm run setup:cuda` checks on the
   Linux machine.
   ========================================================================= */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createRequire } from 'module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import JSZip from 'jszip';

const require = createRequire(import.meta.url);
const script = require('../../scripts/setup-cuda-ep.cjs');

const VERSION = '1.21.0';
const WHEEL_NAME = 'onnxruntime_gpu-1.21.0-cp310-cp310-manylinux_2_28_x86_64.whl';
let root: string;

beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'setup-cuda-ep-test-'));
});

afterAll(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

/** A wheel-shaped zip: the three libraries, plus only the datasets asked for. */
async function makeWheel(name: string, datasets: string[]): Promise<string> {
  const zip = new JSZip();
  for (const file of script.requiredFiles(VERSION)) {
    zip.file(`onnxruntime/capi/${file}`, `fake ${file}`);
  }
  for (const entry of datasets) zip.file(entry, `fake ${entry}`);
  const wheel = path.join(root, name);
  fs.writeFileSync(wheel, await zip.generateAsync({ type: 'nodebuffer' }));
  return wheel;
}

describe('setup-cuda-ep extraction', () => {
  it('extracts the libraries and the datasets this wheel carries', async () => {
    const wheel = await makeWheel('two-datasets.whl', [
      script.SMOKE_MODELS[1],
      script.SMOKE_MODELS[2],
    ]);
    const libs = path.join(root, 'libs-two');

    script.extractWheel(wheel, libs);

    for (const file of script.requiredFiles(VERSION)) {
      expect(fs.readFileSync(path.join(libs, file), 'utf8')).toBe(`fake ${file}`);
    }
    expect(fs.existsSync(path.join(libs, 'sigmoid.onnx'))).toBe(true);
    expect(fs.existsSync(path.join(libs, 'logreg_iris.onnx'))).toBe(true);
    expect(fs.existsSync(path.join(libs, 'mul_1.onnx'))).toBe(false);
  });

  it('does not fail when the wheel carries no dataset at all', async () => {
    const wheel = await makeWheel('no-datasets.whl', []);
    const libs = path.join(root, 'libs-none');

    script.extractWheel(wheel, libs);

    expect(fs.existsSync(path.join(libs, `libonnxruntime.so.${VERSION}`))).toBe(true);
    expect(script.smokeModel(libs)).toBeNull();
  });
});

describe('setup-cuda-ep smoke-test model fallback', () => {
  it('prefers mul_1 when the wheel has it', async () => {
    const libs = path.join(root, 'libs-all');
    script.extractWheel(await makeWheel('all-datasets.whl', [...script.SMOKE_MODELS]), libs);

    expect(script.smokeModel(libs)).toBe(path.join(libs, 'mul_1.onnx'));
  });

  it('falls back to sigmoid when mul_1 is missing', async () => {
    const libs = path.join(root, 'libs-sigmoid');
    script.extractWheel(await makeWheel('sigmoid-only.whl', [script.SMOKE_MODELS[1]]), libs);

    expect(script.smokeModel(libs)).toBe(path.join(libs, 'sigmoid.onnx'));
  });

  it('falls back to logreg_iris when it is the only dataset left', async () => {
    const libs = path.join(root, 'libs-iris');
    script.extractWheel(await makeWheel('iris-only.whl', [script.SMOKE_MODELS[2]]), libs);

    expect(script.smokeModel(libs)).toBe(path.join(libs, 'logreg_iris.onnx'));
  });
});

describe('setup-cuda-ep copying into onnxruntime-node', () => {
  it('finds both installations and copies the libraries into each bin directory', async () => {
    const project = path.join(root, 'project');
    const copies = [
      path.join(project, 'node_modules', 'onnxruntime-node'),
      path.join(
        project,
        'node_modules',
        '@huggingface',
        'transformers',
        'node_modules',
        'onnxruntime-node',
      ),
    ];
    for (const directory of copies) {
      fs.mkdirSync(directory, { recursive: true });
      fs.writeFileSync(
        path.join(directory, 'package.json'),
        JSON.stringify({
          name: 'onnxruntime-node',
          version: VERSION,
          binary: { napi_versions: [3] },
        }),
      );
    }

    const found = script.findOrtPackages(project);
    expect(found).toHaveLength(2);
    expect([...found].sort()).toEqual([...copies].sort());

    const libs = path.join(root, 'libs-copy');
    script.extractWheel(await makeWheel('copy.whl', [...script.SMOKE_MODELS]), libs);

    for (const directory of found) {
      const bin = script.binDirectory(directory);
      expect(bin.endsWith(path.join('bin', 'napi-v3', 'linux', 'x64'))).toBe(true);

      script.copyLibraries(bin, libs, VERSION);

      for (const file of script.requiredFiles(VERSION)) {
        expect(fs.readFileSync(path.join(bin, file), 'utf8')).toBe(`fake ${file}`);
      }
    }
  });
});

describe('setup-cuda-ep wheel selection', () => {
  it('never picks the .whl.metadata sidecar over the wheel', () => {
    const chosen = script.selectWheel({
      urls: [
        { filename: `${WHEEL_NAME}.metadata`, digests: { sha256: 'sidecar' } },
        { filename: WHEEL_NAME, digests: { sha256: 'wheel' } },
      ],
    });

    expect(chosen.filename).toBe(WHEEL_NAME);
  });
});
