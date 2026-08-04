/* =========================================================================
   Slide engine — PPTX import pipeline
   -------------------------------------------------------------------------
   Drives importing a .pptx: the cancellable/timed import job, unzipping via
   JSZip, resetting caches, reading theme + slide size, resolving slide order,
   building shell slide records, parsing slide 1 synchronously for instant
   open, then progressively parsing the rest in the background.

   Ported from the reference editor's io/import.js. Two things were adapted at
   the framework boundary, and nothing else:

   - The reference reaches into its own testbed markup by element id
     (`btn-cancel-import`, `lbl-pptx-filename`, `pptx-file-input`) and calls
     `render.*` directly. Those ids do not exist here and React owns our DOM, so
     every side effect is a hook on `ImportHooks` instead. Same call sites, same
     order, same messages.
   - `handlePptxUpload`/`triggerPptxUpload` were the reference's
     `<input type=file>` wrapper — explicitly its testbed path, not the one the
     host app uses. React supplies its own input and calls `openDeckFromBytes`,
     which is the reference's own byte-level entry point.

   The job lifecycle, cache resets, parse ordering and idle-callback scheduling
   are unchanged.
   ========================================================================= */
import JSZip from 'jszip';
import { resolveThemeColor } from '../core/color';
import { updatePptxSlideSizeFromZip, getSlideKeysInPresentationOrder } from '../core/zip-io';
import { updatePptxThemeFromZip } from '../parser/theme';
import { parseModifierSlide, ensureModifierSlideParsed } from '../parser/presentation';
import { state } from '../state';

export type ImportStatusLevel = 'loading' | 'info' | 'success' | 'error';

/** Everything the reference did to the DOM directly. All optional. */
export interface ImportHooks {
  /** The reference's app.createToast. */
  onStatus?: (message: string, level: ImportStatusLevel) => void;
  /** The reference's app.clearLoadingToasts. */
  onClearStatus?: () => void;
  /** Showed/hid the cancel button (setImportUiState). */
  onImportRunningChange?: (running: boolean) => void;
  /** app.resetModifierHistory — fresh undo stacks per deck. */
  onResetHistory?: () => void;
  /** render.renderSlideDeckNavigator + render.renderActiveSlideOnCanvas. */
  onDeckOpened?: () => void;
  /** render.updateLiveThumbnail(idx), and a re-render when idx is active. */
  onSlideParsed?: (index: number, isActive: boolean) => void;
}

export interface OpenDeckResult {
  ok: boolean;
  error?: string;
  slideCount?: number;
  /** What showLoadedDeckInfo used to write into the inspector chip. */
  fileName?: string;
  byteLength?: number;
}

let importHooks: ImportHooks = {};

function status(message: string, level: ImportStatusLevel): void {
  importHooks.onStatus?.(message, level);
}

export function setImportUiState(isRunning: boolean): void {
  importHooks.onImportRunningChange?.(isRunning);
}

export function startPptxImportJob(): number {
  const id = Date.now() + Math.floor(Math.random() * 1000);
  const timeoutId = window.setTimeout(() => {
    if (state.pptxImportJob && state.pptxImportJob.id === id) {
      state.pptxImportJob.cancelled = true;
      status('Import timed out. Try a smaller file or re-open.', 'error');
    }
  }, 45000);

  state.pptxImportJob = { id, cancelled: false, timeoutId };
  setImportUiState(true);
  return id;
}

export function isImportJobActive(jobId: number): boolean {
  return !!state.pptxImportJob && state.pptxImportJob.id === jobId && !state.pptxImportJob.cancelled;
}

export function finishPptxImportJob(jobId: number): void {
  if (!state.pptxImportJob || state.pptxImportJob.id !== jobId) return;
  if (state.pptxImportJob.timeoutId) {
    clearTimeout(state.pptxImportJob.timeoutId);
  }
  state.pptxImportJob = null;
  setImportUiState(false);
}

export function cancelPptxImport(): void {
  if (!state.pptxImportJob) return;
  state.pptxImportJob.cancelled = true;
  status('Cancelling PPTX import...', 'info');
  setImportUiState(false);
}

/* The reference notes that scheduleDeferredModifierThumbnails() used to fill
   off-screen PPTX previews from a requestIdleCallback queue. Every navigator
   re-render bumped its token and restarted the queue, so on a deck of any size
   the distant thumbnails never finished. Thumbnails are filled from an
   IntersectionObserver as they scroll into view instead. */

export function startModifierBackgroundParsing(startIndex = 1): void {
  const token = ++state.modifierBackgroundParseToken;
  const queue = state.slides
    .map((_, idx) => idx)
    .filter((idx) => idx >= startIndex && idx !== state.activeSlideIndex && state.slides[idx] && state.slides[idx].kind === 'pptx' && !state.slides[idx].parsed);

  const runNext = async (): Promise<void> => {
    if (token !== state.modifierBackgroundParseToken || queue.length === 0 || !state.loadedPptxZip) return;
    const idx = queue.shift() as number;

    try {
      await ensureModifierSlideParsed(idx);
      importHooks.onSlideParsed?.(idx, idx === state.activeSlideIndex);
    } catch (err) {
      console.warn('Background slide parse failed', err);
    }

    if (window.requestIdleCallback) {
      window.requestIdleCallback(() => { runNext(); }, { timeout: 140 });
    } else {
      setTimeout(() => { runNext(); }, 20);
    }
  };

  if (window.requestIdleCallback) {
    window.requestIdleCallback(() => { runNext(); }, { timeout: 120 });
  } else {
    setTimeout(() => { runNext(); }, 16);
  }
}

