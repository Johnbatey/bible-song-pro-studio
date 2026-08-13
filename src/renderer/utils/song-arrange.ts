import { v4 as uuid } from 'uuid';
import type { Song, SongSlide } from '../types';

export interface ArrangeProposal {
  /** The song as it would be after applying. Never mutates the original. */
  song: Song;
  /** 1 when the sheet labelled its own sections, 0.25 when the split was
   *  guessed from line count. Below 0.6 the UI says so out loud. */
  confidence: number;
  warnings: string[];
  /** False when the detector agreed with what is already there, so the UI can
   *  say "nothing to change" rather than offering a no-op Apply. */
  changed: boolean;
}

/* Labels carrying no structure, which is a narrower set than the one the
   detector will rename. "Verse 1" is renameable *by* the detector because the
   detector assigned it — but on the way back in it is a real header and has to
   be sent as one, or re-arranging a properly sectioned song flattens it. Only
   a raw import artefact goes in bare. */
const GENERIC_LABEL = /^(slide\s*\d*|section\s*\d*|untitled|imported song|[vcbpt]\d*)$/i;

function isGenericLabel(label: string) {
  return !label || GENERIC_LABEL.test(label.trim());
}

const normalize = (text: string) => text.toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Renders a song back to a lyric sheet for the detector to re-read.
 *
 * Slides the operator named keep their header, so the detector leaves those
 * names alone and only dedupes. Slides with a generic name go in bare, which is
 * what lets a song that imported as one undifferentiated slab get split on its
 * blank lines — the case this feature exists for.
 */
function toSheet(song: Song): string {
  return song.slides
    .map((slide) => (isGenericLabel(slide.label) ? slide.text : `[${slide.label}]\n${slide.text}`))
    .join('\n\n');
}

function sameOrder(a: string[] | undefined, b: string[]) {
  const left = a || [];
  return left.length === b.length && left.every((id, i) => id === b[i]);
}

/**
 * Re-reads a song already in the library and proposes sections plus a play
 * order. Nothing is applied — the caller shows this and waits.
 *
 * Slide ids are reused wherever the text is unchanged, so scenes and queue
 * entries already built on those slides keep resolving after Apply.
 */
export async function arrangeExistingSong(song: Song): Promise<ArrangeProposal | { error: string }> {
  const sheet = toSheet(song);
  const result = await window.BSP?.song?.arrangeText({ text: sheet }).catch(() => null);
  if (!result?.ok || !result.sections?.length) {
    return { error: result?.error || 'Could not read this song’s lyrics.' };
  }

  const reusable = new Map<string, string>();
  song.slides.forEach((slide) => {
    const key = normalize(slide.text);
    if (!reusable.has(key)) reusable.set(key, slide.id);
  });

  const used = new Set<string>();
  const slides: SongSlide[] = result.sections.map((section) => {
    const text = section.lines.join('\n');
    const key = normalize(text);
    const existing = reusable.get(key);
    const id = existing && !used.has(existing) ? existing : uuid();
    used.add(id);
    return { id, label: section.name, text };
  });

  const byName = new Map(result.sections.map((section, i) => [section.name, slides[i].id]));
  const arrangement = (result.verseOrder || [])
    .map((name) => byName.get(name))
    .filter((id): id is string => Boolean(id));

  const labelsChanged = slides.length !== song.slides.length
    || slides.some((slide, i) => slide.label !== song.slides[i]?.label || slide.text !== song.slides[i]?.text);

  return {
    song: {
      ...song,
      slides,
      arrangement: arrangement.length > 0 ? arrangement : undefined,
    },
    confidence: result.confidence ?? 0.5,
    warnings: result.warnings || [],
    changed: labelsChanged || !sameOrder(song.arrangement, arrangement),
  };
}

/** Human summary of a play order, for the disclosure header. */
export function describeArrangement(song: Song): string {
  const order = Array.isArray(song.arrangement) ? song.arrangement : [];
  if (order.length === 0) return `Plays in order · ${song.slides.length} slide${song.slides.length === 1 ? '' : 's'}`;
  const byId = new Map(song.slides.map((slide) => [slide.id, slide.label]));
  const labels = order.map((id) => shortLabel(byId.get(id) || '?'));
  const shown = labels.slice(0, 8).join(' ');
  return `${order.length} slides · ${shown}${labels.length > 8 ? '…' : ''}`;
}

/** "Verse 1" -> "V1", "Chorus" -> "C". Keeps a long order readable in a header. */
export function shortLabel(label: string): string {
  const m = label.trim().match(/^([A-Za-z-]+)\s*(\d+)?/);
  if (!m) return label;
  const word = m[1].toLowerCase();
  const initials = word === 'pre-chorus' ? 'PC' : word.charAt(0).toUpperCase();
  return `${initials}${m[2] || ''}`;
}
