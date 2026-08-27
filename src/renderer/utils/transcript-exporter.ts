/**
 * Transcript Exporter Utility for Bible Song Pro Studio.
 * Handles generation and export of live sermon transcripts to:
 * - Markdown (.md)
 * - Microsoft Word (.docx)
 * - Portable Document Format (.pdf)
 * - Structured JSON (.json)
 */

export interface TranscriptScriptureQuote {
  reference: string;
  text?: string;
  version?: string;
}

export interface TranscriptExportPayload {
  churchName?: string;
  title?: string;
  speaker?: string;
  dateTime?: string;
  transcript: string;
  scriptures?: TranscriptScriptureQuote[];
}

/**
 * Splits raw transcript text into well-formatted paragraphs for clean reading.
 */
export function formatTranscriptIntoParagraphs(text: string, sentencesPerParagraph = 3): string[] {
  const clean = String(text || '').trim();
  if (!clean) return [];

  // Match sentences ending in punctuation or sensible break points
  const rawSentences = clean
    .replace(/([.?!])\s+/g, '$1|BSP_SPLIT|')
    .split('|BSP_SPLIT|')
    .map((s) => s.trim())
    .filter(Boolean);

  if (rawSentences.length <= sentencesPerParagraph) {
    return [clean];
  }

  const paragraphs: string[] = [];
  let currentGroup: string[] = [];

  for (const sentence of rawSentences) {
    currentGroup.push(sentence);
    if (currentGroup.length >= sentencesPerParagraph) {
      paragraphs.push(currentGroup.join(' '));
      currentGroup = [];
    }
  }

  if (currentGroup.length > 0) {
    paragraphs.push(currentGroup.join(' '));
  }

  return paragraphs;
}

/**
 * Builds clean Markdown for church sermon notes.
 */
export function formatTranscriptMarkdown(payload: TranscriptExportPayload): string {
  const title = (payload.title || 'Sermon Transcript').trim();
  const church = (payload.churchName || '').trim();
  const speaker = (payload.speaker || '').trim();
  const dateTime = (payload.dateTime || new Date().toLocaleString()).trim();
  const scriptures = payload.scriptures || [];
  const paragraphs = formatTranscriptIntoParagraphs(payload.transcript);

  const lines: string[] = [];

  // Header Title
  lines.push(`# ${title}`, '');

  // Metadata Tags
  const metaItems: string[] = [];
  if (church) metaItems.push(`**Church:** ${church}`);
  if (speaker) metaItems.push(`**Speaker:** ${speaker}`);
  if (dateTime) metaItems.push(`**Date & Time:** ${dateTime}`);

  if (metaItems.length > 0) {
    lines.push(metaItems.join('  \n'), '');
  }

  lines.push('---', '');

  // Scripture Quotes Section (if scriptures were mentioned or detected)
  if (scriptures.length > 0) {
    lines.push('## Mentioned Scriptures', '');
    for (const item of scriptures) {
      const ref = item.reference.trim();
      const version = item.version ? ` (${item.version})` : '';
      if (item.text && item.text.trim()) {
        lines.push(`> *“${item.text.trim()}”*`, `> `, `> — **${ref}${version}**`, '');
      } else {
        lines.push(`> — **${ref}${version}**`, '');
      }
    }
    lines.push('---', '');
  }

  // Sermon Transcript Body
  lines.push('## Sermon Transcript', '');
  if (paragraphs.length > 0) {
    for (const p of paragraphs) {
      lines.push(p, '');
    }
  } else {
    lines.push('_No transcript recorded._', '');
  }

  return lines.join('\n');
}

/**
 * Builds formatted JSON object.
 */
export function buildTranscriptJson(payload: TranscriptExportPayload): string {
  const data = {
    title: payload.title || 'Sermon Transcript',
    churchName: payload.churchName || '',
    speaker: payload.speaker || '',
    dateTime: payload.dateTime || new Date().toISOString(),
    scriptures: payload.scriptures || [],
    transcript: payload.transcript || '',
    paragraphs: formatTranscriptIntoParagraphs(payload.transcript),
    exportedAt: new Date().toISOString(),
    generator: 'Bible Song Pro Studio',
  };
  return JSON.stringify(data, null, 2);
}

