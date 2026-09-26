import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const {
  arrangeLyrics,
  isChordLine,
  canonicalSectionKey,
  prettyLabel,
} = require('../../src/electron/lyric-sections.cjs');

describe('Song Lyric Section Parser & Chord Detection', () => {
  it('correctly identifies chord lines', () => {
    expect(isChordLine('G   C   D   Em')).toBe(true);
    expect(isChordLine('Amazing grace how sweet the sound')).toBe(false);
    expect(isChordLine('C#m7   F#sus4   B')).toBe(true);
  });

  it('normalizes section headers correctly', () => {
    expect(canonicalSectionKey('Chorus 1')).toEqual({ key: 'chorus', number: 1 });
    expect(canonicalSectionKey('Verse 2')).toEqual({ key: 'verse', number: 2 });
    expect(canonicalSectionKey('Pre-Chorus')).toEqual({ key: 'prechorus', number: null });
    expect(canonicalSectionKey('Bridge')).toEqual({ key: 'bridge', number: null });
  });

  it('formats pretty labels', () => {
    expect(prettyLabel({ key: 'chorus', number: null })).toBe('Chorus');
    expect(prettyLabel({ key: 'verse', number: 2 })).toBe('Verse 2');
    expect(prettyLabel({ key: 'bridge', number: 1 })).toBe('Bridge 1');
  });

  it('splits plain lyric sheet into distinct verse and chorus sections', () => {
    const sheet = `[Verse 1]
Amazing grace how sweet the sound
That saved a wretch like me

[Chorus]
Hallelujah praise the Lord
Glory to His name

[Verse 2]
'Twas grace that taught my heart to fear
And grace my fears relieved`;

    const result = arrangeLyrics(sheet);
    expect(result.sections.length).toBe(3);
    expect(result.sections[0].name).toContain('Verse');
    expect(result.sections[1].name).toContain('Chorus');
    expect(result.sections[2].name).toContain('Verse');
  });

  it('handles empty input gracefully', () => {
    const result = arrangeLyrics('');
    expect(result.sections).toEqual([]);
    expect(result.verseOrder).toEqual([]);
    expect(result.confidence).toBe(0);
  });
});
