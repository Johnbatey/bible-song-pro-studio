import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import type { BibleBook, BibleSearchResult, BibleVerse, BibleVersion, Scene } from '../types';
import { type, fontWeight, numeric } from '../styles/type';

const FALLBACK_BOOKS = ['Genesis', 'Exodus', 'Psalms', 'Isaiah', 'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans', 'Revelation'];

function normalizeSearchText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeReferenceQuery(value: string) {
  return normalizeSearchText(value)
    .replace(/^([1-3])(?=\p{L})/u, '$1 ')
    .replace(/^(.+?\s+\d+)\s+(\d+(?:\s*[-–]\s*\d+)?)$/u, '$1:$2')
    .replace(/\b(chapters?|chap|ch)\s+(\d+)\b/gi, '$2')
    .replace(/\b(verses?|vs?|v)\s+(\d+(?:\s*[-–]\s*\d+)?)\b/gi, ':$2')
    .replace(/\s*:\s*/g, ':')
    .replace(/\s*[-–]\s*/g, '-');
}

function bookCandidateMatches(input: string, books: BibleBook[]) {
  const candidate = normalizeSearchText(input).toLowerCase();
  const compact = candidate.replace(/\s+/g, '');
  if (candidate.length < 3 && !/^[1-3]\s*\p{L}{2,}/u.test(candidate)) return false;
  return books.some((book) => {
    const name = normalizeSearchText(book.name).toLowerCase();
    const compactName = name.replace(/\s+/g, '');
    return name === candidate ||
      name.startsWith(candidate) ||
      compactName === compact ||
      compactName.startsWith(compact);
  });
}

