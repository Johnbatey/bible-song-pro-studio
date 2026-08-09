'use strict';

// Tests for the 66-book canon guard.
//
//   node scripts/test-bible-canon.js
//
// Exits non-zero on failure, so it drops straight into CI. The rejection cases
// matter more than the acceptance ones: a guard that never says no is not a guard.

const fs = require('fs');
const path = require('path');
const canon = require('./bible-canon.cjs');

const SOURCE_DIR = path.join(__dirname, '..', 'assets', 'bibles');
const canonical = canon.CANON.map(names => names[0]);

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ok    ${name}`);
    passed += 1;
  } catch (error) {
    console.log(`  FAIL  ${name}\n        ${String(error.message).split('\n')[0]}`);
    failed += 1;
  }
}

function expectAccepted(bookNames) {
  const result = canon.checkProtestantCanon(bookNames);
  if (!result.ok) throw new Error(`expected acceptance, got: ${result.errors.join('; ')}`);
}

function expectRejected(bookNames, expectedFragment) {
  const result = canon.checkProtestantCanon(bookNames);
  if (result.ok) throw new Error('expected rejection, was accepted');
  if (!result.errors.join(' ').includes(expectedFragment)) {
    throw new Error(`expected "${expectedFragment}", got: ${result.errors.join('; ')}`);
  }
}

console.log('\nBundled translations');
if (fs.existsSync(SOURCE_DIR)) {
  // The desktop app stores each bible as { "Genesis": { "1": { "1": "text" } } },
  // so the book names are simply the top-level keys.
  const bundled = fs.readdirSync(SOURCE_DIR).filter(name => name.toLowerCase().endsWith('.json'));
  if (!bundled.length) console.log('  (none present)');
  for (const fileName of bundled) {
    test(fileName, () => {
      const data = JSON.parse(fs.readFileSync(path.join(SOURCE_DIR, fileName), 'utf8'));
      expectAccepted(Object.keys(data));
    });
  }
} else {
  console.log('  (assets/bibles not present)');
}

console.log('\nAccepts legitimate spelling variants');
test('roman numerals — I / II Samuel', () =>
  expectAccepted(canonical.map(b => b.replace(/^1 /, 'I ').replace(/^2 /, 'II ').replace(/^3 /, 'III '))));
test('First / Second wording', () =>
  expectAccepted(canonical.map(b => b.replace(/^1 /, 'First ').replace(/^2 /, 'Second ').replace(/^3 /, 'Third '))));
test('numbered with a period — 1. Samuel', () =>
  expectAccepted(canonical.map(b => b.replace(/^(\d) /, '$1. '))));
test('Psalm singular and Song of Songs', () =>
  expectAccepted(canonical.map(b => (b === 'Psalms' ? 'Psalm' : b === 'Song of Solomon' ? 'Song of Songs' : b))));
test('Revelation of John', () =>
  expectAccepted(canonical.map(b => (b === 'Revelation' ? 'Revelation of John' : b))));
test('Acts of the Apostles', () =>
  expectAccepted(canonical.map(b => (b === 'Acts' ? 'Acts of the Apostles' : b))));

console.log('\nRejects');
test('Tobit', () => expectRejected([...canonical, 'Tobit'], 'Apocrypha'));
test('Ecclesiasticus', () => expectRejected([...canonical, 'Ecclesiasticus'], 'Apocrypha'));
test('Wisdom of Solomon', () => expectRejected([...canonical, 'Wisdom of Solomon'], 'Apocrypha'));
test('1 Maccabees', () => expectRejected([...canonical, '1 Maccabees'], 'Apocrypha'));
test('Bel and the Dragon', () => expectRejected([...canonical, 'Bel and the Dragon'], 'Apocrypha'));
test('Prayer of Manasseh', () => expectRejected([...canonical, 'Prayer of Manasseh'], 'Apocrypha'));
test('a missing book', () => expectRejected(canonical.slice(0, 65), 'missing'));
test('a duplicated book', () => expectRejected([...canonical, 'Genesis'], 'duplicate'));
test('an unrecognised book', () => expectRejected([...canonical, 'Gospel of Thomas'], 'unrecognised'));
test('an empty file', () => expectRejected([], 'missing'));

console.log('\nNear misses — these must NOT trip the Apocrypha check');
test('Habakkuk is not Baruch', () => expectAccepted(canonical));
test('Esther is not Additions to Esther', () => expectAccepted(canonical));
test('assertProtestantCanon throws on bad input', () => {
  let threw = false;
  try { canon.assertProtestantCanon(['Genesis'], 'fixture'); } catch (e) { threw = true; }
  if (!threw) throw new Error('assertProtestantCanon did not throw');
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
