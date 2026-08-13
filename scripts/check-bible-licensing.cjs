'use strict';

// Licensing guard for bundled scripture.
//
//   node scripts/check-bible-licensing.js            # check the working tree
//   node scripts/check-bible-licensing.js --staged   # check what is about to be committed
//
// Installed as a pre-commit hook by scripts/install-hooks.js, and safe to run in CI.
//
// Bible Song Pro bundles public-domain scripture only. Copyrighted translations
// (NIV, NKJV, NLT, NASB, ESV, and friends) are obtained by the user through the
// app's import feature — they are never redistributed here. That rule is easy to
// state and easy to forget at 1am before a release, so it is enforced.
//
// A size threshold would not work: the built bibles/*.js files are legitimately
// ~4.5 MB each. So this is an explicit allowlist of vetted translations, plus a
// denylist of translation codes that must never appear anywhere in the tree.

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Vetted: public domain, 66-book Protestant canon, provenance recorded in BIBLES.md.
// Adding to this list is a deliberate act — see BIBLES.md before you do.
const ALLOWED_TRANSLATIONS = new Set(['ASV', 'Darby', 'KJV', 'LSG', 'OST', 'RV1909', 'YLT']);

// Copyrighted. Never in this repository, in any file name, in any form.
const FORBIDDEN_CODES = [
  'NIV', 'NKJV', 'NLT', 'NASB', 'ESV', 'MSG', 'AMP', 'AMPC', 'NRSV', 'RSV',
  'CSB', 'HCSB', 'NCV', 'TLB', 'TPT', 'GNT', 'CEV', 'NET', 'NIrV', 'ERV',
  /* Versión Biblia Libre. Free to redistribute, but © 2018-2020 Jonathan
     Gallagher y Shelly Barrios de Avila — not public domain, which is the bar
     this project holds to. A settings mockup once advertised it as a Spanish
     download; RV1909 is the public-domain Spanish text that shipped instead. */
  'VBL',
  /* La Bible Ostervald 1996 is a modern revision under copyright (Société
     Biblique de Genève). The `OST` that ships here is eBible's `fra_fob`, the
     public-domain Ostervald, and the two must not be confused. */
  'OST1996', 'OSTERVALD1996',
];

const REPO_ROOT = path.join(__dirname, '..');
const problems = [];

function listFiles(stagedOnly) {
  const command = stagedOnly
    ? 'git diff --cached --name-only --diff-filter=ACMR'
    : 'git ls-files';
  try {
    return execSync(command, { cwd: REPO_ROOT, encoding: 'utf8' })
      .split('\n').map(s => s.trim()).filter(Boolean);
  } catch (error) {
    return [];
  }
}

function baseName(filePath) {
  return path.basename(filePath).replace(/\.(js|xml|json)$/i, '');
}

function check(files) {
  for (const file of files) {
    const name = baseName(file);

    // A forbidden code anywhere in the path, as a whole word.
    for (const code of FORBIDDEN_CODES) {
      const pattern = new RegExp(`(^|[^A-Za-z])${code}([^A-Za-z]|$)`, 'i');
      if (pattern.test(file)) {
        problems.push(`${file}\n      "${code}" is a copyrighted translation and must not be committed.`);
        break;
      }
    }

    // Anything living in bibles/ must be a vetted translation or known scaffolding.
    if (/^assets\/bibles\//.test(file)) {
      const isScaffolding = ['manifest', 'README', 'BIBLES'].includes(name);
      if (!isScaffolding && !ALLOWED_TRANSLATIONS.has(name)) {
        problems.push(`${file}\n      "${name}" is not in ALLOWED_TRANSLATIONS. ` +
          'Confirm it is public domain and 66-book canon, record it in BIBLES.md, then add it here.');
      }
    }
  }
}

function main() {
  const stagedOnly = process.argv.includes('--staged');
  check(listFiles(stagedOnly));

  // Belt and braces: the working tree should not hold copyrighted files even
  // untracked, because a hurried `git add -A` would sweep them in.
  const biblesDir = path.join(REPO_ROOT, 'assets', 'bibles');
  if (fs.existsSync(biblesDir)) {
    const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
      const full = path.join(dir, entry.name);
      return entry.isDirectory() ? walk(full) : [path.relative(REPO_ROOT, full)];
    });
    for (const file of walk(biblesDir)) {
      const name = baseName(file);
      if (!['manifest', 'README', 'BIBLES'].includes(name) && !ALLOWED_TRANSLATIONS.has(name)) {
        problems.push(`${file} (untracked or ignored)\n      unvetted translation present in bibles/.`);
      }
    }
  }

  if (problems.length) {
    console.error('\n  Bible licensing check FAILED\n');
    for (const problem of problems) console.error(`    - ${problem}\n`);
    console.error('  Bible Song Pro bundles public-domain scripture only.');
    console.error('  Copyrighted translations reach users through the in-app import, not this repo.\n');
    process.exit(1);
  }

  console.log(`Bible licensing check passed (allowed: ${[...ALLOWED_TRANSLATIONS].join(', ')}).`);
}

if (require.main === module) main();

module.exports = { ALLOWED_TRANSLATIONS, FORBIDDEN_CODES };