const BOOK_ALIASES: Record<string, string> = {
  gen: 'Genesis', ge: 'Genesis',
  ex: 'Exodus', exo: 'Exodus',
  lev: 'Leviticus', le: 'Leviticus',
  num: 'Numbers', nu: 'Numbers',
  deut: 'Deuteronomy', dt: 'Deuteronomy',
  josh: 'Joshua', jos: 'Joshua',
  judg: 'Judges', jdg: 'Judges',
  ruth: 'Ruth', ru: 'Ruth',
  '1sam': '1 Samuel', '1 sam': '1 Samuel', '1sa': '1 Samuel',
  '2sam': '2 Samuel', '2 sam': '2 Samuel', '2sa': '2 Samuel',
  '1kings': '1 Kings', '1 kings': '1 Kings', '1ki': '1 Kings',
  '2kings': '2 Kings', '2 kings': '2 Kings', '2ki': '2 Kings',
  '1chron': '1 Chronicles', '1 chron': '1 Chronicles',
  '2chron': '2 Chronicles', '2 chron': '2 Chronicles',
  ezra: 'Ezra', ezr: 'Ezra',
  neh: 'Nehemiah', ne: 'Nehemiah',
  esth: 'Esther', est: 'Esther',
  job: 'Job',
  ps: 'Psalms', psa: 'Psalms', psalm: 'Psalms', psalms: 'Psalms',
  prov: 'Proverbs', pr: 'Proverbs', pro: 'Proverbs',
  ecc: 'Ecclesiastes', eccl: 'Ecclesiastes',
  song: 'Song of Solomon', sos: 'Song of Solomon', canticles: 'Song of Solomon',
  isa: 'Isaiah', is: 'Isaiah',
  jer: 'Jeremiah', je: 'Jeremiah',
  lam: 'Lamentations', la: 'Lamentations',
  ezek: 'Ezekiel', eze: 'Ezekiel',
  dan: 'Daniel', da: 'Daniel',
  hos: 'Hosea', ho: 'Hosea',
  joel: 'Joel', joe: 'Joel',
  amos: 'Amos', am: 'Amos',
  obad: 'Obadiah', ob: 'Obadiah',
  jonah: 'Jonah', jon: 'Jonah',
  mic: 'Micah', mi: 'Micah',
  nah: 'Nahum', na: 'Nahum',
  hab: 'Habakkuk', habk: 'Habakkuk',
  zeph: 'Zephaniah', zep: 'Zephaniah',
  hag: 'Haggai', hgg: 'Haggai',
  zech: 'Zechariah', zec: 'Zechariah',
  mal: 'Malachi', ml: 'Malachi',
  matt: 'Matthew', mt: 'Matthew', mat: 'Matthew',
  mark: 'Mark', mk: 'Mark', mrk: 'Mark',
  luke: 'Luke', lk: 'Luke', luk: 'Luke',
  john: 'John', jn: 'John', jhn: 'John', joh: 'John',
  acts: 'Acts', ac: 'Acts',
  rom: 'Romans', ro: 'Romans', roms: 'Romans',
  '1cor': '1 Corinthians', '1 cor': '1 Corinthians',
  '2cor': '2 Corinthians', '2 cor': '2 Corinthians',
  gal: 'Galatians', ga: 'Galatians',
  eph: 'Ephesians', ep: 'Ephesians',
  phil: 'Philippians', php: 'Philippians',
  col: 'Colossians', cls: 'Colossians',
  '1thess': '1 Thessalonians', '1 th': '1 Thessalonians',
  '2thess': '2 Thessalonians', '2 th': '2 Thessalonians',
  '1tim': '1 Timothy', '1 ti': '1 Timothy',
  '2tim': '2 Timothy', '2 ti': '2 Timothy',
  titus: 'Titus', tit: 'Titus',
  philem: 'Philemon', phm: 'Philemon',
  heb: 'Hebrews', he: 'Hebrews',
  jas: 'James', jm: 'James', james: 'James',
  '1pet': '1 Peter', '1 pe': '1 Peter', '1pt': '1 Peter',
  '2pet': '2 Peter', '2 pe': '2 Peter', '2pt': '2 Peter',
  '1john': '1 John', '1 john': '1 John', '1jn': '1 John', '1 jn': '1 John', '1joh': '1 John', '1 joh': '1 John',
  '2john': '2 John', '2 john': '2 John', '2jn': '2 John', '2 jn': '2 John', '2joh': '2 John', '2 joh': '2 John',
  '3john': '3 John', '3 john': '3 John', '3jn': '3 John', '3 jn': '3 John', '3joh': '3 John', '3 joh': '3 John',
  jude: 'Jude', jud: 'Jude',
  rev: 'Revelation', re: 'Revelation', revelations: 'Revelation',
};

function parseReferenceQuery(query: string, books: BibleBook[]) {
  const normalized = normalizeReferenceQuery(query);
  const match = normalized.match(/^(.+?)\s+(\d+)(?::(\d*)(?:\s*[-–]\s*(\d+))?)?$/u);
  if (!match) return null;

  const rawBook = match[1].trim().toLowerCase();
  const chapterNum = Number(match[2]);
  if (isNaN(chapterNum) || chapterNum <= 0) return null;

  const verseStr = match[3]?.trim();
  const verseNum = verseStr && !isNaN(Number(verseStr)) && Number(verseStr) > 0 ? Number(verseStr) : null;

  const aliasMatch = BOOK_ALIASES[rawBook] || BOOK_ALIASES[rawBook.replace(/\s+/g, '')];

  let matchedBookName = '';
  if (aliasMatch) {
    const foundInBooks = books.find((b) => b.name.toLowerCase() === aliasMatch.toLowerCase());
    if (foundInBooks) matchedBookName = foundInBooks.name;
  }

  if (!matchedBookName) {
    const candidateLower = normalizeSearchText(rawBook).toLowerCase();
    const candidateCompact = candidateLower.replace(/\s+/g, '');

    const found = books.find((b) => {
      const name = normalizeSearchText(b.name).toLowerCase();
      const compactName = name.replace(/\s+/g, '');
      return name === candidateLower || compactName === candidateCompact;
    }) || books.find((b) => {
      const name = normalizeSearchText(b.name).toLowerCase();
      const compactName = name.replace(/\s+/g, '');
      return name.startsWith(candidateLower) || compactName.startsWith(candidateCompact);
    });

    if (found) matchedBookName = found.name;
  }

  if (!matchedBookName) return null;

  return {
    bookName: matchedBookName,
    chapter: chapterNum,
    verse: verseNum,
  };
}

