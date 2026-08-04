/* =========================================================================
   useDeckPreview — the real first slide, for a deck card
   -------------------------------------------------------------------------
   Reads the deck's package and parses slide 1, but only once the card is
   actually on screen: a library of forty decks must not unzip forty packages
   because the page mounted.

   Results are cached across mounts, so scrolling back to a card is instant and
   switching workspaces does not re-parse everything. The cache is bounded —
   each entry holds a parsed slide with its XML nodes, which for an
   illustration-heavy deck is not small.
   ========================================================================= */
import { useEffect, useRef, useState } from 'react';
import { parseDeckPreview, type DeckPreview } from '../slide-engine/io/deck-preview';
import type { PresentationDeck } from '../types';

/** Enough for a screenful of cards several times over, bounded so a big
    library cannot pin every deck it has ever shown in memory. */
const CACHE_LIMIT = 12;

/** How far outside the viewport still counts as worth loading. */
const MARGIN_PX = 200;
const cache = new Map<string, DeckPreview | null>();

/** Keyed on the edit as well as the path: a saved change has to invalidate the
    card, or the grid would keep showing the wording from import time. */
function cacheKey(deck?: PresentationDeck): string {
  if (!deck) return '';
  const edit = deck.slides[0]?.editor?.xml;
  return `${deck.sourcePath}::${deck.updatedAt}::${edit ? edit.length : 0}`;
}

function remember(key: string, value: DeckPreview | null): void {
  cache.set(key, value);
  while (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

export function useDeckPreview(deck?: PresentationDeck): {
  ref: React.RefObject<HTMLDivElement | null>;
  preview: DeckPreview | null;
} {
  const ref = useRef<HTMLDivElement>(null);
  const key = cacheKey(deck);
  const [preview, setPreview] = useState<DeckPreview | null>(() => cache.get(key) ?? null);

  useEffect(() => {
    if (!deck || deck.sourceType !== 'pptx' || !deck.sourcePath) return;

    if (cache.has(key)) {
      setPreview(cache.get(key) ?? null);
      return;
    }

    const node = ref.current;
    if (!node) return;

    let cancelled = false;

    const load = async () => {
      /* Checked here rather than before observing: a card can mount before the
         bridge is available, and bailing then would leave it blank until
         something else happened to remount it. */
      if (!window.BSP?.deck?.read) return;
      const file = await window.BSP.deck.read(deck.sourcePath as string);
      if (cancelled) return;
      if (!file.ok || !file.data) {
        remember(key, null); // a missing file should not be retried on every scroll
        return;
      }
      const bytes = file.data.buffer.slice(
        file.data.byteOffset,
        file.data.byteOffset + file.data.byteLength,
      ) as ArrayBuffer;

      const result = await parseDeckPreview(bytes, 0, deck.slides[0]?.editor?.xml);
      if (cancelled) return;
      remember(key, result);
      setPreview(result);
    };

    /* Lazy rather than a load-everything pass: the reference learned the same
       lesson with its navigator thumbnails, where an eager queue meant distant
       slides never finished. */
    const onScreen = () => {
      const r = node.getBoundingClientRect();
      return r.bottom > -MARGIN_PX && r.top < window.innerHeight + MARGIN_PX && r.width > 0;
    };

    /* Measured directly first, and only then observed. IntersectionObserver
       reports asynchronously and does not report at all while the page is
       occluded, so a card that is already on screen at mount would otherwise
       sit blank waiting for a callback that never comes. */
    if (onScreen()) {
      load();
      return () => { cancelled = true; };
    }

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        observer.disconnect();
        load();
      }
    }, { rootMargin: `${MARGIN_PX}px` });

    observer.observe(node);
    return () => { cancelled = true; observer.disconnect(); };
    /* Primitives, not the deck object: zustand's persist rehydration replaces
       the deck records shortly after mount, and depending on the object meant
       the effect tore down and rebuilt its observer before it could ever
       fire. */
  }, [deck?.sourceType, deck?.sourcePath, key]);

  return { ref, preview };
}
