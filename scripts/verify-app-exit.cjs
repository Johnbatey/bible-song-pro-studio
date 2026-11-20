/* ── The real app must end its process when the main window closes (#24) ───
 *
 * verify:shutdown stubs electron, so it proves the teardown logic but not that a
 * real Electron process on a real desktop actually goes away. This launches the
 * built app the way a user does, so the window, the servers, the NDI service and
 * the single-instance lock are all real.
 *
 * scripts/verify-app-exit-probe.cjs is the entry it launches: it boots the real
 * main process, opens a stage designer through the panel's bridge, hides it
 * (leaving the prewarmed window that used to survive), closes the main window,
 * and then does nothing — the app has to exit by itself. That script is the only
 * test code involved; src/electron carries none. The harness fails if the
 * process is still alive at the timeout, and insists the probe's own log lines
 * appeared so a crash during startup cannot be mistaken for a clean shutdown.
 *
 * A runner with no interactive desktop is reported as such: Electron starts, its
 * main window never comes up, and the check says the runner was headless instead
 * of dressing that up as the leak #24 reported. BSP_CI_REQUIRE_DESKTOP=1 turns
 * it back into a failure for a runner that is supposed to have a desktop.
 *
 * A probe that cannot arrange the ordering it tests — the prewarm callback it
 * holds by name has been renamed, say — is reported as a broken test setup, not
 * as the leak, because a change inside main.cjs must not read as a shutdown bug.
 *
 * Windows is where this went wrong, but the mechanism is the same everywhere:
 * run it locally with BSP_CI_SHUTDOWN_EXPECT_QUIT=1 to exercise the pass path on
 * macOS, which keeps the app alive by design when its last window closes.
 * BSP_CI_SIMULATE_WIN32=1 takes the app's own Windows teardown on the host
 * instead, which is where the survivor assertion below can fire.
 * ────────────────────────────────────────────────────────────────────────── */
'use strict';

const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');

const electronBinary = require('electron'); // a path to the binary under plain Node
const projectRoot = path.join(__dirname, '..');
const probeEntry = path.join('scripts', 'verify-app-exit-probe.cjs');
/* The app writes settings and session history under userData; a launch from
   this script must not land in the operator's real profile. */
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'bsp-app-exit-'));
process.on('exit', () => {
  try { fs.rmSync(userData, { recursive: true, force: true }); } catch (_) {}
});
const timeoutMs = Number(process.env.BSP_CI_SHUTDOWN_TIMEOUT_MS) || 90000;
const probeDelayMs = Number(process.env.BSP_CI_SHUTDOWN_DELAY_MS) || 4000;

const EXPECTED_LINES = [
  '[CI] shutdown probe armed',
  '[CI] stage designer opened and hidden (prewarmed)',
  '[CI] closing main window',
];

function fail(message, output) {
  console.error('✗ ' + message);
  if (output) console.error('--- app output ---\n' + output.trim().slice(-4000));
  process.exit(1);
}

/* Windows is the only platform here whose session can be non-interactive, and a
   service session has no desktop to put a window on. Positively identified, so a
   crash during startup on a machine that does have a desktop stays a failure. */
function headlessEvidence() {
  if (process.platform !== 'win32') return null;
  const session = String(process.env.SESSIONNAME || '').trim();
  if (!session) return 'SESSIONNAME is not set, so this process has no interactive desktop';
  if (/^services?$/i.test(session)) return `SESSIONNAME is "${session}", the non-interactive service session`;
  return null;
}

function reportHeadless(reason, output) {
  console.warn('::warning::Headless runner: the Windows shutdown check needs an interactive desktop, and this machine has none.');
  console.warn('Headless runner: this check needs an interactive desktop, and this machine has none.');
  console.warn('  evidence: ' + reason);
  console.warn('  the app never reached its main window, so no shutdown behaviour was tested here.');
  console.warn('  run this on a runner with a desktop session, or set BSP_CI_REQUIRE_DESKTOP=1 to fail instead.');
  if (output) console.warn('--- app output ---\n' + output.trim().slice(-2000));
  if (process.env.GITHUB_STEP_SUMMARY) {
    try {
      fs.appendFileSync(
        process.env.GITHUB_STEP_SUMMARY,
        '### Windows shutdown (#24)\n\n'
        + '**Skipped: headless runner.** ' + reason + '. The app never reached its main window, '
        + 'so no shutdown behaviour was tested here.\n',
      );
    } catch (_) {}
  }
  process.exit(0);
}

(async () => {
  console.log('Launching the app and closing its main window; the process must exit on its own...');

  const child = spawn(electronBinary, ['--disable-gpu', `--user-data-dir=${userData}`, probeEntry], {
    cwd: projectRoot,
    env: {
      ...process.env,
      BSP_CI_SHUTDOWN_DELAY_MS: String(probeDelayMs),
      ELECTRON_ENABLE_LOGGING: '1',
      /* Never inherit a harness value from the shell: CI must test the app's own
         quit, not a forced one. */
      BSP_CI_SHUTDOWN_EXPECT_QUIT: process.env.BSP_CI_SHUTDOWN_EXPECT_QUIT === '1' ? '1' : '0',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { output += chunk.toString(); });

  const exit = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ timedOut: true }), timeoutMs);
    child.on('exit', (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal, timedOut: false });
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ error: err, timedOut: false });
    });
  });

  if (exit.timedOut) {
    try { child.kill('SIGKILL'); } catch (_) {}
  }
  if (exit.error) fail('could not launch the app: ' + exit.error.message, output);

  /* The probe arms once the main window is up, so its absence means the app
     never got a window at all — the headless case, or a real startup failure. */
  if (!output.includes('[CI] shutdown probe armed')) {
    const headless = headlessEvidence();
    if (headless && process.env.BSP_CI_REQUIRE_DESKTOP !== '1') reportHeadless(headless, output);
    if (exit.timedOut) fail(`the process was still running ${Math.round(timeoutMs / 1000)}s and never opened its main window`, output);
    fail(`the app never opened its main window (exit code ${exit.code}, signal ${exit.signal || 'none'})`, output);
  }

  if (exit.timedOut) {
    fail(`the process was still running ${Math.round(timeoutMs / 1000)}s after the main window closed`, output);
  }

  /* The probe says what failed before anything is inferred from missing lines:
     a probe that could not arrange its own ordering has tested nothing about
     shutdown, and must not be reported as the app failing to close. */
  const probeLine = (needle) => output.split('\n').find((line) => line.includes(needle)) || null;
  const setupFailure = probeLine('[CI] shutdown probe setup failed');
  if (setupFailure) {
    console.error('::error::The shutdown check could not be set up, so this run says nothing about shutdown.');
    fail('the check could not be set up, so nothing about shutdown was tested: '
      + setupFailure.replace(/^.*\[CI\] shutdown probe setup failed:\s*/, ''), output);
  }

  const probeFailure = probeLine('[CI] shutdown probe failed');
  if (probeFailure) fail(probeFailure.trim(), output);

  const missing = EXPECTED_LINES.filter((line) => !output.includes(line));
  if (missing.length) fail('the app never reached: ' + missing.join(' | '), output);
  if (output.includes('[Shutdown] Window teardown failed')) fail('window teardown logged an error', output);
  if (exit.code !== 0) fail(`the app exited with code ${exit.code} (signal ${exit.signal || 'none'})`, output);

  console.log('✓ The app closed every window and the process exited 0 after the main window closed.');
})();