// ---------------------------------------------------------------------------
// Word .docx generation (Pure Client-side OpenXML)
// ---------------------------------------------------------------------------

function escapeXml(unsafe: string): string {
  return String(unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function makeCrc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc ^= bytes[i];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeZipBlob(files: Array<{ name: string; content: string }>, mimeType: string): Blob {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  const entries: Array<{ nameBytes: Uint8Array; dataBytes: Uint8Array; crc: number; offset: number }> = [];
  let offset = 0;
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

  files.forEach((file) => {
    const nameBytes = encoder.encode(file.name);
    const dataBytes = encoder.encode(file.content);
    const crc = makeCrc32(dataBytes);
    const local = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, dosTime, true);
    localView.setUint16(12, dosDate, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, dataBytes.length, true);
    localView.setUint32(22, dataBytes.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true);
    local.set(nameBytes, 30);
    localParts.push(local, dataBytes);
    entries.push({ nameBytes, dataBytes, crc, offset });
    offset += local.length + dataBytes.length;
  });

  entries.forEach((entry) => {
    const central = new Uint8Array(46 + entry.nameBytes.length);
    const view = new DataView(central.buffer);
    view.setUint32(0, 0x02014b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 20, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, 0, true);
    view.setUint16(12, dosTime, true);
    view.setUint16(14, dosDate, true);
    view.setUint32(16, entry.crc, true);
    view.setUint32(20, entry.dataBytes.length, true);
    view.setUint32(24, entry.dataBytes.length, true);
    view.setUint16(28, entry.nameBytes.length, true);
    view.setUint16(30, 0, true);
    view.setUint16(32, 0, true);
    view.setUint16(34, 0, true);
    view.setUint16(36, 0, true);
    view.setUint32(38, 0, true);
    view.setUint32(42, entry.offset, true);
    central.set(entry.nameBytes, 46);
    centralParts.push(central);
  });

  const centralOffset = offset;
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, centralOffset, true);
  endView.setUint16(20, 0, true);

  const totalLength = [...localParts, ...centralParts, end].reduce((sum, p) => sum + p.length, 0);
  const finalBytes = new Uint8Array(totalLength);
  let pos = 0;
  for (const part of [...localParts, ...centralParts, end]) {
    finalBytes.set(part, pos);
    pos += part.length;
  }

  return new Blob([finalBytes], { type: mimeType });
}

