'use strict';

// Installs the repository's git hooks.
//
//   node scripts/install-hooks.cjs
//
// Git hooks live in .git/hooks, which is not version-controlled, so a fresh clone
// has none. Run this once after cloning. The hook itself is a two-line shim that
// calls a tracked script, so the real logic stays reviewable in git.

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const HOOKS_DIR = path.join(REPO_ROOT, '.git', 'hooks');

const PRE_COMMIT = `#!/bin/sh
# Installed by scripts/install-hooks.cjs — edit scripts/check-bible-licensing.cjs instead.
exec node "$(git rev-parse --show-toplevel)/scripts/check-bible-licensing.cjs" --staged
`;

function main() {
  if (!fs.existsSync(HOOKS_DIR)) {
    console.error('No .git/hooks directory found — is this a git repository?');
    process.exit(1);
  }

  const target = path.join(HOOKS_DIR, 'pre-commit');
  fs.writeFileSync(target, PRE_COMMIT, { mode: 0o755 });
  fs.chmodSync(target, 0o755);
  console.log('installed .git/hooks/pre-commit -> scripts/check-bible-licensing.cjs');
}

if (require.main === module) main();
