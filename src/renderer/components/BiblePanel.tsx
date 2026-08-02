import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import type { BibleBook, BibleSearchResult, BibleVerse, BibleVersion, Scene } from '../types';
import { type, fontWeight, numeric } from '../styles/type';
import { CustomDropdown } from './CustomDropdown';

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
  const [selectedBook, setSelectedBook] = useState('Genesis');
  const [chapter, setChapter] = useState(1);
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
    const primaryVer = verse.version || selectedVersion;
    const secondaryVer = secondaryVerse?.version || secondaryVersion;
    const scene: Scene = {
      id: sceneId,
      name: verse.reference,
      type: 'bible',
      content: {
        text: verse.text,
        reference: secondaryVerse ? `${verse.reference} (${primaryVer})` : verse.reference,
        version: primaryVer,
        secondaryVerse: secondaryVerse
          ? {
              ...secondaryVerse,
              reference: `${secondaryVerse.reference || verse.reference} (${secondaryVer})`,
              version: secondaryVer,
            }
          : undefined,
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
      <div style={styles.searchShell}>
        <div style={styles.controlsRow}>
          {/* Custom Dark Version Dropdown Popup matching the reference design */}
          <CustomDropdown
            value={selectedVersion}
            options={versionOptions.map((v) => ({ value: v.id, label: v.abbreviation, sublabel: v.name }))}
            onChange={(val) => setSelectedVersion(val)}
            title="Select Translation"
          />

          {/* Segmented Pill Switcher with Clean SVGs matching the reference design */}
          <div style={styles.pillGroup}>
            <button
              style={{
                ...styles.pillBtn,
                background: !dualVersion ? '#FF5500' : 'transparent',
                color: !dualVersion ? '#ffffff' : '#a1a1aa',
              }}
              onClick={() => setDualVersion(false)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
              <span>Single Version</span>
            </button>
            <button
              style={{
                ...styles.pillBtn,
                background: dualVersion ? '#FF5500' : 'transparent',
                color: dualVersion ? '#ffffff' : '#a1a1aa',
              }}
              onClick={() => setDualVersion(true)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h3c0 1-1 2-2 3v1c0 1 1 3 4 4z" />
                <path d="M16 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h3c0 1-1 2-2 3v1c0 1 1 3 4 4z" />
              </svg>
              <span>Dual Version</span>
            </button>
          </div>

          {/* Secondary Version Selector when Dual Version is active */}
          {dualVersion && (
            <CustomDropdown
              value={secondaryVersion}
              options={versionOptions.map((v) => ({ value: v.id, label: `+ ${v.abbreviation}`, sublabel: v.name }))}
              onChange={(val) => setSecondaryVersion(val)}
              title="Secondary Parallel Translation"
            />
          )}

          {/* Unified Search Input (Book/Reference and Keyword search together) */}
          <input
            style={styles.searchInput}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            onBlur={() => setQuery((current) => normalizeReferenceQuery(current))}
            placeholder="John 3:16 or keyword search..."
          />

          {/* Previous & Next Chapter Navigation Buttons */}
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              style={styles.iconNavBtn}
              disabled={!visibleVerses.length}
              onClick={() => sendAdjacentVerse(-1)}
              title="Previous chapter"
            >
              ‹
            </button>
            <button
              style={styles.iconNavBtn}
              disabled={!visibleVerses.length}
              onClick={() => sendAdjacentVerse(1)}
              title="Next chapter"
            >
              ›
            </button>
          </div>
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
                ? '1px solid #ef4444'
                : isPreview
                ? '1px solid #3b82f6'
                : isHighlighted
                ? '1px solid #FF5500'
                : '1px solid rgba(255, 255, 255, 0.08)';

              const backgroundStyle = isHighlighted
                ? 'rgba(255, 85, 0, 0.12)'
                : isLive
                ? 'rgba(239, 68, 68, 0.08)'
                : isPreview
                ? 'rgba(59, 130, 246, 0.08)'
                : 'var(--bg-secondary)';

              return (
                <button
                  key={`${verse.reference}-${verse.version}`}
                  ref={(el) => { verseRefs.current[verse.verse] = el; }}
                  style={{
                    ...styles.verseButton,
                    border: borderStyle,
                    background: backgroundStyle,
                    transition: 'all 0.15s ease',
                  }}
                  onClick={() => sendVerse(verse)}
                  onDoubleClick={() => sendVerse(verse, { direct: true })}
                  title={operatingMode === 'studio'
                    ? 'Click to stage in Preview · double-click to go straight to Program'
                    : 'Click to go live'}
                >
                  <div style={{
                    width: 22,
                    height: 22,
                    borderRadius: 4,
                    background: isHighlighted ? '#FF5500' : 'rgba(255, 85, 0, 0.85)',
                    color: '#ffffff',
                    fontSize: 11,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: 1,
                  }}>
                    {verse.verse}
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {results.length > 0 && (
                        <span style={styles.verseRef}>
                          {verse.reference}
                        </span>
                      )}
                      {isLive && <span style={styles.liveBadge}>LIVE</span>}
                      {isPreview && !isLive && <span style={styles.previewBadge}>PREVIEW</span>}
                    </div>
                    <span style={{
                      ...styles.verseText,
                      color: isHighlighted ? '#ffffff' : '#d4d4d8',
                    }}>
                      {verse.text}
                    </span>
                  </div>
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
  searchShell: { padding: '8px 10px', borderRadius: 8, marginBottom: 10, flexShrink: 0, background: '#141416', border: '1px solid rgba(255, 255, 255, 0.08)' },
  controlsRow: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'nowrap' },
  versionSelect: {
    padding: '5px 10px',
    background: '#202024',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    outline: 'none',
  },
  pillGroup: {
    display: 'flex',
    background: '#202024',
    borderRadius: 6,
    padding: 3,
    border: '1px solid rgba(255, 255, 255, 0.08)',
    flexShrink: 0,
    height: 34,
    boxSizing: 'border-box',
  },
  pillBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    padding: '0 14px',
    height: 28,
    border: 'none',
    borderRadius: 4,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    fontFamily: 'var(--font-ui)',
  },
  searchInput: {
    flex: 1,
    height: 34,
    minWidth: 140,
    padding: '0 14px',
    background: '#202024',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
    color: '#ffffff',
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'var(--font-ui)',
  },
  iconNavBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 34,
    height: 34,
    background: '#202024',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
    color: '#ffffff',
    fontSize: 16,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  versionBar: { display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap', marginTop: 6 },
  inlineToggle: { display: 'flex', alignItems: 'center', gap: 5, marginLeft: 6, ...type.caption, color: 'var(--text-secondary)' },
  secondarySelect: { width: 84, height: 28, padding: '2px 8px', ...type.secondary },
  resultsPane: { flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: 2 },
  chips: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 },
  grid: { display: 'flex', flexDirection: 'column', gap: 6 },
  verseButton: {
    border: '1px solid rgba(255, 255, 255, 0.08)',
    background: 'var(--bg-secondary)',
    color: '#ffffff',
    borderRadius: 6,
    padding: '8px 12px',
    textAlign: 'left',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    fontFamily: 'var(--font-ui)',
  },
  verseRef: { ...type.caption, ...numeric, color: '#FF5500', fontWeight: fontWeight.bold },
  verseText: { fontSize: 13, lineHeight: 1.45, color: '#d4d4d8' },
  textMode: { minHeight: 360, height: '100%', resize: 'none', whiteSpace: 'pre-wrap', lineHeight: 1.55 },
  footerNote: { marginTop: 10, ...type.caption, color: 'var(--text-dim)' },
  liveBadge: { ...type.label, fontWeight: fontWeight.bold, padding: '2px 5px', borderRadius: 4, background: '#ef4444', color: '#fff' },
  previewBadge: { ...type.label, fontWeight: fontWeight.bold, padding: '2px 5px', borderRadius: 4, background: '#3b82f6', color: '#fff' },
  highlightBadge: { ...type.label, fontWeight: fontWeight.bold, padding: '2px 5px', borderRadius: 4, background: '#FF5500', color: '#fff' },
};
