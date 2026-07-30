import { v4 as uuid } from 'uuid';
import type { PresentationSlide, PresentationDeck } from '../types';
import JSZip from 'jszip';
import * as pdfjsLib from 'pdfjs-dist';
import PdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker';

pdfjsLib.GlobalWorkerOptions.workerPort = new PdfjsWorker();

type SlideTransition = PresentationSlide['transition'];

function createSlide(body: string, order: number): PresentationSlide {
  const firstLine = body.split('\n')[0].replace(/^#+\s*/, '').trim();
  return {
    id: uuid(),
    title: firstLine || `Slide ${order + 1}`,
    body: body || '',
    label: `Slide ${order + 1}`,
    notes: '',
    transition: 'fade' as SlideTransition,
    durationMs: 0,
    hidden: false,
    buildCount: 0,
    buildStep: 0,
  };
}

function fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

export async function parsePptxFile(file: File): Promise<Pick<PresentationDeck, 'title' | 'slides' | 'sourceType' | 'sourcePath'>> {
  const arrayBuffer = await fileToArrayBuffer(file);
  const zip = await JSZip.loadAsync(arrayBuffer);
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((a, b) => {
      const na = parseInt(a.match(/\d+/)?.[0] || '0', 10);
      const nb = parseInt(b.match(/\d+/)?.[0] || '0', 10);
      return na - nb;
    });

  if (slideFiles.length === 0) {
    throw new Error('No slides found in PPTX file');
  }

  const slides: PresentationSlide[] = [];
  for (const filePath of slideFiles) {
    const xmlStr = await zip.file(filePath)!.async('string');
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlStr, 'text/xml');

    const textRuns = xmlDoc.querySelectorAll('a\\:t, t');
    const paragraphs: string[] = [];
    let currentParagraph = '';

    const allElements = xmlDoc.evaluate(
      '//a:p | //p',
      xmlDoc,
      null,
      XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
      null
    );

    if (allElements.snapshotLength > 0) {
      for (let i = 0; i < allElements.snapshotLength; i++) {
        const paraEl = allElements.snapshotItem(i) as Element;
        const textContents: string[] = [];
        const runs = paraEl.querySelectorAll('a\\:r, a\\:br, r, br');
        runs.forEach((node) => {
          const el = node as Element;
          if (el.tagName === 'a:br' || el.tagName === 'br') {
            textContents.push('\n');
          } else {
            const tEl = el.querySelector('a\\:t, t');
            if (tEl?.textContent) textContents.push(tEl.textContent);
          }
        });
        const paraText = textContents.join('').replace(/\n+/, '\n').trim();
        if (paraText) paragraphs.push(paraText);
      }
    } else {
      const visited = new Set<string>();
      textRuns.forEach((el) => {
        if (el.textContent && !visited.has(el.textContent)) {
          visited.add(el.textContent);
          currentParagraph += el.textContent;
        }
      });
      if (currentParagraph.trim()) paragraphs.push(currentParagraph.trim());
    }

    const body = paragraphs.join('\n\n');
    slides.push(createSlide(body, slides.length));
  }

  return {
    title: file.name.replace(/\.pptx$/i, ''),
    slides,
    sourceType: 'pptx',
    sourcePath: file.name,
  };
}

export async function parsePdfFile(file: File): Promise<Pick<PresentationDeck, 'title' | 'slides' | 'sourceType' | 'sourcePath'>> {
  const arrayBuffer = await fileToArrayBuffer(file);
  const pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  const slides: PresentationSlide[] = [];

  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const textContent = await page.getTextContent();
    const text = textContent.items
      .map((item) => ('str' in item ? (item as any).str : ''))
      .join(' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
    slides.push(createSlide(text, slides.length));
  }

  return {
    title: file.name.replace(/\.pdf$/i, ''),
    slides,
    sourceType: 'pdf',
    sourcePath: file.name,
  };
}
