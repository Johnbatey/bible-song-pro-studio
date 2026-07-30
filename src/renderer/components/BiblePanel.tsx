import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import type { BibleBook, BibleSearchResult, BibleVerse, BibleVersion, Scene } from '../types';

const FALLBACK_BOOKS = ['Genesis', 'Exodus', 'Psalms', 'Isaiah', 'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans', 'Revelation'];

export function BiblePanel() {
  const projectScene = useAppStore((s) => s.projectScene);
  const addVerseToHistory = useAppStore((s) => s.addVerseToHistory);
  const outputMode = useAppStore((s) => s.display.outputMode);
  const operatingMode = useAppStore((s) => s.display.mode);

  const [versions, setVersions] = useState<BibleVersion[]>([]);
  const [books, setBooks] = useState<BibleBook[]>([]);
  const [selectedVersion, setSelectedVersion] = useState('KJV');
  const [secondaryVersion, setSecondaryVersion] = useState('NKJV');
  const [dualVersion, setDualVersion] = useState(false);
  const [selectedBook, setSelectedBook] = useState('John');
  const [chapter, setChapter] = useState(3);
  const [query, setQuery] = useState('John 3:16');
  const [mode, setMode] = useState<'text' | 'buttons'>('buttons');
  const [results, setResults] = useState<BibleSearchResult[]>([]);
  const [chapterVerses, setChapterVerses] = useState<BibleVerse[]>([]);
  const [pinned, setPinned] = useState<BibleVerse[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const currentVersion = versions.find((v) => v.id === selectedVersion);
  const versionOptions = versions.length ? versions : [
    { id: 'KJV', name: 'King James Version', abbreviation: 'KJV', language: 'en', books: [] },
    { id: 'NKJV', name: 'New King James Version', abbreviation: 'NKJV', language: 'en', books: [] },
    { id: 'NASB', name: 'New American Standard Bible', abbreviation: 'NASB', language: 'en', books: [] },
    { id: 'NLT', name: 'New Living Translation', abbreviation: 'NLT', language: 'en', books: [] },
  ];
  const bookOptions = books.length ? books : FALLBACK_BOOKS.map((name) => ({ name, chapters: 1 }));

  useEffect(() => {
    window.BSP?.bible?.getVersions()
      .then((loaded) => {
        setVersions(loaded);
        const first = loaded.find((v) => v.id === selectedVersion) || loaded[0];
        if (first) setBooks(first.books || []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    window.BSP?.bible?.getBooks(selectedVersion).then(setBooks).catch(() => {});
  }, [selectedVersion]);

  useEffect(() => {
    loadChapter();
  }, [selectedVersion, selectedBook, chapter]);

  const selectedChapterCount = useMemo(() => {
    return bookOptions.find((b) => b.name === selectedBook)?.chapters || 1;
  }, [bookOptions, selectedBook]);

  async function loadChapter() {
    if (!window.BSP?.bible) return;
    const verses = await window.BSP.bible.getChapter({ versionId: selectedVersion, book: selectedBook, chapter }).catch(() => []);
    setChapterVerses(verses);
  }

  async function runSearch(nextQuery = query) {
    if (!window.BSP?.bible) return;
    setIsLoading(true);
    const found = await window.BSP.bible.search({ versionId: selectedVersion, query: nextQuery, limit: 40 }).catch(() => []);
    setResults(found);
    if (found[0]) {
      setSelectedBook(found[0].book);
      setChapter(found[0].chapter);
    }
    setIsLoading(false);
  }

  /** Fetches the same reference in the comparison translation, if one is selected. */
  async function fetchSecondary(verse: BibleVerse) {
    if (!dualVersion) return undefined;
    const secondary = await window.BSP?.bible?.search({ versionId: secondaryVersion, query: verse.reference, limit: 1 }).catch(() => []);
    const second = secondary?.[0];
    if (!second) return undefined;
    return { text: second.text, reference: second.reference, version: secondaryVersion };
  }

  async function sendVerse(verse: BibleVerse, opts: { direct?: boolean } = {}) {
    const secondaryVerse = await fetchSecondary(verse);
    const scene: Scene = {
      id: `bible-${Date.now()}`,
      name: verse.reference,
      type: 'bible',
      content: {
        text: verse.text,
        reference: `${verse.reference} (${secondaryVerse ? `${verse.version} / ${secondaryVersion}` : verse.version})`,
        version: dualVersion ? `${verse.version}/${secondaryVersion}` : verse.version,
        // Rendered as a true side-by-side comparison rather than two blocks of
        // text jammed into one paragraph
        secondaryVerse,
      },
      background: {
        type: 'gradient',
        gradient: outputMode === 'lowerThird'
          ? 'linear-gradient(180deg, rgba(0,0,0,0), rgba(0,0,0,0.82))'
          : 'linear-gradient(135deg, #0f172a, #1e1b4b, #312e81)',
      },
      transition: { type: 'fade', duration: 0.45, easing: 'ease' },
    };
    addVerseToHistory(verse);
    projectScene(scene, { direct: opts.direct });
  }

  function pinCurrent() {
    const verse = results[0] || chapterVerses[0];
    if (!verse) return;
    setPinned((items) => [verse, ...items.filter((item) => item.reference !== verse.reference)].slice(0, 8));
  }

  return (
    <div>
      <div style={styles.header}>
        <h2 style={styles.h2}>Bible</h2>
        <div style={styles.segmented}>
          <button className={`btn btn-sm ${mode === 'text' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setMode('text')}>Text</button>
          <button className={`btn btn-sm ${mode === 'buttons' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setMode('buttons')}>Buttons</button>
        </div>
      </div>

      <div className="glass" style={styles.searchShell}>
        <div style={styles.searchRow}>
          <input
            className="input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runSearch()}
            placeholder="Search reference or words, e.g. John 3:16"
          />
          <button className="btn btn-primary btn-sm" onClick={() => runSearch()}>{isLoading ? '...' : 'Search'}</button>
          <button className="btn btn-secondary btn-sm" onClick={pinCurrent}>Pin</button>
        </div>

        <div style={styles.versionBar}>
          {versionOptions.map((version) => (
            <button
              key={version.id}
              className={`btn btn-sm ${selectedVersion === version.id ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setSelectedVersion(version.id)}
              title={version.name}
            >
              {version.abbreviation}
            </button>
          ))}
          <label style={styles.inlineToggle}>
            <input type="checkbox" checked={dualVersion} onChange={(e) => setDualVersion(e.target.checked)} />
            Dual
          </label>
          {dualVersion && (
            <select className="input" value={secondaryVersion} onChange={(e) => setSecondaryVersion(e.target.value)} style={styles.secondarySelect}>
              {versionOptions.map((version) => <option key={version.id} value={version.id}>{version.abbreviation}</option>)}
            </select>
          )}
        </div>

        <div style={styles.navRow}>
          <select className="input" value={selectedBook} onChange={(e) => setSelectedBook(e.target.value)} style={{ flex: 2 }}>
            {bookOptions.map((book) => <option key={book.name} value={book.name}>{book.name}</option>)}
          </select>
          <select className="input" value={chapter} onChange={(e) => setChapter(Number(e.target.value))} style={{ flex: 1 }}>
            {Array.from({ length: selectedChapterCount }, (_, i) => i + 1).map((num) => <option key={num} value={num}>Ch {num}</option>)}
          </select>
          <button className="btn btn-secondary btn-sm" onClick={() => setChapter(Math.max(1, chapter - 1))}>Prev</button>
          <button className="btn btn-secondary btn-sm" onClick={() => setChapter(Math.min(selectedChapterCount, chapter + 1))}>Next</button>
        </div>
      </div>

      {pinned.length > 0 && (
        <div style={styles.chips}>
          {pinned.map((verse) => (
            <button
              key={verse.reference}
              className="btn btn-sm btn-secondary"
              onClick={() => sendVerse(verse)}
              onDoubleClick={() => sendVerse(verse, { direct: true })}
            >
              {verse.reference}
            </button>
          ))}
        </div>
      )}

      {mode === 'text' ? (
        <textarea
          className="input"
          value={chapterVerses.map((v) => `${v.verse}. ${v.text}`).join('\n\n')}
          readOnly
          style={styles.textMode}
        />
      ) : (
        <div style={styles.grid}>
          {(results.length ? results : chapterVerses).map((verse) => (
            <button
              key={`${verse.reference}-${verse.version}`}
              style={styles.verseButton}
              onClick={() => sendVerse(verse)}
              onDoubleClick={() => sendVerse(verse, { direct: true })}
              title={operatingMode === 'studio'
                ? 'Click to stage in Preview · double-click to go straight to Program'
                : 'Click to go live'}
            >
              <span style={styles.verseRef}>{verse.reference}</span>
              <span style={styles.verseText}>{verse.text}</span>
            </button>
          ))}
        </div>
      )}

      <div style={styles.footerNote}>
        Active version: {currentVersion?.name || selectedVersion}. Click a verse card to load it into Preview.
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  h2: { fontSize: 16, fontWeight: 600 },
  segmented: { display: 'flex', gap: 6 },
  searchShell: { padding: 12, borderRadius: 'var(--radius-md)', marginBottom: 10 },
  searchRow: { display: 'flex', gap: 6, alignItems: 'center' },
  versionBar: { display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 },
  navRow: { display: 'flex', gap: 6, alignItems: 'center', marginTop: 10 },
  inlineToggle: { display: 'flex', alignItems: 'center', gap: 5, marginLeft: 6, fontSize: 11, color: 'var(--text-secondary)' },
  secondarySelect: { width: 84, height: 28, padding: '2px 8px', fontSize: 11 },
  chips: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 },
  verseButton: {
    border: '1px solid var(--border-primary)',
    background: 'var(--bg-surface)',
    color: 'var(--text-primary)',
    borderRadius: 8,
    padding: 12,
    textAlign: 'left',
    cursor: 'pointer',
    minHeight: 112,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    fontFamily: 'var(--font-sans)',
  },
  verseRef: { fontSize: 11, color: 'var(--accent)', fontWeight: 700 },
  verseText: { fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' },
  textMode: { minHeight: 360, resize: 'vertical', whiteSpace: 'pre-wrap', lineHeight: 1.55 },
  footerNote: { marginTop: 10, fontSize: 11, color: 'var(--text-dim)' },
};