export function BiblePanel() {
  const projectScene = useAppStore((s) => s.projectScene);
  const currentScene = useAppStore((s) => s.display.currentScene);
  const previewScene = useAppStore((s) => s.display.previewScene);
  const setCurrentScene = useAppStore((s) => s.setCurrentScene);
  const setPreviewScene = useAppStore((s) => s.setPreviewScene);
  const addVerseToHistory = useAppStore((s) => s.addVerseToHistory);
  const outputMode = useAppStore((s) => s.display.outputMode);
  const operatingMode = useAppStore((s) => s.display.mode);

  const [versions, setVersions] = useState<BibleVersion[]>([]);
  const [books, setBooks] = useState<BibleBook[]>([]);
  const [selectedVersion, setSelectedVersion] = useState('KJV');
  const [secondaryVersion, setSecondaryVersion] = useState('NKJV');
  const [dualVersion, setDualVersion] = useState(false);
  const [selectedBook, setSelectedBook] = useState('');
  const [chapter, setChapter] = useState(0);
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'text' | 'buttons'>('buttons');
  const [results, setResults] = useState<BibleSearchResult[]>([]);
  const [chapterVerses, setChapterVerses] = useState<BibleVerse[]>([]);
  const [highlightedVerse, setHighlightedVerse] = useState<number | null>(null);
  const [pinned, setPinned] = useState<BibleVerse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const searchTimerRef = useRef<number | null>(null);
  const verseRefs = useRef<Record<number, HTMLButtonElement | null>>({});

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

  useEffect(() => {
    const normalized = normalizeSearchText(query);
    if (!normalized) {
      setResults([]);
      setHighlightedVerse(null);
      return;
    }

    const parsedRef = parseReferenceQuery(query, bookOptions);
    if (parsedRef) {
      if (parsedRef.bookName !== selectedBook) {
        setSelectedBook(parsedRef.bookName);
      }
      if (parsedRef.chapter !== chapter) {
        setChapter(parsedRef.chapter);
      }
      setHighlightedVerse(parsedRef.verse);
      setResults([]);
      return;
    }

    setHighlightedVerse(null);
    const referenceLike = /^.+?\s+\d+(?::\d*(?:-\d*)?)?$/u.test(normalized);
    const shouldSearch = normalized.length >= 2 && (referenceLike || normalized.split(/\s+/).some((token) => token.length >= 2));

    if (searchTimerRef.current) {
      window.clearTimeout(searchTimerRef.current);
      searchTimerRef.current = null;
    }

    if (!shouldSearch) {
      setResults([]);
      return;
    }

    const delay = normalized.includes(':') ? 0 : 120;
    searchTimerRef.current = window.setTimeout(() => {
      void runSearch(query, { normalizeInput: false });
      searchTimerRef.current = null;
    }, delay);

    return () => {
      if (searchTimerRef.current) {
        window.clearTimeout(searchTimerRef.current);
        searchTimerRef.current = null;
      }
    };
  }, [query, selectedVersion, bookOptions]);

  useEffect(() => {
    if (highlightedVerse && verseRefs.current[highlightedVerse]) {
      verseRefs.current[highlightedVerse]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [highlightedVerse, chapterVerses]);

  const selectedChapterCount = useMemo(() => {
    if (!selectedBook) return 0;
    return bookOptions.find((b) => b.name === selectedBook)?.chapters || 1;
  }, [bookOptions, selectedBook]);

  async function loadChapter() {
    if (!window.BSP?.bible) return;
    if (!selectedBook || !chapter) {
      setChapterVerses([]);
      return;
    }
    const verses = await window.BSP.bible.getChapter({ versionId: selectedVersion, book: selectedBook, chapter }).catch(() => []);
    setChapterVerses(verses);
  }

  async function runSearch(nextQuery = query, opts: { normalizeInput?: boolean } = {}) {
    if (!window.BSP?.bible) return [];
    const searchQuery = normalizeReferenceQuery(nextQuery);
    if (opts.normalizeInput !== false && searchQuery !== nextQuery) setQuery(searchQuery);
    setIsLoading(true);
    const found = await window.BSP.bible.search({
      versionId: selectedVersion,
      query: searchQuery,
      limit: 200,
      book: '',
    }).catch(() => []);
    setResults(found);
    setIsLoading(false);
    return found;
  }

  /** Fetches the same reference in the comparison translation, if one is selected. */
  async function fetchSecondary(verse: BibleVerse) {
    if (!dualVersion) return undefined;
    const secondary = await window.BSP?.bible?.search({ versionId: secondaryVersion, query: verse.reference, limit: 1 }).catch(() => []);
    const second = secondary?.[0];
    if (!second) return undefined;
    return { text: second.text, reference: second.reference, version: secondaryVersion };
  }

  const visibleVerses = results.length ? results : chapterVerses;

  function bibleSceneId(verse: BibleVerse) {
    return `bible-${verse.version}-${verse.reference}`.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9:._/-]/g, '');
  }

  async function sendVerse(verse: BibleVerse, opts: { direct?: boolean } = {}) {
    const secondaryVerse = await fetchSecondary(verse);
    const sceneId = bibleSceneId(verse);
    const goesLive = opts.direct || operatingMode === 'basic';
    const activeScene = goesLive ? currentScene : previewScene;
    if (activeScene?.id === sceneId) {
      if (goesLive) {
        setCurrentScene(null);
        setPreviewScene(null);
      } else {
        setPreviewScene(null);
      }
      return;
    }
    const scene: Scene = {
      id: sceneId,
      name: verse.reference,
      type: 'bible',
      content: {
        text: verse.text,
        reference: `${verse.reference} (${secondaryVerse ? `${verse.version} / ${secondaryVersion}` : verse.version})`,
        version: dualVersion ? `${verse.version}/${secondaryVersion}` : verse.version,
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

  async function sendAdjacentVerse(direction: 1 | -1) {
    if (!visibleVerses.length) return;
    const activeReference = currentScene?.type === 'bible'
      ? currentScene.name
      : previewScene?.type === 'bible'
        ? previewScene.name
        : '';
    const currentIndex = visibleVerses.findIndex((verse) => verse.reference === activeReference);
    const fallbackIndex = direction > 0 ? -1 : visibleVerses.length;
    const nextIndex = Math.max(0, Math.min(visibleVerses.length - 1, (currentIndex === -1 ? fallbackIndex : currentIndex) + direction));
    const verse = visibleVerses[nextIndex];
    if (verse) await sendVerse(verse, { direct: true });
  }

  function pinCurrent() {
    const verse = (highlightedVerse ? chapterVerses.find((v) => v.verse === highlightedVerse) : null) || results[0] || chapterVerses[0];
    if (!verse) return;
    setPinned((items) => [verse, ...items.filter((item) => item.reference !== verse.reference)].slice(0, 8));
  }

  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    const isSpaceKey = event.key === ' ' || event.key === 'Space' || event.code === 'Space';
    if (isSpaceKey) {
      const input = event.currentTarget;
      const cursorPos = input.selectionStart ?? query.length;
      const textBeforeCursor = query.slice(0, cursorPos);
      const textAfterCursor = query.slice(cursorPos);
      const match = textBeforeCursor.match(/^([\p{L}1-3 ]+)\s+(\d+)$/u) ||
        textBeforeCursor.match(/^([\p{L}1-3 ]+?)(\d+)$/u);
      if (match && (!textAfterCursor || /^\s*$/.test(textAfterCursor)) && bookCandidateMatches(match[1], bookOptions)) {
        event.preventDefault();
        let displayBook = String(match[1] || '').trim().replace(/\s+/g, ' ');
        displayBook = displayBook.replace(/^([1-3])(?=\p{L})/u, '$1 ');
        const next = `${displayBook} ${match[2]}:${textAfterCursor}`;
        const nextCursor = `${displayBook} ${match[2]}:`.length;
        setQuery(next);
        window.requestAnimationFrame(() => {
          input.selectionStart = input.selectionEnd = nextCursor;
        });
        return;
      }
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      void (async () => {
        let verseToSend: BibleVerse | undefined;
        const parsedRef = parseReferenceQuery(query, bookOptions);
        if (parsedRef && parsedRef.verse) {
          verseToSend = chapterVerses.find((v) => v.verse === parsedRef.verse);
          if (!verseToSend) {
            const verses = await window.BSP?.bible?.getChapter({
              versionId: selectedVersion,
              book: parsedRef.bookName,
              chapter: parsedRef.chapter,
            }).catch(() => []);
            verseToSend = verses.find((v) => v.verse === parsedRef.verse);
          }
        }
        if (!verseToSend) {
          const found = await runSearch();
          verseToSend = found[0] || results[0];
        }
        if (verseToSend) await sendVerse(verseToSend, { direct: true });
      })();
    }
  }

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      if (!containerRef.current || containerRef.current.offsetParent === null) return;
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      if (tagName === 'input' || tagName === 'textarea' || tagName === 'select' || target?.isContentEditable) return;
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        void sendAdjacentVerse(1);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        void sendAdjacentVerse(-1);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visibleVerses, currentScene, previewScene, dualVersion, secondaryVersion, selectedVersion, outputMode, operatingMode]);

  return (
    <div ref={containerRef} style={styles.panel}>
      <div style={styles.header}>
        <h2 style={styles.h2}>Bible</h2>
        <div style={styles.segmented}>
          <button className={`btn btn-sm ${mode === 'text' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setMode('text')}>Text</button>
          <button className={`btn btn-sm ${mode === 'buttons' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setMode('buttons')}>Buttons</button>
        </div>
      </div>

      <div className="glass" style={styles.searchShell}>
        <div style={styles.controlsRow}>
          <input
            className="input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            onBlur={() => setQuery((current) => normalizeReferenceQuery(current))}
            placeholder="Search reference or words, e.g. John 3:16"
            style={{ flex: 1, minWidth: 180 }}
          />
          <button className="btn btn-secondary btn-sm" onClick={pinCurrent}>Pin</button>

          <select
            className="input"
            value={selectedBook}
            onChange={(e) => {
              const nextBook = e.target.value;
              setSelectedBook(nextBook);
              setChapter(nextBook ? 1 : 0);
              setResults([]);
              setHighlightedVerse(null);
            }}
            style={{ width: 140 }}
          >
            <option value="">Select Book</option>
            {bookOptions.map((book) => <option key={book.name} value={book.name}>{book.name}</option>)}
          </select>
          <select
            className="input"
            value={chapter || ''}
            onChange={(e) => {
              setChapter(Number(e.target.value) || 0);
              setResults([]);
              setHighlightedVerse(null);
            }}
            disabled={!selectedBook}
            style={{ width: 72 }}
          >
            <option value="">Ch</option>
            {Array.from({ length: selectedChapterCount }, (_, i) => i + 1).map((num) => <option key={num} value={num}>Ch {num}</option>)}
          </select>

          <button className="btn btn-secondary btn-sm" disabled={!visibleVerses.length} onClick={() => sendAdjacentVerse(-1)}>Prev</button>
          <button className="btn btn-secondary btn-sm" disabled={!visibleVerses.length} onClick={() => sendAdjacentVerse(1)}>Next</button>
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
      </div>

      <div style={styles.resultsPane}>
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
            {(results.length ? results : chapterVerses).map((verse) => {
              const isHighlighted = !results.length && highlightedVerse === verse.verse;
              const isLive = currentScene?.type === 'bible' && currentScene.name === verse.reference;
              const isPreview = previewScene?.type === 'bible' && previewScene.name === verse.reference;

              const borderStyle = isLive
                ? '2px solid #ef4444'
                : isPreview
                ? '2px solid #3b82f6'
                : isHighlighted
                ? '2px solid var(--accent, #eab308)'
                : '1px solid var(--border-primary)';

              const backgroundStyle = isHighlighted
                ? 'rgba(234, 179, 8, 0.12)'
                : isLive
                ? 'rgba(239, 68, 68, 0.08)'
                : isPreview
                ? 'rgba(59, 130, 246, 0.08)'
                : 'var(--bg-surface)';

              const boxShadowStyle = isHighlighted
                ? '0 0 12px rgba(234, 179, 8, 0.25)'
                : 'none';

              return (
                <button
                  key={`${verse.reference}-${verse.version}`}
                  ref={(el) => { verseRefs.current[verse.verse] = el; }}
                  style={{
                    ...styles.verseButton,
                    border: borderStyle,
                    background: backgroundStyle,
                    boxShadow: boxShadowStyle,
                    transition: 'all 0.15s ease',
                  }}
                  onClick={() => sendVerse(verse)}
                  onDoubleClick={() => sendVerse(verse, { direct: true })}
                  title={operatingMode === 'studio'
                    ? 'Click to stage in Preview · double-click to go straight to Program'
                    : 'Click to go live'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{
                      ...styles.verseRef,
                      color: isHighlighted ? 'var(--accent, #eab308)' : styles.verseRef.color,
                      fontWeight: isHighlighted ? 800 : 700,
                    }}>
                      {verse.reference}
                    </span>
                    {isLive && <span style={styles.liveBadge}>LIVE</span>}
                    {isPreview && !isLive && <span style={styles.previewBadge}>PREVIEW</span>}
                    {isHighlighted && !isLive && !isPreview && <span style={styles.highlightBadge}>SEARCHED</span>}
                  </div>
                  <span style={styles.verseText}>{verse.text}</span>
                </button>
              );
            })}
          </div>
        )}

        <div style={styles.footerNote}>
          Active version: {currentVersion?.name || selectedVersion}. Click a verse card to load it into Preview.
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  panel: { height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  h2: { ...type.title },
  segmented: { display: 'flex', gap: 6 },
  searchShell: { padding: '8px 12px', borderRadius: 'var(--radius-md)', marginBottom: 10, flexShrink: 0 },
  controlsRow: { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' },
  versionBar: { display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap', marginTop: 6 },
  inlineToggle: { display: 'flex', alignItems: 'center', gap: 5, marginLeft: 6, ...type.caption, color: 'var(--text-secondary)' },
  secondarySelect: { width: 84, height: 28, padding: '2px 8px', ...type.secondary },
  resultsPane: { flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: 2 },
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
    fontFamily: 'var(--font-ui)',
  },
  verseRef: { ...type.caption, ...numeric, color: 'var(--accent)', fontWeight: fontWeight.semibold },
  verseText: { ...type.secondary, color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' },
  textMode: { minHeight: 360, height: '100%', resize: 'none', whiteSpace: 'pre-wrap', lineHeight: 1.55 },
  footerNote: { marginTop: 10, ...type.caption, color: 'var(--text-dim)' },
  liveBadge: { ...type.label, fontWeight: fontWeight.bold, padding: '2px 5px', borderRadius: 4, background: '#ef4444', color: '#fff' },
  previewBadge: { ...type.label, fontWeight: fontWeight.bold, padding: '2px 5px', borderRadius: 4, background: '#3b82f6', color: '#fff' },
  highlightBadge: { ...type.label, fontWeight: fontWeight.bold, padding: '2px 5px', borderRadius: 4, background: 'var(--accent, #eab308)', color: '#000' },
};
