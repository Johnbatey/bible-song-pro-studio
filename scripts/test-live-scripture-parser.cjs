const assert = require('node:assert/strict');
const { createVerseDetectionService } = require('../src/electron/verse-detection-service.cjs');

const service = createVerseDetectionService();
const options = { versionId: 'KJV', modes: ['direct'], limit: 3, minConfidence: 0.3 };
const fixtures = [
  ['John chapter three verse sixteen', 'John 3:16'],
  ['please turn with me to first Corinthians chapter thirteen verse four', '1 Corinthians 13:4'],
  ['Romans eight twenty eight', 'Romans 8:28'],
  ['romance chapter eight verse twenty eight', 'Romans 8:28'],
  ['jhon three sixteen', 'John 3:16'],
  ['fill him on chapter one verse six', 'Philemon 1:6'],
  ['Habacuc chapter two verse four', 'Habakkuk 2:4'],
  ['Juan capitulo tres versiculo dieciseis', 'John 3:16'],
  ['Jean chapitre trois verset seize', 'John 3:16'],
  ['John chapter three verse twenty and eight', 'John 3:28'],
  ['Romans chapter eight verses twenty eight to thirty', 'Romans 8:28-30'],

  /* Spanish and French by book name, not by phonetic luck. "Juan" and "Jean"
     above resolve because they sound like "John"; nothing sounds "Salmos" into
     "Psalms" or "Apocalipsis" into "Revelation" — those need the native names
     carried in ALL_BOOKS. */
  ['Génesis capítulo uno versículo uno', 'Genesis 1:1'],
  ['Salmos capítulo veintitrés versículo uno', 'Psalms 23:1'],
  ['Apocalipsis capítulo veintiuno versículo cuatro', 'Revelation 21:4'],
  ['San Mateo capítulo cinco versículo nueve', 'Matthew 5:9'],
  ['Efesios capítulo dos versículo ocho', 'Ephesians 2:8'],
  ['Genèse chapitre un verset un', 'Genesis 1:1'],
  ['Apocalypse chapitre vingt et un verset quatre', 'Revelation 21:4'],
  ['Cantique chapitre deux verset un', 'Song of Solomon 2:1'],

  /* French hyphenates its compound numbers, so the recogniser hands back one
     token. "quatre-vingt-trois" is the case that fails on a naive split: four,
     twenty and three add up to 27, not 83. */
  ['Psaumes chapitre vingt-trois verset un', 'Psalms 23:1'],
  ['Psaumes chapitre quatre-vingt-trois verset un', 'Psalms 83:1'],
  ['Ésaïe chapitre quarante verset trente-et-un', 'Isaiah 40:31'],
  ['Jean chapitre dix-sept verset trois', 'John 17:3'],
];

for (const [transcript, expected] of fixtures) {
  const actual = service.detect(transcript, options).detections[0]?.displayRef;
  assert.equal(actual, expected, transcript);
}

assert.equal(service.detect('John chapter three', options).detections.length, 0);
assert.equal(service.detect('verse sixteen', options).detections[0]?.displayRef, 'John 3:16');

const quote = service.detect('For God so loved the world that he gave his only begotten Son', {
  versionId: 'KJV', modes: ['verbatim'], limit: 3, minConfidence: 0.3, isFinal: true,
}).detections[0];
assert.equal(quote?.displayRef, 'John 3:16');

console.log(`live scripture parser passed (${fixtures.length + 3} fixtures)`);
