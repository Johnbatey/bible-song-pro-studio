const { spawn } = require('node:child_process');
const http = require('node:http');

const host = '127.0.0.1';
const port = 5173;
const baseUrl = `http://${host}:${port}`;

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: false,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '' },
      ...options,
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} exited with ${code}`));
    });
  });
}

function waitForServer(deadlineMs = 15000) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(baseUrl, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() - startedAt > deadlineMs) {
          reject(new Error(`Timed out waiting for ${baseUrl}`));
          return;
        }
        setTimeout(tick, 250);
      });
      req.setTimeout(1000, () => {
        req.destroy();
      });
    };
    tick();
  });
}

function startViteServer() {
  const server = spawn('npm', ['run', 'dev', '--', '--host', host], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
  });
  let ready = false;
  let exited = false;
  let exitCode = null;
  let stderrTail = '';
  let stdoutTail = '';

  server.stdout.on('data', (chunk) => {
    const text = chunk.toString();
    stdoutTail = (stdoutTail + text).slice(-4000);
    if (/VITE v[\s\S]*ready in/i.test(stdoutTail)) ready = true;
    process.stdout.write(chunk);
  });
  server.stderr.on('data', (chunk) => {
    const text = chunk.toString();
    stderrTail = (stderrTail + text).slice(-4000);
    process.stderr.write(chunk);
  });
  server.on('exit', (code) => {
    exited = true;
    exitCode = code;
  });

  const waitUntilReady = async () => {
    const startedAt = Date.now();
    while (!ready) {
      if (exited) {
        throw new Error(`Vite dev server exited before verification started with code ${exitCode}.${stderrTail ? `\n${stderrTail}` : ''}`);
      }
      if (Date.now() - startedAt > 15000) {
        throw new Error(`Timed out waiting for this Vite process to become ready.${stdoutTail ? `\n${stdoutTail}` : ''}${stderrTail ? `\n${stderrTail}` : ''}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    await waitForServer(3000);
  };

  const stop = () => {
    if (!exited) server.kill('SIGTERM');
  };

  return { waitUntilReady, stop };
}

async function main() {
  const server = startViteServer();

  try {
    await server.waitUntilReady();
    await run('npm', ['run', 'verify:program-surface']);
    await run('npm', ['run', 'verify:audience-display']);
    await run('npm', ['run', 'verify:display-parity']);
    await run('npm', ['run', 'verify:operator-layout']);
    await run('npm', ['run', 'verify:mode-switch']);
  } finally {
    server.stop();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