export function buildTranscriptDocxBlob(payload: TranscriptExportPayload): Blob {
  const title = (payload.title || 'Sermon Transcript').trim();
  const church = (payload.churchName || '').trim();
  const speaker = (payload.speaker || '').trim();
  const dateTime = (payload.dateTime || new Date().toLocaleString()).trim();
  const scriptures = payload.scriptures || [];
  const paragraphs = formatTranscriptIntoParagraphs(payload.transcript);

  let bodyXml = '';

  // Title
  bodyXml += `
    <w:p>
      <w:pPr>
        <w:jc w:val="left"/>
        <w:spacing w:before="120" w:after="160"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
          <w:b/>
          <w:sz w:val="48"/>
          <w:color w:val="1F2937"/>
        </w:rPr>
        <w:t>${escapeXml(title)}</w:t>
      </w:r>
    </w:p>`;

  // Metadata line
  const metaParts: string[] = [];
  if (church) metaParts.push(church);
  if (speaker) metaParts.push(speaker);
  if (dateTime) metaParts.push(dateTime);

  if (metaParts.length > 0) {
    bodyXml += `
      <w:p>
        <w:pPr>
          <w:spacing w:before="0" w:after="240"/>
          <w:pBdr>
            <w:bottom w:val="single" w:sz="6" w:space="8" w:color="E5E7EB"/>
          </w:pBdr>
        </w:pPr>
        <w:r>
          <w:rPr>
            <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
            <w:sz w:val="20"/>
            <w:color w:val="6B7280"/>
          </w:rPr>
          <w:t>${escapeXml(metaParts.join('  •  '))}</w:t>
        </w:r>
      </w:p>`;
  }

  // Scriptures section
  if (scriptures.length > 0) {
    bodyXml += `
      <w:p>
        <w:pPr>
          <w:spacing w:before="240" w:after="120"/>
        </w:pPr>
        <w:r>
          <w:rPr>
            <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
            <w:b/>
            <w:sz w:val="28"/>
            <w:color w:val="374151"/>
          </w:rPr>
          <w:t>Mentioned Scriptures</w:t>
        </w:r>
      </w:p>`;

    for (const sc of scriptures) {
      const ref = sc.reference.trim();
      const ver = sc.version ? ` (${sc.version})` : '';

      // Scripture Quote Callout Box
      if (sc.text && sc.text.trim()) {
        bodyXml += `
          <w:p>
            <w:pPr>
              <w:ind w:left="480"/>
              <w:spacing w:before="80" w:after="40"/>
              <w:pBdr>
                <w:left w:val="single" w:sz="18" w:space="12" w:color="C9A96E"/>
              </w:pBdr>
            </w:pPr>
            <w:r>
              <w:rPr>
                <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
                <w:i/>
                <w:sz w:val="22"/>
                <w:color w:val="1F2937"/>
              </w:rPr>
              <w:t>“${escapeXml(sc.text.trim())}”</w:t>
            </w:r>
          </w:p>`;
      }

      // Scripture Reference
      bodyXml += `
        <w:p>
          <w:pPr>
            <w:ind w:left="480"/>
            <w:spacing w:before="0" w:after="160"/>
            <w:pBdr>
              <w:left w:val="single" w:sz="18" w:space="12" w:color="C9A96E"/>
            </w:pBdr>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
              <w:b/>
              <w:sz w:val="20"/>
              <w:color w:val="C9A96E"/>
            </w:rPr>
            <w:t>— ${escapeXml(ref + ver)}</w:t>
          </w:r>
        </w:p>`;
    }
  }

  // Sermon Transcript Section Heading
  bodyXml += `
    <w:p>
      <w:pPr>
        <w:spacing w:before="280" w:after="120"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
          <w:b/>
          <w:sz w:val="28"/>
          <w:color w:val="374151"/>
        </w:rPr>
        <w:t>Sermon Transcript</w:t>
      </w:r>
    </w:p>`;

  // Paragraphs
  for (const para of paragraphs) {
    bodyXml += `
      <w:p>
        <w:pPr>
          <w:spacing w:before="0" w:after="160" w:line="300" w:lineRule="auto"/>
        </w:pPr>
        <w:r>
          <w:rPr>
            <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
            <w:sz w:val="22"/>
            <w:color w:val="1F2937"/>
          </w:rPr>
          <w:t>${escapeXml(para)}</w:t>
        </w:r>
      </w:p>`;
  }

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${bodyXml}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  return makeZipBlob([
    {
      name: '[Content_Types].xml',
      content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    },
    {
      name: '_rels/.rels',
      content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    },
    { name: 'word/document.xml', content: documentXml },
  ], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
}

// ---------------------------------------------------------------------------
// PDF Generation (Pure Client-side PDF 1.4)
// ---------------------------------------------------------------------------

function escapePdfText(value: string): string {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/\r/g, '')
    .replace(/\t/g, '    ');
}

function wrapPdfTextLine(text: string, maxChars: number): string[] {
  if (!text) return [''];
  const words = text.split(/\s+/);
  const wrapped: string[] = [];
  let current = '';

  for (const word of words) {
    if (!current) {
      current = word;
      continue;
    }
    if (current.length + 1 + word.length > maxChars) {
      wrapped.push(current);
      current = word;
    } else {
      current += ` ${word}`;
    }
  }
  if (current) wrapped.push(current);
  return wrapped;
}

