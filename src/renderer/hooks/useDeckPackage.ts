/* =========================================================================
   useDeckPackage — open an imported deck's .pptx for editing
   -------------------------------------------------------------------------
   A deck record keeps only its source path; the package itself is far too
   large to hold in persisted app state. This reads the file back over IPC and
   runs it through the ported import pipeline, which parses slide 1 immediately
   and fills the rest from an idle queue.

   The engine keeps its parsed slides on a mutable singleton (they hold live
   XML nodes and must not be made reactive), so this exposes a `version`
   counter that ticks whenever the background queue finishes another slide —
   that is what React re-renders on.
   ========================================================================= */
import { useCallback, useEffect, useRef, useState } from 'react';
import { openDeckFromBytes } from '../slide-engine/io/import';
import { ensureModifierSlideParsed } from '../slide-engine/parser/presentation';
import { applySavedSlideXml, collectEditedSlideXml, type SavedSlideXml } from '../slide-engine/io/save';
import { state as engineState, type ParsedSlide, type SlideSizeEmu } from '../slide-engine/state';
import type { PresentationDeck } from '../types';

export interface DeckPackageStatus {
  level: 'working' | 'ready' | 'error' | 'unavailable';
  text: string;
}

export interface DeckPackage {
  /** Parsed slides, live from the engine. Unparsed ones have `parsed: false`. */
  slides: ParsedSlide[];
  slideSizeEmu: SlideSizeEmu | null;
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  status: DeckPackageStatus | null;
  /** Ticks when another slide finishes parsing. */
  version: number;
  reload: () => void;
  /** OOXML for every slide edited this session, keyed by slide index. */
  collectEdits: () => Map<number, SavedSlideXml>;
}

export function useDeckPackage(deck: PresentationDeck | null, enabled: boolean): DeckPackage {
  const [slides, setSlides] = useState<ParsedSlide[]>([]);
  const [slideSizeEmu, setSlideSizeEmu] = useState<SlideSizeEmu | null>(null);
  const [activeIndex, setActiveIndexRaw] = useState(0);
  const [status, setStatus] = useState<DeckPackageStatus | null>(null);
  const [version, setVersion] = useState(0);
  const [reloadToken, setReloadToken] = useState(0);

  /* Guards a stale open from clobbering a newer one: the user can close the
     editor and reopen a different deck while a 48-slide package is still
     unzipping. */
  const openToken = useRef(0);

  useEffect(() => {
    if (!enabled || !deck) return;

    const path = deck.sourcePath;
    if (deck.sourceType !== 'pptx' || !path) {
      setStatus({
        level: 'unavailable',
        text: deck.sourceType === 'pptx'
          ? 'This deck has no source file on record, so its slides cannot be reopened.'
          : 'Not a PowerPoint deck.',
      });
      return;
    }

    if (!window.BSP?.deck?.read) {
      setStatus({ level: 'unavailable', text: 'Reopening a package needs the desktop app.' });
      return;
    }

    const token = ++openToken.current;
    let cancelled = false;

    (async () => {
      setStatus({ level: 'working', text: 'Opening package…' });
      const file = await window.BSP.deck.read(path);
      if (cancelled || token !== openToken.current) return;

      if (!file.ok || !file.data) {
        setStatus({
          level: 'error',
          text: file.error === 'ENOENT'
            ? 'The original file has moved or been deleted.'
            : `Could not read the package (${file.error || 'unknown error'}).`,
        });
        return;
      }

      // IPC hands back a Uint8Array view; JSZip wants the buffer behind it.
      const bytes = file.data.buffer.slice(
        file.data.byteOffset,
        file.data.byteOffset + file.data.byteLength,
      ) as ArrayBuffer;

      const result = await openDeckFromBytes(bytes, file.name || deck.title, {
        onStatus: (text, level) => {
          if (cancelled || token !== openToken.current) return;
          if (level === 'error') setStatus({ level: 'error', text });
          else if (level === 'loading') setStatus({ level: 'working', text });
        },
        onDeckOpened: () => {
          if (cancelled || token !== openToken.current) return;
          setSlideSizeEmu({ ...engineState.pptxSlideSizeEmu });
          setActiveIndexRaw(0);
          setStatus(null);
          // Slides are published after saved edits are restored, below, so the
          // first paint is never the unedited version.
        },
        onSlideParsed: () => {
          if (cancelled || token !== openToken.current) return;
          setSlides([...engineState.slides]);
          setVersion((v) => v + 1);
        },
      });

      if (cancelled || token !== openToken.current) return;
      if (!result.ok && result.error !== 'cancelled') {
        setStatus({ level: 'error', text: `Could not open the package (${result.error}).` });
        return;
      }

      /* Saved edits live as OOXML on the deck record. Put those parts back
         into the package and let the affected slides re-parse from them, so an
         edited slide goes through exactly the same pipeline as an untouched
         one — no separate "edited" render path to drift. */
      const saved = deck.slides.map((s) => s.editor || null);
      if (saved.some(Boolean)) {
        const restored = await applySavedSlideXml(engineState.loadedPptxZip, engineState.slides, saved);
        if (cancelled || token !== openToken.current) return;
        // Re-parse whatever is on screen now; the rest come back lazily.
        if (restored.includes(0)) {
          await ensureModifierSlideParsed(0).catch((err) => console.warn('Restore parse failed', err));
        }
        if (cancelled || token !== openToken.current) return;
      }

      setSlides([...engineState.slides]);
      setVersion((v) => v + 1);
    })();

    return () => { cancelled = true; };
  }, [deck, enabled, reloadToken]);

  /* Selecting a slide the background queue has not reached yet parses it now,
     rather than showing a placeholder until the queue happens to arrive. */
  const setActiveIndex = useCallback((index: number) => {
    setActiveIndexRaw(index);
    const slide = engineState.slides[index];
    if (!slide || slide.parsed) return;
    ensureModifierSlideParsed(index)
      .then(() => {
        setSlides([...engineState.slides]);
        setVersion((v) => v + 1);
      })
      .catch((err) => {
        console.warn('Slide parse failed', err);
        setStatus({ level: 'error', text: 'Could not parse that slide.' });
      });
  }, []);

  const reload = useCallback(() => setReloadToken((t) => t + 1), []);

  const collectEdits = useCallback(() => collectEditedSlideXml(engineState.slides), []);

  return { slides, slideSizeEmu, activeIndex, setActiveIndex, status, version, reload, collectEdits };
}
