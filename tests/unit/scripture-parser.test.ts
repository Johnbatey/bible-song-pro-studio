import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const { createVerseDetectionService } = require('../../src/electron/verse-detection-service.cjs');

describe('Live Scripture Parser & Speech Detection', () => {
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
    ['Génesis capítulo uno versículo uno', 'Genesis 1:1'],
    ['Salmos capítulo veintitrés versículo uno', 'Psalms 23:1'],
    ['Apocalipsis capítulo veintiuno versículo cuatro', 'Revelation 21:4'],
    ['Genèse chapitre un verset un', 'Genesis 1:1'],
    ['Psaumes chapitre vingt-trois verset un', 'Psalms 23:1'],
    ['Psaumes chapitre quatre-vingt-trois verset un', 'Psalms 83:1'],
    ['Ésaïe chapitre quarante verset trente-et-un', 'Isaiah 40:31'],
    ['Jean chapitre dix-sept verset trois', 'John 17:3'],
  ];

  fixtures.forEach(([transcript, expected]) => {
    it(`correctly parses: "${transcript}" -> ${expected}`, () => {
      const actual = service.detect(transcript, options).detections[0]?.displayRef;
      expect(actual).toBe(expected);
    });
  });

  it('rejects incomplete references like "John chapter three"', () => {
    expect(service.detect('John chapter three', options).detections.length).toBe(0);
  });

  it('detects verbatim quotes accurately', () => {
    const quote = service.detect('For God so loved the world that he gave his only begotten Son', {
      versionId: 'KJV',
      modes: ['verbatim'],
      limit: 3,
      minConfidence: 0.3,
      isFinal: true,
    }).detections[0];
    expect(quote?.displayRef).toBe('John 3:16');
  });

  it('prevents false positives from general sermon talk', () => {
    const sermon = service.detect('We welcome everyone to church this morning, let us pray and thank God for this beautiful day', {
      versionId: 'KJV',
      modes: ['direct', 'contextual', 'verbatim', 'semantic'],
      limit: 3,
      minConfidence: 0.45,
      isFinal: true,
    });
    expect(sermon.detections.length).toBe(0);
  });
});
