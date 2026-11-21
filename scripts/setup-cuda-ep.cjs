#!/usr/bin/env node
'use strict';

/**
 * Installs ONNX Runtime's CUDA execution provider into the local onnxruntime-node
 * package(s), without the GitHub release asset that the 1.21.0 installer depends on.
 *
 * It downloads the onnxruntime-gpu wheel at the exact installed onnxruntime-node
 * version from PyPI (SHA-256 checked against PyPI metadata), copies the CUDA
 * provider libraries into every local onnxruntime-node installation:
 *
 *   node_modules/onnxruntime-node/bin/napi-v3/linux/x64/
 *   node_modules/@huggingface/transformers/node_modules/onnxruntime-node/bin/napi-v3/linux/x64/
 *
 * and then proves the provider loads by creating an InferenceSession with it.
 *
 *   npm run setup:cuda              install and smoke-test
 *   npm run setup:cuda -- --check   verify files and dependency links, download nothing
 *
 * No-ops on any platform other than linux/x64.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const https = require('node:https');
const crypto = require('node:crypto');
const { execFileSync, spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const CACHE_DIR = path.join(os.tmpdir(), 'ort-gpu-wheel');
const CHECK_ONLY = process.argv.includes('--check');
const PROVIDER_FILES = ['libonnxruntime_providers_cuda.so', 'libonnxruntime_providers_shared.so'];

// Test models shipped inside the onnxruntime-gpu wheel, so the smoke test needs
// no extra download and no model from this repository. All three are in the
// 1.21.0 wheel; they are tried in order so that one moved or renamed dataset
// cannot fail an otherwise good install.
const SMOKE_MODELS = [
  'onnxruntime/datasets/mul_1.onnx',
  'onnxruntime/datasets/sigmoid.onnx',
  'onnxruntime/datasets/logreg_iris.onnx',
];

function log(...args) {
  console.log('[setup-cuda-ep]', ...args);
}
function warn(...args) {
  console.warn('[setup-cuda-ep]', ...args);
}
function fail(message) {
  console.error(`[setup-cuda-ep] ${message}`);
  process.exit(1);
}

function get(url, redirects = 5) {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      { headers: { 'user-agent': 'bible-song-pro-studio-setup-cuda-ep' } },
      (response) => {
        const status = response.statusCode || 0;
        if (status >= 300 && status < 400 && response.headers.location) {
          response.resume();
          if (redirects <= 0) {
            reject(new Error(`too many redirects for ${url}`));
            return;
          }
          resolve(get(new URL(response.headers.location, url).toString(), redirects - 1));
          return;
        }
        if (status !== 200) {
          response.resume();
          reject(new Error(`HTTP ${status} for ${url}`));
          return;
        }
        resolve(response);
      },
    );
    request.on('error', reject);
  });
}

async function getJson(url) {
  const response = await get(url);
  const chunks = [];
  for await (const chunk of response) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function download(url, destination) {
  await fs.promises.mkdir(path.dirname(destination), { recursive: true });
  const response = await get(url);
  const partial = `${destination}.part`;
  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(partial);
    response.pipe(output);
    output.on('finish', resolve);
    output.on('error', reject);
    response.on('error', reject);
  });
  await fs.promises.rename(partial, destination);
}

function sha256(file) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    fs.createReadStream(file)
      .on('data', (chunk) => hash.update(chunk))
      .on('end', () => resolve(hash.digest('hex')))
      .on('error', reject);
  });
}

function selectWheel(release) {
  // PyPI lists a "*.whl.metadata" sidecar next to each wheel; only take real wheels.
  return (
    (release.urls || []).find(
      (entry) =>
        entry.filename.endsWith('.whl') &&
        entry.filename.includes('manylinux') &&
        entry.filename.includes('x86_64'),
    ) || null
  );
}

/** Every onnxruntime-node under node_modules (top level, nested, scoped). */
function findOrtPackages(root) {
  const nodeModules = path.join(root, 'node_modules');
  const found = new Set();

  const add = (directory) => {
    const packageJson = path.join(directory, 'package.json');
    if (!fs.existsSync(packageJson)) return;
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJson, 'utf8'));
      if (pkg.name === 'onnxruntime-node') found.add(directory);
    } catch {
      /* ignore malformed package.json */
    }
  };

  add(path.join(nodeModules, 'onnxruntime-node'));

  const scan = (base) => {
    let entries = [];
    try {
      entries = fs.readdirSync(base, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const directory = path.join(base, entry.name);
      if (entry.name.startsWith('@')) {
        scan(directory); // @scope/<pkg>/node_modules/onnxruntime-node
        continue;
      }
      add(path.join(directory, 'node_modules', 'onnxruntime-node'));
    }
  };

  scan(nodeModules);
  return [...found];
}

