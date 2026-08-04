/* =========================================================================
   usePptxImport — bring a .pptx into the deck library
   -------------------------------------------------------------------------
   Runs the ported OOXML engine (slide-engine/io/deck-import) over the chosen
   file and turns the result into a PresentationDeck. No LibreOffice, no PDF
   round-trip, no rasterization: the deck is parsed in-process and is listed the
   moment parsing finishes.

   Titles come from PowerPoint's own title placeholders where the deck has
   them, and bodies read top-to-bottom rather than in XML order — see
   slide-engine/io/deck-import.ts for why that matters.
   ========================================================================= */
import { useCallback, useRef, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { importDeckStructure } from '../slide-engine/io/deck-import';
import type { PresentationDeck, PresentationSlide } from '../types';

export interface ImportStatus {
  level: 'working' | 'done' | 'error';
  text: string;
}

const ASPECTS: Record<string, PresentationDeck['aspectRatio']> = {
  '16:9': '16:9',
  '4:3': '4:3',
};

/**
 * Parse a .pptx into a deck record. Shared by the Slides page and the editor's
 * own Import button so there is exactly one import in the app — the editor
 * used to have a second one that discarded the bytes and fabricated a slide
 * from the filename.
 */
export async function buildDeckFromPptx(
  file: File,
  onProgress?: (done: number, total: number) => void,
): Promise<{ deck: PresentationDeck } | { error: string }> {
  if (!/\.pptx$/i.test(file.name)) return { error: 'Only .pptx files can be imported.' };

  const result = await importDeckStructure(await file.arrayBuffer(), {
    fileName: file.name,
    deckId: `deck_${Date.now()}`,
    onProgress: ({ done, total }) => onProgress?.(done, total),
  });

  if (!result.ok || !result.deck) {
    return { error: `Could not read that deck (${result.error || 'unknown error'}).` };
  }

  const now = Date.now();
  const slides: PresentationSlide[] = result.deck.slides.map((s) => ({
    id: s.id,
    title: s.title,
    body: s.body,
    label: s.label,
    notes: '',
    transition: 'fade',
    durationMs: 0,
    hidden: false,
    buildCount: 0,
    buildStep: 0,
    thumbText: s.thumbText,
  }));

  return {
    deck: {
      id: result.deck.deckId,
      title: result.deck.title,
      slides,
      createdAt: now,
      updatedAt: now,
      sourceType: 'pptx',
      /* The path is what lets the editor reopen the package later. Electron 32+
         removed File.path, so it has to come from the preload's webUtils
         bridge; in a plain browser there is none and the deck still lists, it
         just cannot be reopened from source. */
      sourcePath: window.BSP?.deck?.pathForFile?.(file) || undefined,
      aspectRatio: ASPECTS[result.deck.aspectRatio] || '16:9',
    },
  };
}

export function usePptxImport() {
  const addPresentationDeck = useAppStore((s) => s.addPresentationDeck);
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<ImportStatus | null>(null);

  const pick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleFile = useCallback(async (file: File) => {
    setStatus({ level: 'working', text: `Reading ${file.name}…` });

    const result = await buildDeckFromPptx(file, (done, total) => {
      setStatus({ level: 'working', text: `Parsing slide ${done} of ${total}…` });
    });

    if ('error' in result) {
      setStatus({ level: 'error', text: result.error });
      return;
    }

    addPresentationDeck(result.deck);
    const n = result.deck.slides.length;
    setStatus({ level: 'done', text: `Imported ${result.deck.title} — ${n} slide${n === 1 ? '' : 's'}.` });
  }, [addPresentationDeck]);

  const onInputChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset first, so choosing the same file again still fires a change.
    event.target.value = '';
    if (!file) return;
    try {
      await handleFile(file);
    } catch (err) {
      setStatus({ level: 'error', text: `Import failed: ${(err as Error)?.message || String(err)}` });
    }
  }, [handleFile]);

  const clearStatus = useCallback(() => setStatus(null), []);

  return { inputRef, pick, onInputChange, status, clearStatus };
}