export function buildTranscriptPdfBlob(payload: TranscriptExportPayload): Blob {
  const markdown = formatTranscriptMarkdown(payload);
  const rawLines = markdown.split('\n');

  const formattedLines: Array<{ text: string; font: 'F1' | 'F2' | 'F3'; size: number; spacing: number }> = [];

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i].trim();
    if (!line) {
      formattedLines.push({ text: '', font: 'F1', size: 10, spacing: 8 });
      continue;
    }

    if (line.startsWith('# ')) {
      const wrapped = wrapPdfTextLine(line.replace(/^#\s+/, ''), 45);
      wrapped.forEach((w) => formattedLines.push({ text: w, font: 'F2', size: 18, spacing: 22 }));
    } else if (line.startsWith('## ')) {
      const wrapped = wrapPdfTextLine(line.replace(/^##\s+/, ''), 55);
      wrapped.forEach((w) => formattedLines.push({ text: w, font: 'F2', size: 13, spacing: 18 }));
    } else if (line.startsWith('> *“') || line.startsWith('>*“') || line.startsWith('> *')) {
      const cleaned = line.replace(/^>\s*\*?/, '').replace(/\*?$/, '').trim();
      const wrapped = wrapPdfTextLine(cleaned, 72);
      wrapped.forEach((w) => formattedLines.push({ text: `    ${w}`, font: 'F3', size: 10.5, spacing: 14 }));
    } else if (line.startsWith('> — **') || line.startsWith('> —')) {
      const cleaned = line.replace(/^>\s*—\s*\*?\*?/, '').replace(/\*?\*?$/, '').trim();
      formattedLines.push({ text: `    — ${cleaned}`, font: 'F2', size: 10, spacing: 14 });
    } else if (line === '---') {
      formattedLines.push({ text: '____________________________________________________________________', font: 'F1', size: 8, spacing: 12 });
    } else {
      const wrapped = wrapPdfTextLine(line.replace(/\*\*/g, ''), 78);
      wrapped.forEach((w) => formattedLines.push({ text: w, font: 'F1', size: 10, spacing: 13.5 }));
    }
  }

  // Paginate lines (~50 lines per letter page)
  const linesPerPage = 48;
  const pages: Array<typeof formattedLines> = [];
  for (let i = 0; i < formattedLines.length; i += linesPerPage) {
    pages.push(formattedLines.slice(i, i + linesPerPage));
  }
  if (!pages.length) {
    pages.push([{ text: payload.title || 'Sermon Transcript', font: 'F2', size: 18, spacing: 22 }]);
  }

  const objects: string[] = [];
  const addObject = (body: string) => {
    objects.push(String(body));
    return objects.length;
  };

  addObject('<< /Type /Catalog /Pages 2 0 R >>'); // 1
  const pagesId = addObject(''); // 2 (placeholder for pages)
  const fontRegularId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'); // 3
  const fontBoldId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>'); // 4
  const fontItalicId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >>'); // 5

  const pageIds: number[] = [];
  pages.forEach((pageItems, pageIdx) => {
    let streamContent = 'BT\n';
    let currentY = 740;
    const leftMargin = 54;

    pageItems.forEach((item) => {
      if (!item.text) {
        currentY -= item.spacing;
        return;
      }
      const escaped = escapePdfText(item.text);
      streamContent += `/${item.font} ${item.size} Tf\n`;
      streamContent += `1 0 0 1 ${leftMargin} ${currentY} Tm\n`;
      streamContent += `(${escaped}) Tj\n`;
      currentY -= item.spacing;
    });

    // Page number footer
    streamContent += `/F1 8 Tf\n`;
    streamContent += `1 0 0 1 280 36 Tm\n`;
    streamContent += `(Page ${pageIdx + 1} of ${pages.length}) Tj\n`;
    streamContent += 'ET';

    const streamObjId = addObject(`<< /Length ${streamContent.length} >>\nstream\n${streamContent}\nendstream`);
    const pageObjId = addObject(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R /F3 ${fontItalicId} 0 R >> >> /Contents ${streamObjId} 0 R >>`
    );
    pageIds.push(pageObjId);
  });

  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return new Blob([pdf], { type: 'application/pdf' });
}

// ---------------------------------------------------------------------------
// Download & Clipboard Helpers
// ---------------------------------------------------------------------------

export function downloadTranscriptFile(filename: string, content: string | Blob, mimeType = 'text/plain;charset=utf-8') {
  const blob = typeof content === 'string' ? new Blob([content], { type: mimeType }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyTranscriptMarkdown(payload: TranscriptExportPayload): Promise<boolean> {
  const md = formatTranscriptMarkdown(payload);
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(md);
      return true;
    } catch {
      // fallback below
    }
  }
  const textarea = document.createElement('textarea');
  textarea.value = md;
  document.body.appendChild(textarea);
  textarea.select();
  const success = document.execCommand('copy');
  document.body.removeChild(textarea);
  return success;
}