function byteLengthOf(buffer: ArrayBuffer | Blob | null): number {
  if (!buffer) return 0;
  if (typeof (buffer as ArrayBuffer).byteLength === 'number') return (buffer as ArrayBuffer).byteLength;
  if (typeof (buffer as Blob).size === 'number') return (buffer as Blob).size;
  return 0;
}

/**
 * Byte-level deck open — no DOM, no file input.
 *
 * This is the reference's own host entry point: there the deck was imported
 * long ago and only a filesystem path survives on the library record, so the
 * panel fetches the package over IPC and hands the bytes straight here.
 *
 * @param fileBuffer  raw .pptx package bytes
 * @param fileName    used for export naming and the UI label
 */
export async function openDeckFromBytes(fileBuffer: ArrayBuffer, fileName: string, hooks: ImportHooks = {}): Promise<OpenDeckResult> {
  importHooks = hooks;

  if (state.pptxImportJob && !state.pptxImportJob.cancelled) {
    status('An import is already running. Cancel it or wait to finish.', 'info');
    return { ok: false, error: 'import-in-progress' };
  }

  state.originalPptxFileName = fileName || 'presentation.pptx';
  const byteLength = byteLengthOf(fileBuffer);

  status('Unzipping PPTX package XML structures...', 'loading');

  const importJobId = startPptxImportJob();

  try {
    const importStartMs = performance.now();
    if (!isImportJobActive(importJobId)) {
      throw new Error('Import cancelled.');
    }

    const zipObj = await JSZip.loadAsync(fileBuffer, { checkCRC32: false, createFolders: false });
    if (!isImportJobActive(importJobId)) {
      throw new Error('Import cancelled.');
    }

    state.loadedPptxZip = zipObj;
    state.slideRelsCache.clear();
    state.slideRelsDetailCache.clear();
    state.xmlDocCache.clear();
    state.pptxThemeCache = new Map();
    hooks.onResetHistory?.(); // fresh undo stacks per deck
    await updatePptxSlideSizeFromZip(zipObj);
    await updatePptxThemeFromZip(zipObj);

    // Resolve exact slide display order from presentation relationships when available.
    const slideKeys = await getSlideKeysInPresentationOrder(zipObj);

    if (slideKeys.length === 0) {
      throw new Error('No slide files detected in presentation path.');
    }

    // Build shell entries first so UI can open immediately.
    state.modifierBackgroundParseToken += 1;
    state.slides = slideKeys.map((filename, index) => ({
      id: index + 1,
      kind: 'pptx' as const,
      filename,
      backgroundColor: resolveThemeColor('bg1', '#0b0f19'),
      shapes: [],
      xmlDoc: null,
      parsed: false,
    }));

    // Parse only the first slide synchronously for instant open.
    status(`Parsing slide XML 1 of ${slideKeys.length}...`, 'loading');
    state.slides[0] = await parseModifierSlide(zipObj, slideKeys[0], 1);

    if (!isImportJobActive(importJobId)) {
      throw new Error('Import cancelled.');
    }

    state.activeSlideIndex = 0;
    state.selectedElementId = null;

    // Open deck immediately, then parse remaining slides in the background.
    const elapsedSec = ((performance.now() - importStartMs) / 1000).toFixed(2);
    status(`Opened PPTX immediately (${state.slides.length} slides indexed in ${elapsedSec}s)`, 'success');
    hooks.onDeckOpened?.();
    startModifierBackgroundParsing(1);
    return { ok: true, slideCount: state.slides.length, fileName: state.originalPptxFileName, byteLength };

  } catch (err) {
    console.error(err);
    const cancelled = !!err && String((err as Error).message || '').toLowerCase().includes('cancelled');
    if (cancelled) {
      status('Import cancelled.', 'info');
    } else {
      status('Error opening PPTX file. The file may be damaged or unsupported.', 'error');
    }
    return { ok: false, error: cancelled ? 'cancelled' : String((err as Error)?.message || err) };
  } finally {
    hooks.onClearStatus?.();
    finishPptxImportJob(importJobId);
  }
}

/**
 * The reference's file-input wrapper, minus the DOM: validate the extension,
 * keep the File for the desktop render engine, hand the bytes to
 * openDeckFromBytes. React owns the <input> and resetting its value.
 */
export async function openDeckFromFile(file: File, hooks: ImportHooks = {}): Promise<OpenDeckResult> {
  if (!/\.pptx$/i.test(file.name)) {
    hooks.onStatus?.('Please choose a valid .pptx file.', 'error');
    return { ok: false, error: 'not-pptx' };
  }

  // Kept for the desktop render engine, which renders from the file path/bytes.
  state.loadedPptxFile = file;
  state.loadedPptxPath = (file as File & { path?: string }).path || null;

  return openDeckFromBytes(await file.arrayBuffer(), file.name, hooks);
}