function binDirectory(ortDirectory) {
  let napiVersion = 3;
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(ortDirectory, 'package.json'), 'utf8'));
    const fromPackage = pkg && pkg.binary && pkg.binary.napi_versions;
    if (Array.isArray(fromPackage) && fromPackage.length > 0) napiVersion = fromPackage[0];
  } catch {
    /* fall back to napi-v3 */
  }
  return path.join(ortDirectory, 'bin', `napi-v${napiVersion}`, 'linux', 'x64');
}

function extractWheel(wheelPath, outputDirectory) {
  fs.rmSync(outputDirectory, { recursive: true, force: true });
  fs.mkdirSync(outputDirectory, { recursive: true });
  try {
    execFileSync(
      'unzip',
      ['-o', '-j', wheelPath, 'onnxruntime/capi/libonnxruntime*.so*', '-d', outputDirectory],
      { stdio: 'inherit' },
    );
  } catch (error) {
    fail(
      `could not extract ${path.basename(wheelPath)}: ${error.message}. Install "unzip" and retry.`,
    );
  }

  // The test models are optional as a group — the smoke test uses whichever one
  // this wheel ships — so a miss is a note, not a failure. The library
  // extraction above has already proved that unzip works and the wheel opens.
  for (const entry of SMOKE_MODELS) {
    try {
      execFileSync('unzip', ['-o', '-j', wheelPath, entry, '-d', outputDirectory], {
        stdio: 'ignore',
      });
    } catch {
      warn(`${path.basename(wheelPath)} does not contain ${entry}`);
    }
  }
}

function copyLibraries(targetDirectory, libsDirectory, version) {
  const names = [`libonnxruntime.so.${version}`, ...PROVIDER_FILES];
  const missing = names.filter((name) => !fs.existsSync(path.join(libsDirectory, name)));
  if (missing.length > 0) fail(`wheel is missing ${missing.join(', ')}`);

  fs.mkdirSync(targetDirectory, { recursive: true });
  for (const name of names) {
    fs.copyFileSync(path.join(libsDirectory, name), path.join(targetDirectory, name));
  }
}

