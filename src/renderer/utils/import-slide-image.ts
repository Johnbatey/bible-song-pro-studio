/* =========================================================================
   import-slide-image — bring a photo onto a slide without killing the process
   -------------------------------------------------------------------------
   A phone JPEG is often 20–40 MB. `FileReader.readAsDataURL` turns that into a
   ~50 MB string, the editor history copies it, and `display.sendState` hands
   the whole thing to Electron IPC. On an 8 GB machine that abort()s in
   ValueDeserializer (node::OnFatalError).

   The main process reads the file from disk, resizes it to 1920 on the long
   edge, and returns a `/media/<id>` URL. The renderer never holds the original
   bytes as a string.
   ========================================================================= */
import { refreshMediaLibrary } from '../hooks/useMediaLibrary';

const RENDERER_FALLBACK_MAX_BYTES = 8 * 1024 * 1024;
const RENDERER_MAX_EDGE = 1920;
const RENDERER_JPEG_QUALITY = 0.82;

export type SlideImageImport = { url: string } | { error: string };

export async function importSlideImage(file: File): Promise<SlideImageImport> {
  if (!file || !file.type.startsWith('image/')) {
    return { error: 'That is not an image.' };
  }

  const filePath = window.BSP?.media?.pathForFile?.(file) || '';
  if (filePath && window.BSP?.media?.importOptimized) {
    const result = await window.BSP.media.importOptimized(filePath);
    if (result?.ok && result.item?.url) {
      void refreshMediaLibrary();
      return { url: result.item.url };
    }
    return { error: result?.error || 'Could not import that image.' };
  }

  if (file.size > RENDERER_FALLBACK_MAX_BYTES) {
    return {
      error: 'That image is too large to import here. Choose it from a file on disk so it can be resized.',
    };
  }

  return resizeInRenderer(file);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read that image.'));
    img.src = src;
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not encode that image.'));
    reader.readAsDataURL(blob);
  });
}

async function resizeInRenderer(file: File): Promise<SlideImageImport> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    const scale = Math.min(1, RENDERER_MAX_EDGE / Math.max(img.width, img.height));
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { error: 'Could not process that image.' };
    ctx.drawImage(img, 0, 0, width, height);
    const keepPng = file.type === 'image/png' || file.type === 'image/webp';
    const blob = await new Promise<Blob | null>((done) => {
      canvas.toBlob(done, keepPng ? 'image/png' : 'image/jpeg', RENDERER_JPEG_QUALITY);
    });
    if (!blob) return { error: 'Could not compress that image.' };
    return { url: await blobToDataUrl(blob) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not import that image.' };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
