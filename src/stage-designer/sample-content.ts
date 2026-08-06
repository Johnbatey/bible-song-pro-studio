/* =========================================================================
   Designer — stand-in content
   -------------------------------------------------------------------------
   Layouts are almost always built on a Tuesday afternoon with nothing live.
   An empty stage is the one state a layout never has to be good at, so the
   designer fills it: a real verse in the current-text zone, a real song title
   in the cue, a slide on the board. Long enough that a zone which cannot hold
   a normal verse shows it here rather than on Sunday.

   These feed the *real* renderer through the same StageState and
   ProgramSurfaceState the stage window receives, so what the designer draws is
   what the stage will draw. Nothing here is a picture of the stage.
   ========================================================================= */
import type { StageContent, StageMessage, StageTimer } from '../stage/stage-state';
import type { ProgramSurfaceState } from '../renderer/components/display/ProgramSurface';
import type { Scene, SlideProjection } from '../renderer/types';

export type SampleKind = 'scripture' | 'song' | 'slide';

export const SAMPLE_LABELS: Record<SampleKind, string> = {
  scripture: 'Scripture',
  song: 'Song',
  slide: 'Slide',
};

export interface SampleContent {
  current: StageContent;
  next: StageContent;
  songTitle: string;
  songSubtitle: string;
  messages: StageMessage[];
  timer: StageTimer;
  slide: SlideProjection | null;
}

/* A verse long enough to wrap twice at a normal stage size. A one-line sample
   makes every layout look like it works. */
const VERSE_BODY =
  'For God so loved the world, that he gave his only begotten Son, that whosoever '
  + 'believeth in him should not perish, but have everlasting life.';

const LYRIC_BODY = 'Amazing grace, how sweet the sound\nThat saved a wretch like me';

/** A native slide, so the Slide zone can be laid out against something with a
    background and real type rather than against the text fallback. */
function sampleSlide(): SlideProjection {
  return {
    kind: 'native',
    background: { type: 'gradient', value: 'linear-gradient(135deg, #16223f 0%, #3b1d52 100%)' },
    elements: [
      {
        id: 'sample-title',
        type: 'text',
        x: 8, y: 26, width: 84, height: 24,
        content: 'The Weight of Glory',
        fontSize: 84,
        fontWeight: 800,
        color: '#ffffff',
        textAlign: 'center',
      },
      {
        id: 'sample-sub',
        type: 'text',
        x: 12, y: 54, width: 76, height: 14,
        content: '2 Corinthians 4 · Part Three',
        fontSize: 38,
        fontWeight: 500,
        color: 'rgba(255,255,255,0.72)',
        textAlign: 'center',
      },
    ],
  };
}

export function sampleContent(kind: SampleKind): SampleContent {
  const timer: StageTimer = { running: false, startedAtMs: null, accumulatedSeconds: 754 };
  const messages: StageMessage[] = [{ id: 'sample-msg', text: 'Band: hold the last chorus' }];

  if (kind === 'song') {
    return {
      current: { title: 'Verse 2', body: LYRIC_BODY },
      next: { title: 'Chorus', body: 'Twas grace that taught my heart to fear' },
      songTitle: 'Amazing Grace',
      songSubtitle: 'Key of G',
      messages,
      timer,
      slide: null,
    };
  }

  if (kind === 'slide') {
    return {
      current: { title: 'The Weight of Glory', body: '2 Corinthians 4 · Part Three' },
      next: { title: 'Next', body: 'Closing prayer' },
      songTitle: 'Sermon',
      songSubtitle: 'Part Three',
      messages,
      timer,
      slide: sampleSlide(),
    };
  }

  return {
    current: { title: 'John 3:16', body: VERSE_BODY, notes: 'Slow down through the second line' },
    next: { title: 'John 3:17', body: 'For God sent not his Son into the world to condemn the world.' },
    songTitle: 'Scripture Reading',
    songSubtitle: 'John 3',
    messages,
    timer,
    slide: null,
  };
}

/**
 * The program state the sample slide travels in.
 *
 * StageSurface reads a live slide off the *program* feed, not off stage state —
 * both feeds carry the same scene and sending it twice would put a second copy
 * of every embedded image on the wire. The designer honours that: to show a
 * slide it hands the renderer a program state shaped exactly like the one the
 * projector gets.
 */
export function sampleProgramState(slide: SlideProjection | null): ProgramSurfaceState {
  if (!slide) return {};
  const scene: Scene = {
    id: 'designer-sample',
    name: 'Sample slide',
    type: 'presentation',
    content: { slide },
  };
  return { scene, outputMode: 'fullscreen' };
}