function verify(targetDirectory, version) {
  const required = [`libonnxruntime.so.${version}`, ...PROVIDER_FILES];
  const missing = required.filter((name) => {
    const file = path.join(targetDirectory, name);
    return !fs.existsSync(file) || fs.statSync(file).size === 0;
  });
  if (missing.length > 0) fail(`missing in ${targetDirectory}: ${missing.join(', ')}`);

  const ldd = spawnSync('ldd', [path.join(targetDirectory, 'libonnxruntime_providers_cuda.so')], {
    encoding: 'utf8',
  });
  if (ldd.error) {
    warn(`could not run ldd (${ldd.error.code || ldd.error.message}); skipping dependency check`);
    return;
  }

  const unresolved = (ldd.stdout || '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.includes('not found'));

  if (unresolved.length === 0) {
    log('all CUDA provider dependencies resolve');
    return;
  }

  warn('provider libraries are installed but some dependencies do not resolve:');
  for (const line of unresolved) warn(`  ${line}`);

  const looksLikeCuda11Build = unresolved.some(
    (line) => /\.so\.11\b/.test(line) || /libcudnn\.so\.8\b/.test(line),
  );
  if (looksLikeCuda11Build) {
    warn('this looks like the known 1.21.0 CUDA-11-linked build, not a missing driver.');
    warn('there is no corrected 1.21.0 binary to download: the GitHub asset 404s and this wheel predates the rebuild.');
    warn('either build ONNX Runtime 1.21.0 against CUDA 12, or upgrade @huggingface/transformers to move onnxruntime-node forward.');
  } else {
    warn('install CUDA 12.8+ and cuDNN 9.x (or use an image that has them) and put them on LD_LIBRARY_PATH.');
  }
}

/**
 * Proves the provider actually loads: creates a session that may only use CUDA.
 * ONNX Runtime reports a provider that cannot be loaded as an exception here,
 * so a failure is the same error the application would hit.
 */
async function smokeTest(ortDirectory, modelPath) {
  const ort = require(ortDirectory);
  const model = fs.readFileSync(modelPath);

  let session;
  try {
    session = await ort.InferenceSession.create(model, { executionProviders: ['cuda'] });
  } catch (error) {
    fail(
      `CUDA EP smoke test failed for ${path.relative(ROOT, ortDirectory)} using ${path.basename(modelPath)}: ${error.message}`,
    );
  }

  const providers = session.executionProviders;
  const reported = Array.isArray(providers) ? providers.join(', ') : 'not reported';
  if (
    Array.isArray(providers) &&
    !providers.some((name) => String(name).toLowerCase().includes('cuda'))
  ) {
    fail(`session was created without the CUDA provider (providers: ${reported})`);
  }

  log(`smoke test passed: session created (providers: ${reported})`);
}

(async () => {
  if (process.platform !== 'linux' || process.arch !== 'x64') {
    log(`skipping: CUDA binaries are only published for linux/x64 (this is ${process.platform}/${process.arch})`);
    return;
  }

  const targets = findOrtPackages(ROOT);
  if (targets.length === 0) fail('no onnxruntime-node installation found — run `npm ci` first.');

  const byVersion = new Map();
  for (const directory of targets) {
    const { version } = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
    if (!byVersion.has(version)) byVersion.set(version, []);
    byVersion.get(version).push(directory);
  }

  for (const [version, directories] of byVersion) {
    const binDirectories = directories.map(binDirectory);
    log(`onnxruntime-node@${version}: ${directories.length} installation(s)`);

    if (CHECK_ONLY) {
      for (const directory of binDirectories) verify(directory, version);
      continue;
    }

    let release;
    try {
      release = await getJson(`https://pypi.org/pypi/onnxruntime-gpu/${version}/json`);
    } catch (error) {
      fail(`cannot read onnxruntime-gpu ${version} from PyPI: ${error.message}`);
    }

    const wheel = selectWheel(release);
    if (!wheel) fail(`onnxruntime-gpu ${version} has no Linux x86_64 wheel on PyPI`);

    const wheelPath = path.join(CACHE_DIR, wheel.filename);
    const digest = wheel.digests && wheel.digests.sha256;
    const cached = fs.existsSync(wheelPath);

    if (!cached || (digest && (await sha256(wheelPath)) !== digest)) {
      if (cached) warn('cached wheel does not match the PyPI digest; downloading again');
      log(`downloading ${wheel.filename} (${(wheel.size / 1024 / 1024).toFixed(1)} MiB)`);
      await download(wheel.url, wheelPath);
      if (digest && (await sha256(wheelPath)) !== digest) {
        fail(`checksum mismatch for ${wheel.filename}`);
      }
    }

    const libsDirectory = path.join(CACHE_DIR, `libs-${version}`);
    extractWheel(wheelPath, libsDirectory);

    for (const directory of binDirectories) {
      copyLibraries(directory, libsDirectory, version);
      verify(directory, version);
      log(`installed into ${path.relative(ROOT, directory)}`);
    }

    const modelPath = SMOKE_MODELS.map((entry) =>
      path.join(libsDirectory, path.basename(entry)),
    ).find((file) => fs.existsSync(file));
    if (!modelPath) {
      fail(
        `onnxruntime-gpu ${version} ships none of ${SMOKE_MODELS.join(', ')}, so the CUDA EP cannot be smoke-tested`,
      );
    }
    await smokeTest(directories[0], modelPath);
  }

  log('done. Restart the app, then run the model check (e.g. `npm run verify:local-models`).');
  log('note: `npm ci` recreates node_modules — re-run `npm run setup:cuda` after every install.');
})().catch((error) => fail(error.message || String(error)));
