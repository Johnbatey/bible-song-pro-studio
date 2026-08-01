#!/usr/bin/env node
const assert = require('assert');
const bible = require('../src/electron/bible-service.cjs');

const cases = [
  ['John 3 16', 'John 3:16'],
  ['Jn 3 16', 'John 3:16'],
  ['1Cor 13 4', '1 Corinthians 13:4'],
  ['First Corinthians chapter 13 verse 4', '1 Corinthians 13:4'],
  ['Genesis chapter 1 verse 16', 'Genesis 1:16'],
  ['Psalm 23 1', 'Psalms 23:1'],
  ['Rev 22 21', 'Revelation 22:21'],
];

for (const [query, expected] of cases) {
  const result = bible.search('KJV', query, 1)[0];
  assert(result, `Expected a result for "${query}"`);
  assert.strictEqual(result.reference, expected, `"${query}" resolved to ${result.reference}, expected ${expected}`);
}

const phraseResults = bible.search('KJV', 'Jesus said unto them', 20);
assert(phraseResults.length > 0, 'Expected phrase search results for "Jesus said unto them"');
assert(
  phraseResults.every((verse) => ['jesus', 'said', 'unto', 'them'].every((token) => String(`${verse.reference} ${verse.text}`).toLowerCase().includes(token))),
  'Phrase search should return verses containing every query token',
);

const faithResults = bible.search('KJV', 'faith', 20);
assert(faithResults.length > 0, 'Expected word search results for "faith"');
assert(
  faithResults.every((verse) => String(`${verse.reference} ${verse.text}`).toLowerCase().includes('faith')),
  'Word search should return verses containing the query word',
);

console.log(`Verified ${cases.length} Bible reference parsing cases plus phrase/word keyword search.`);
