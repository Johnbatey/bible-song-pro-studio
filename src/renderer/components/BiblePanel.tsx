import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import type { BibleBook, BibleSearchResult, BibleVerse, BibleVersion, Scene } from '../types';
import { type, fontWeight, numeric } from '../styles/type';
import { CustomDropdown } from './CustomDropdown';
import { SlidingSwitch } from './SlidingSwitch';
import { isFocusedDock } from './dock/dockFocus';
import { useBarPosition, MoveBarButton } from '../hooks/useBarPosition';
import { Block } from './Block';

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

/**
 * Marks what the search actually caught. Each word of the query is highlighted
 * on its own rather than only the whole phrase, so a multi-word search still
 * shows why a verse ranked where it did.
 */
function highlightTerm(text: string, term: string): React.ReactNode {
  const words = term.split(/\s+/).filter((w) => w.length >= 2);
  if (!words.length) return text;
  const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  if (parts.length === 1) return text;
  const lower = new Set(words.map((w) => w.toLowerCase()));
  return parts.map((part, i) =>
    lower.has(part.toLowerCase())
      ? <mark key={i} style={styles.mark}>{part}</mark>
      : <span key={i}>{part}</span>
  );
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
  const addToQueue = useAppStore((s) => s.addToQueue);
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
  /** Where the control bar sits — above the verse list, or under it. */
  const { position: barPosition, move: moveBar } = useBarPosition('bsp_bibleBarPosition');
  const [isLoading, setIsLoading] = useState(false);
  const searchTimerRef = useRef<number | null>(null);
  /* Keyed by reference, not verse number: search results span books, so verse
     numbers collide and the wrong row would be scrolled to. */
  const verseRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const currentVersion = versions.find((v) => v.id === selectedVersion);
  const versionOptions = versions.length ? versions : [
    { id: 'KJV', name: 'King James Version', abbreviation: 'KJV', language: 'en', books: [] },
    { id: 'NKJV', name: 'New King James Version', abbreviation: 'NKJV', language: 'en', books: [] },
    { id: 'NASB', name: 'New American Standard Bible', abbreviation: 'NASB', language: 'en', books: [] },
    { id: 'NLT', name: 'New Living Translation', abbreviation: 'NLT', language: 'en', books: [] },
  ];
  const bookOptions = books.length ? books : FALLBACK_BOOKS.map((name) => ({ name, chapters: 1 }));

  /** The term the result rows highlight — empty while browsing a chapter. */
  const searchTerm = results.length ? normalizeSearchText(query).trim() : '';

  /**
   * A whole-reference hit is as good as it gets; past that the backend has
   * already ranked the list, so position stands in for confidence.
   */
  function confidenceFor(verse: BibleVerse, index: number) {
    if (!searchTerm) return 0;
    return verse.reference.toLowerCase().includes(searchTerm.toLowerCase())
      ? 99
      : Math.max(70, 95 - index);
  }

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
    if (!highlightedVerse) return;
    const target = chapterVerses.find((v) => v.verse === highlightedVerse);
    if (target) verseRefs.current[target.reference]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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

  /** Whatever the operator is on right now — live wins, else what's staged. */
  const activeReference = currentScene?.type === 'bible'
    ? currentScene.name
    : previewScene?.type === 'bible'
      ? previewScene.name
      : '';

  /* Set when a step crosses a chapter boundary; consumed once the new
     chapter's verses arrive, to project the one at that end. */
  const pendingEdgeRef = useRef<'first' | 'last' | null>(null);

  useEffect(() => {
    if (!pendingEdgeRef.current || chapterVerses.length === 0) return;
    const edge = pendingEdgeRef.current;
    pendingEdgeRef.current = null;
    const verse = edge === 'first' ? chapterVerses[0] : chapterVerses[chapterVerses.length - 1];
    if (verse) void sendVerse(verse, { direct: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterVerses]);

  /* Stepping with the chevrons or the arrow keys walks past the bottom of the
     list, so the row that just went live has to be brought back into view. */
  useEffect(() => {
    if (!activeReference) return;
    verseRefs.current[activeReference]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [activeReference, visibleVerses]);

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

  /**
   * Crosses into the neighbouring chapter, projecting the verse at whichever
   * end we arrive from. The chapter loads asynchronously, so the edge is
   * recorded and acted on once the verses land.
   */
  function stepChapter(direction: 1 | -1) {
    const bookIndex = bookOptions.findIndex((b) => b.name === selectedBook);
    if (bookIndex === -1) return;

    if (direction > 0) {
      pendingEdgeRef.current = 'first';
      if (chapter < (bookOptions[bookIndex].chapters || 1)) {
        setChapter(chapter + 1);
      } else {
        // Past the last chapter: on into the next book, wrapping at Revelation.
        const nextBook = bookOptions[(bookIndex + 1) % bookOptions.length];
        setSelectedBook(nextBook.name);
        setChapter(1);
      }
      return;
    }

    pendingEdgeRef.current = 'last';
    if (chapter > 1) {
      setChapter(chapter - 1);
    } else {
      const prevBook = bookOptions[(bookIndex - 1 + bookOptions.length) % bookOptions.length];
      setSelectedBook(prevBook.name);
      setChapter(prevBook.chapters || 1);
    }
  }

  async function sendAdjacentVerse(direction: 1 | -1) {
    if (!visibleVerses.length) return;
    const currentIndex = visibleVerses.findIndex((verse) => verse.reference === activeReference);

    if (currentIndex === -1) {
      // Nothing of this list is showing — enter from the end we came at.
      const verse = visibleVerses[direction > 0 ? 0 : visibleVerses.length - 1];
      if (verse) await sendVerse(verse, { direct: true });
      return;
    }

    const nextIndex = currentIndex + direction;
    if (nextIndex >= 0 && nextIndex < visibleVerses.length) {
      await sendVerse(visibleVerses[nextIndex], { direct: true });
      return;
    }

    /* Past an edge. Clamping used to re-send the verse already live, which
       sendVerse reads as "clicked what is showing" and clears the output — so
       the end of a chapter went blank and the next press jumped to the start. */
    if (results.length) {
      // A search result list has no neighbouring chapter, so wrap within it.
      const wrapped = (nextIndex + visibleVerses.length) % visibleVerses.length;
      await sendVerse(visibleVerses[wrapped], { direct: true });
      return;
    }
    stepChapter(direction);
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
      if (!isFocusedDock(containerRef.current)) return;
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

  const chapterLabel = results.length
    ? `Search results · ${results.length}`
    : selectedBook
    ? `${selectedBook} ${chapter}`
    : 'Scripture';

  /**
   * Built once and rendered into whichever slot is chosen, rather than written
   * twice — the footer copy is the same element with the same classes, so it
   * scrolls sideways and behaves identically by construction.
   */
  const toolbar = (
      <div className="blk blk--bar">
        <div style={styles.controlsRow}>
          {/* Custom Dark Version Dropdown Popup matching the reference design */}
          <CustomDropdown
            value={selectedVersion}
            options={versionOptions.map((v) => ({ value: v.id, label: v.abbreviation, sublabel: v.name }))}
            onChange={(val) => setSelectedVersion(val)}
            title="Select Translation"
            buttonStyle={{ height: 38 }}
          />

          {/* Segmented Pill Switcher with Smooth Sliding Animation */}
          <SlidingSwitch
            value={dualVersion ? 'dual' : 'single'}
            onChange={(val) => setDualVersion(val === 'dual')}
            options={[
              {
                value: 'single',
                label: 'Single Version',
                title: 'Show one translation',
                icon: (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                  </svg>
                ),
              },
              {
                value: 'dual',
                label: 'Dual Version',
                title: 'Show a parallel translation alongside',
                icon: (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h3c0 1-1 2-2 3v1c0 1 1 3 4 4z" />
                    <path d="M16 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h3c0 1-1 2-2 3v1c0 1 1 3 4 4z" />
                  </svg>
                ),
              },
            ]}
          />

          {/* Secondary Version Selector when Dual Version is active */}
          {dualVersion && (
            <CustomDropdown
              value={secondaryVersion}
              options={versionOptions.map((v) => ({ value: v.id, label: `+ ${v.abbreviation}`, sublabel: v.name }))}
              onChange={(val) => setSecondaryVersion(val)}
              title="Secondary Parallel Translation"
              buttonStyle={{ height: 38 }}
            />
          )}

          {/* Unified Search Input (reference or keyword) */}
          <input
            style={styles.searchInput}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onBlur={() => setQuery((current) => normalizeReferenceQuery(current))}
            onKeyDown={handleSearchKeyDown}
            placeholder="John 3:16 or keyword search..."
          />

          {/* Previous & Next Chapter Navigation Buttons matching the reference design */}
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button
              style={{
                ...styles.iconNavBtn,
                opacity: !visibleVerses.length ? 0.4 : 1,
                cursor: !visibleVerses.length ? 'not-allowed' : 'pointer',
              }}
              disabled={!visibleVerses.length}
              onClick={() => sendAdjacentVerse(-1)}
              title="Previous verse / chapter"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <button
              style={{
                ...styles.iconNavBtn,
                opacity: !visibleVerses.length ? 0.4 : 1,
                cursor: !visibleVerses.length ? 'not-allowed' : 'pointer',
              }}
              disabled={!visibleVerses.length}
              onClick={() => sendAdjacentVerse(1)}
              title="Next verse / chapter"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>

          {/* Send the whole bar to the other end of the panel. */}
          <MoveBarButton
            position={barPosition}
            onMove={moveBar}
            label="Bible"
            style={styles.iconNavBtn}
          />
        </div>
      </div>
  );

  return (
    <div ref={containerRef} className="blk-col" style={styles.panel}>
      {barPosition === 'top' && toolbar}

      <Block
        className="blk-fill"
        title={chapterLabel}
        tools={<span style={styles.footerNote}>{currentVersion?.name || selectedVersion}</span>}
      >
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
            {results.length > 0 && (
              <div style={styles.resultsHeading}>Search results</div>
            )}
            {(results.length ? results : chapterVerses).map((verse, index) => {
              const isHighlighted = !results.length && highlightedVerse === verse.verse;
              const isLive = currentScene?.type === 'bible' && currentScene.name === verse.reference;
              const isPreview = previewScene?.type === 'bible' && previewScene.name === verse.reference;

              const borderStyle = isLive
                ? '1px solid #FF5500'
                : isPreview
                ? '1px solid #3b82f6'
                : isHighlighted
                ? '1px solid var(--chrome-control-active)'
                : '1px solid #262628';

              const backgroundStyle = isLive
                ? '#3d1403'
                : isPreview
                ? '#232221'
                : isHighlighted
                ? 'var(--chrome-control-active)'
                : '#141416';

              return (
                <div
                  key={`${verse.reference}-${verse.version}`}
                  className="row-hover"
                  ref={(el) => { verseRefs.current[verse.reference] = el; }}
                  onClick={() => sendVerse(verse)}
                  onDoubleClick={() => sendVerse(verse, { direct: true })}
                  style={{
                    height: 38,
                    minHeight: 38,
                    padding: '0 12px',
                    background: backgroundStyle,
                    border: borderStyle,
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    userSelect: 'none',
                    boxSizing: 'border-box',
                  }}
                  title={operatingMode === 'studio'
                    ? 'Click to stage in Preview · double-click to go straight to Program'
                    : 'Click to go live'}
                >
                  {/* Confidence when searching, plain verse number when browsing */}
                  {results.length > 0 ? (
                    <span style={styles.confidence}>
                      <span style={styles.confidenceDot} />
                      {confidenceFor(verse, index)}%
                    </span>
                  ) : (
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-dim)', minWidth: 22, flexShrink: 0 }}>
                      {verse.verse}
                    </span>
                  )}

                  {/* Reference and translation chip when displaying search results */}
                  {results.length > 0 && (
                    <>
                      <span style={styles.resultRef}>{verse.reference.toUpperCase()}</span>
                      <span style={styles.versionChip}>{verse.version || selectedVersion}</span>
                    </>
                  )}

                  {/* Inline Status Badges */}
                  {isLive && <span style={styles.liveBadge}>LIVE</span>}
                  {isPreview && !isLive && <span style={styles.previewBadge}>PREVIEW</span>}

                  {/* Verse Body Text (Single Line with Ellipsis matching the reference design) */}
                  <span
                    style={{
                      flex: 1,
                      fontSize: 13,
                      color: '#ffffff',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      lineHeight: '38px',
                    }}
                    title={verse.text}
                  >
                    {highlightTerm(verse.text, searchTerm)}
                  </span>

                  {/* Queue Plus (+) Button — revealed on row hover */}
                  <button
                    type="button"
                    className="row-action"
                    onClick={(e) => {
                      e.stopPropagation();
                      const sceneId = bibleSceneId(verse);
                      const scene: Scene = {
                        id: sceneId,
                        name: verse.reference,
                        type: 'bible',
                        content: {
                          text: verse.text,
                          reference: verse.reference,
                          version: verse.version || selectedVersion,
                        },
                      };
                      addToQueue({
                        reference: verse.reference,
                        text: verse.text,
                        type: 'bible',
                        source: 'Manual',
                        scene,
                      });
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#ffffff',
                      fontSize: 16,
                      fontWeight: 400,
                      cursor: 'pointer',
                      padding: '2px 6px',
                      borderRadius: 4,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                    title="Add verse to Queue"
                  >
                    +
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div style={styles.footerNote}>
          Click a verse card to load it into Preview.
        </div>
      </Block>

      {barPosition === 'bottom' && toolbar}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  panel: { height: '100%', minHeight: 0 },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  h2: { ...type.title },
  segmented: { display: 'flex', gap: 6 },
  controlsRow: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'nowrap', minWidth: '100%' },
  versionSelect: {
    padding: '5px 10px',
    background: 'var(--chrome-control)',
    border: '1px solid var(--chrome-control)',
    borderRadius: 6,
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    outline: 'none',
  },
  pillGroup: {
    display: 'flex',
    background: 'var(--chrome-control)',
    borderRadius: 6,
    padding: 3,
    border: '1px solid var(--chrome-control)',
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
    height: 38,
    minWidth: 140,
    padding: '0 14px',
    background: 'var(--chrome-control)',
    border: '1px solid var(--chrome-control)',
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
    width: 40,
    height: 38,
    background: 'var(--chrome-control)',
    border: '1px solid var(--chrome-control)',
    borderRadius: 6,
    color: '#ffffff',
    fontSize: 16,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  versionBar: { display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap', marginTop: 6 },
  inlineToggle: { display: 'flex', alignItems: 'center', gap: 5, marginLeft: 6, ...type.caption, color: 'var(--text-secondary)' },
  secondarySelect: { width: 84, height: 28, padding: '2px 8px', ...type.secondary },
  chips: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 },
  grid: { display: 'flex', flexDirection: 'column', gap: 6 },
  verseButton: {
    border: '1px solid #262628',
    background: '#161414',
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
  verseText: { fontSize: 13, lineHeight: 1.45, color: '#ffffff' },
  textMode: { minHeight: 360, height: '100%', resize: 'none', whiteSpace: 'pre-wrap', lineHeight: 1.55 },
  footerNote: { marginTop: 10, ...type.caption, color: 'var(--text-dim)' },
  liveBadge: { ...type.label, fontWeight: fontWeight.bold, padding: '2px 5px', borderRadius: 4, background: '#FF5500', color: '#fff', flexShrink: 0, lineHeight: 1.4, whiteSpace: 'nowrap' },
  previewBadge: { ...type.label, fontWeight: fontWeight.bold, padding: '2px 5px', borderRadius: 4, background: '#3b82f6', color: '#fff', flexShrink: 0, lineHeight: 1.4, whiteSpace: 'nowrap' },
  resultsHeading: {
    ...type.label,
    fontWeight: fontWeight.semibold,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'var(--text-dim)',
    padding: '2px 2px 4px',
  },
  confidence: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    fontWeight: 600,
    color: '#22c55e',
    minWidth: 52,
    flexShrink: 0,
  },
  confidenceDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: '#22c55e',
    flexShrink: 0,
  },
  resultRef: { fontSize: 12, fontWeight: 700, color: '#FF5500', flexShrink: 0, whiteSpace: 'nowrap' },
  versionChip: {
    fontSize: 10,
    fontWeight: 600,
    color: '#a1a1aa',
    background: '#232221',
    border: '1px solid #262628',
    borderRadius: 10,
    padding: '1px 7px',
    flexShrink: 0,
    whiteSpace: 'nowrap',
  },
  mark: { background: 'rgba(255, 85, 0, 0.32)', color: '#ffffff', borderRadius: 3, padding: '0 2px' },
  highlightBadge: { ...type.label, fontWeight: fontWeight.bold, padding: '2px 5px', borderRadius: 4, background: '#FF5500', color: '#fff' },
};
