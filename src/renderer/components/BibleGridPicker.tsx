import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { BibleBook } from '../types';
import { useI18n } from '../../i18n/useI18n';
import { shortenBibleBookName } from '../utils/bible-abbreviations';

export interface BibleGridPickerProps {
  books: BibleBook[];
  selectedVersion: string;
  currentBook: string;
  currentChapter: number;
  onSelectPassage: (passage: { book: string; chapter: number; verse: number }) => void;
  onClose: () => void;
}

const OT_BOOK_NAMES = new Set([
  'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges', 'Ruth',
  '1 Samuel', '2 Samuel', '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles', 'Ezra',
  'Nehemiah', 'Esther', 'Job', 'Psalms', 'Proverbs', 'Ecclesiastes', 'Song of Solomon',
  'Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos',
  'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi',
  // French aliases
  'Genèse', 'Exode', 'Lévitique', 'Nombres', 'Deutéronome', 'Josué', 'Juges',
  '1 Rois', '2 Rois', '1 Chroniques', '2 Chroniques', 'Esdras', 'Néhémie', 'Psaumes',
  'Proverbes', 'Ecclésiaste', 'Cantique des Cantiques', 'Ésaïe', 'Jérémie', 'Ézéchiel',
  'Osée', 'Michée', 'Sophonie', 'Aggée', 'Zacharie', 'Malachie',
  // Spanish aliases
  'Génesis', 'Éxodo', 'Levítico', 'Números', 'Deuteronomio', 'Josué', 'Jueces', 'Rut',
  '1 Reyes', '2 Reyes', '1 Crónicas', '2 Crónicas', 'Nehemías', 'Ester', 'Salmos',
  'Proverbios', 'Eclesiastés', 'Cantar de los Cantares', 'Isaías', 'Jeremías', 'Lamentaciones',
  'Ezequiel', 'Oseas', 'Miqueas', 'Sofonías', 'Hageo', 'Zacarías', 'Malaquías',
]);

const STANDARD_ABBREVIATIONS: Record<string, string> = {
  genesis: 'GEN',
  exodus: 'EXO',
  leviticus: 'LEV',
  numbers: 'NUM',
  deuteronomy: 'DEU',
  joshua: 'JOS',
  judges: 'JDG',
  ruth: 'RTH',
  '1 samuel': '1SA',
  '2 samuel': '2SA',
  '1 kings': '1KI',
  '2 kings': '2KI',
  '1 chronicles': '1CH',
  '2 chronicles': '2CH',
  ezra: 'EZR',
  nehemiah: 'NEH',
  esther: 'EST',
  job: 'JOB',
  psalms: 'PSA',
  psalm: 'PSA',
  proverbs: 'PRO',
  ecclesiastes: 'ECC',
  'song of solomon': 'SNG',
  'song of songs': 'SNG',
  isaiah: 'ISA',
  jeremiah: 'JER',
  lamentations: 'LAM',
  ezekiel: 'EZK',
  daniel: 'DAN',
  hosea: 'HOS',
  joel: 'JOL',
  amos: 'AMO',
  obadiah: 'OBD',
  jonah: 'JON',
  micah: 'MIC',
  nahum: 'NAH',
  habakkuk: 'HAB',
  zephaniah: 'ZEP',
  haggai: 'HAG',
  zechariah: 'ZEC',
  malachi: 'MAL',
  matthew: 'MAT',
  mark: 'MRK',
  luke: 'LUK',
  john: 'JHN',
  acts: 'ACT',
  romans: 'ROM',
  '1 corinthians': '1CO',
  '2 corinthians': '2CO',
  galatians: 'GAL',
  ephesians: 'EPH',
  philippians: 'PHP',
  colossians: 'COL',
  '1 thessalonians': '1TH',
  '2 thessalonians': '2TH',
  '1 timothy': '1TI',
  '2 timothy': '2TI',
  titus: 'TIT',
  philemon: 'PHM',
  hebrews: 'HEB',
  james: 'JAS',
  '1 peter': '1PE',
  '2 peter': '2PE',
  '1 john': '1JN',
  '2 john': '2JN',
  '3 john': '3JN',
  jude: 'JUD',
  revelation: 'REV',
};

function getBookAbbreviation(name: string): string {
  if (!name) return '';
  const clean = name.trim().toLowerCase();
  if (STANDARD_ABBREVIATIONS[clean]) return STANDARD_ABBREVIATIONS[clean];
  
  const shortened = shortenBibleBookName(name).replace(/\./g, '').trim();
  if (shortened && shortened.length <= 4) return shortened.toUpperCase();

  const parts = name.split(/\s+/);
  if (parts.length > 1 && /^\d/.test(parts[0])) {
    return `${parts[0]}${parts[1].slice(0, 2).toUpperCase()}`;
  }
  return name.slice(0, 3).toUpperCase();
}

export function BibleGridPicker({
  books,
  selectedVersion,
  currentBook,
  currentChapter,
  onSelectPassage,
  onClose,
}: BibleGridPickerProps) {
  const { t } = useI18n();

  const [step, setStep] = useState<'books' | 'chapters' | 'verses'>('books');
  const [selectedBookObj, setSelectedBookObj] = useState<BibleBook | null>(() => {
    return books.find((b) => b.name === currentBook) || books[0] || null;
  });
  const [selectedChapNum, setSelectedChapNum] = useState<number>(currentChapter || 1);
  const [verseCount, setVerseCount] = useState<number>(30);
  const [loadingVerses, setLoadingVerses] = useState<boolean>(false);
  const [bookFilter, setBookFilter] = useState<string>('');
  const [testamentTab, setTestamentTab] = useState<'all' | 'ot' | 'nt'>('all');

  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === 'books' && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [step]);

  // When moving to verse step, fetch verse count for accurate grid
  useEffect(() => {
    if (step === 'verses' && selectedBookObj && selectedChapNum) {
      setLoadingVerses(true);
      window.BSP?.bible?.getChapter({
        versionId: selectedVersion,
        book: selectedBookObj.name,
        chapter: selectedChapNum,
      })
        .then((verses: any[]) => {
          if (Array.isArray(verses) && verses.length > 0) {
            setVerseCount(verses.length);
          } else {
            setVerseCount(30);
          }
        })
        .catch(() => {
          setVerseCount(30);
        })
        .finally(() => {
          setLoadingVerses(false);
        });
    }
  }, [step, selectedBookObj, selectedChapNum, selectedVersion]);

  // Split books into OT and NT
  const { otBooks, ntBooks } = useMemo(() => {
    const query = bookFilter.trim().toLowerCase();
    const ot: BibleBook[] = [];
    const nt: BibleBook[] = [];

    books.forEach((book, index) => {
      const isOT = OT_BOOK_NAMES.has(book.name) || index < 39;
      if (query) {
        const abbrev = getBookAbbreviation(book.name).toLowerCase();
        const bookName = book.name.toLowerCase();
        if (!bookName.includes(query) && !abbrev.includes(query)) return;
      }
      if (isOT) ot.push(book);
      else nt.push(book);
    });

    return { otBooks: ot, ntBooks: nt };
  }, [books, bookFilter]);

  const handleBookClick = (book: BibleBook) => {
    setSelectedBookObj(book);
    setSelectedChapNum(1);
    setStep('chapters');
  };

  const handleChapterClick = (chap: number) => {
    setSelectedChapNum(chap);
    setStep('verses');
  };

  const handleVerseClick = (verseNum: number) => {
    if (!selectedBookObj) return;
    onSelectPassage({
      book: selectedBookObj.name,
      chapter: selectedChapNum,
      verse: verseNum,
    });
  };

  const renderBookCard = (book: BibleBook, isNT = false) => {
    const abbrev = getBookAbbreviation(book.name);
    const isSelected = selectedBookObj?.name === book.name;
    return (
      <button
        key={book.name}
        className={`bgp-card ${isNT ? 'bgp-card-nt' : 'bgp-card-ot'} ${isSelected ? 'bgp-card-selected' : ''}`}
        style={{
          ...styles.bookCard,
          ...(isNT ? styles.bookCardNT : styles.bookCardOT),
          ...(isSelected ? styles.bookCardSelected : {}),
        }}
        onClick={() => handleBookClick(book)}
        title={`${book.name} (${book.chapters || 1} ${t('bible.chapter')}${(book.chapters || 1) > 1 ? 's' : ''})`}
      >
        <div className="bgp-abbrev" style={isNT ? styles.bookAbbrevNT : styles.bookAbbrevOT}>{abbrev}</div>
        <div className="bgp-name" style={styles.bookFullName}>{book.name}</div>
      </button>
    );
  };

  return (
    <div style={styles.container}>
      {/* Top Header & Breadcrumb Navigation Bar */}
      <div style={styles.header}>
        <div style={styles.breadcrumbs}>
          {/* Step 1: Books */}
          <button
            style={{
              ...styles.crumbBtn,
              ...(step === 'books' ? styles.crumbBtnActive : {}),
            }}
            onClick={() => setStep('books')}
            title={t('bible.selectBook')}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
            <span>{t('bible.books')}</span>
          </button>

          {/* Step 2: Book -> Chapter */}
          {selectedBookObj && (
            <>
              <span style={styles.crumbSeparator}>›</span>
              <button
                style={{
                  ...styles.crumbBtn,
                  ...(step === 'chapters' ? styles.crumbBtnActiveGreen : {}),
                }}
                onClick={() => setStep('chapters')}
                title={t('bible.selectChapter')}
              >
                <span style={styles.crumbAbbrev}>{getBookAbbreviation(selectedBookObj.name)}</span>
                <span style={{ fontWeight: 600 }}>{selectedBookObj.name}</span>
              </button>
            </>
          )}

          {/* Step 3: Chapter -> Verse */}
          {selectedBookObj && step === 'verses' && (
            <>
              <span style={styles.crumbSeparator}>›</span>
              <button
                style={{
                  ...styles.crumbBtn,
                  ...styles.crumbBtnActiveBlue,
                }}
                title={t('bible.selectVerse')}
              >
                <span>{t('bible.chapter')} {selectedChapNum}</span>
              </button>
            </>
          )}
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          style={styles.closeBtn}
          title={t('common.close')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="6" />
          </svg>
        </button>
      </div>

      {/* Main Content Area */}
      <div style={styles.body}>
        {/* STEP 1: BOOKS MATRIX (COMPACT) */}
        {step === 'books' && (
          <div style={styles.stepContainer}>
            {/* Filter and Tab controls */}
            <div style={styles.filterBar}>
              <div style={styles.searchWrapper}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-dim)' }}>
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  ref={searchInputRef}
                  style={styles.filterInput}
                  value={bookFilter}
                  onChange={(e) => setBookFilter(e.target.value)}
                  placeholder={t('bible.filterBooks')}
                />
                {bookFilter && (
                  <button onClick={() => setBookFilter('')} style={styles.clearFilterBtn}>
                    ✕
                  </button>
                )}
              </div>

              {/* OT / NT Tabs */}
              <div style={styles.tabGroup}>
                <button
                  style={{
                    ...styles.tabBtn,
                    ...(testamentTab === 'all' ? styles.tabBtnActive : {}),
                  }}
                  onClick={() => setTestamentTab('all')}
                >
                  {t('bible.allBooks')}
                </button>
                <button
                  style={{
                    ...styles.tabBtn,
                    ...(testamentTab === 'ot' ? styles.tabBtnActive : {}),
                  }}
                  onClick={() => setTestamentTab('ot')}
                >
                  {t('bible.oldTestament')} ({otBooks.length})
                </button>
                <button
                  style={{
                    ...styles.tabBtn,
                    ...(testamentTab === 'nt' ? styles.tabBtnActive : {}),
                  }}
                  onClick={() => setTestamentTab('nt')}
                >
                  {t('bible.newTestament')} ({ntBooks.length})
                </button>
              </div>
            </div>

            {/* Books Container */}
            {(testamentTab === 'all' || testamentTab === 'ot') && otBooks.length > 0 && (
              <div style={styles.sectionContainer}>
                {testamentTab === 'all' && (
                  <div className="bgp-section-title-ot" style={styles.sectionTitleOT}>
                    <span>{t('bible.oldTestament')}</span>
                    <span className="bgp-section-badge-ot" style={styles.sectionBadgeOT}>{otBooks.length}</span>
                  </div>
                )}
                <div style={styles.booksGrid}>
                  {otBooks.map((b) => renderBookCard(b, false))}
                </div>
              </div>
            )}

            {(testamentTab === 'all' || testamentTab === 'nt') && ntBooks.length > 0 && (
              <div style={styles.sectionContainer}>
                {testamentTab === 'all' && (
                  <div className="bgp-section-title-nt" style={styles.sectionTitleNT}>
                    <span>{t('bible.newTestament')}</span>
                    <span className="bgp-section-badge-nt" style={styles.sectionBadgeNT}>{ntBooks.length}</span>
                  </div>
                )}
                <div style={styles.booksGrid}>
                  {ntBooks.map((b) => renderBookCard(b, true))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: CHAPTERS MATRIX (GREEN ACCENT) */}
        {step === 'chapters' && selectedBookObj && (
          <div style={styles.stepContainer}>
            <div style={styles.stepSubHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {selectedBookObj.name}
                </span>
                <span style={{ ...styles.badgePill, background: 'var(--green-dim)', color: 'var(--green)' }}>
                  {selectedBookObj.chapters || 1} {t('bible.chapter')}{((selectedBookObj.chapters || 1) > 1 ? 's' : '')}
                </span>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                {t('bible.selectChapter')}
              </span>
            </div>

            <div style={styles.numberGrid}>
              {Array.from({ length: selectedBookObj.chapters || 1 }, (_, i) => i + 1).map((chapNum) => {
                const isCurrent = selectedChapNum === chapNum;
                return (
                  <button
                    key={chapNum}
                    className={`bgp-num-green ${isCurrent ? 'bgp-num-green-selected' : ''}`}
                    style={{
                      ...styles.greenNumberBtn,
                      ...(isCurrent ? styles.greenNumberBtnSelected : {}),
                    }}
                    onClick={() => handleChapterClick(chapNum)}
                    title={`${selectedBookObj.name} ${t('bible.chapter')} ${chapNum}`}
                  >
                    {chapNum}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 3: VERSES MATRIX (BLUE ACCENT) */}
        {step === 'verses' && selectedBookObj && (
          <div style={styles.stepContainer}>
            <div style={styles.stepSubHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {selectedBookObj.name} {selectedChapNum}
                </span>
                <span style={{ ...styles.badgePill, background: 'var(--blue-dim)', color: 'var(--blue)' }}>
                  {verseCount} {t('bible.verse')}{verseCount > 1 ? 's' : ''}
                </span>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                {loadingVerses ? t('common.loading') : t('bible.selectVerse')}
              </span>
            </div>

            <div style={styles.numberGrid}>
              {Array.from({ length: verseCount }, (_, i) => i + 1).map((verseNum) => (
                <button
                  key={verseNum}
                  className="bgp-num-blue"
                  style={styles.blueNumberBtn}
                  onClick={() => handleVerseClick(verseNum)}
                  title={`${selectedBookObj.name} ${selectedChapNum}:${verseNum}`}
                >
                  {verseNum}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    width: '100%',
    background: 'var(--bg-primary, #0d0f12)',
    overflow: 'hidden',
    position: 'relative',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 10px',
    background: 'var(--bg-secondary, #15181e)',
    borderBottom: '1px solid var(--border-primary, rgba(255, 255, 255, 0.08))',
    flexShrink: 0,
    gap: 6,
  },
  breadcrumbs: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    flexWrap: 'wrap',
    flex: 1,
    minWidth: 0,
  },
  crumbBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    padding: '3px 8px',
    borderRadius: 5,
    border: '1px solid var(--border-primary, rgba(255, 255, 255, 0.1))',
    background: 'var(--bg-elevated, #1c2028)',
    color: 'var(--text-secondary, #94a3b8)',
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  crumbBtnActive: {
    background: 'rgba(56, 189, 248, 0.18)',
    borderColor: '#38bdf8',
    color: '#38bdf8',
  },
  crumbBtnActiveGreen: {
    background: 'var(--green-dim, rgba(34, 197, 94, 0.18))',
    borderColor: 'var(--green, #22c55e)',
    color: 'var(--green, #22c55e)',
  },
  crumbBtnActiveBlue: {
    background: 'var(--blue-dim, rgba(59, 130, 246, 0.18))',
    borderColor: 'var(--blue, #3b82f6)',
    color: 'var(--blue, #3b82f6)',
  },
  crumbAbbrev: {
    display: 'inline-block',
    padding: '1px 4px',
    borderRadius: 3,
    background: 'rgba(255, 255, 255, 0.12)',
    fontSize: 9.5,
    fontWeight: 800,
    letterSpacing: '0.4px',
  },
  crumbSeparator: {
    color: 'var(--text-dim, #64748b)',
    fontSize: 12,
    userSelect: 'none',
  },
  closeBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 26,
    height: 26,
    borderRadius: 5,
    border: '1px solid var(--border-primary, rgba(255, 255, 255, 0.1))',
    background: 'transparent',
    color: 'var(--text-secondary, #94a3b8)',
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'all 0.15s ease',
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    padding: '8px 10px',
    display: 'flex',
    flexDirection: 'column',
  },
  stepContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    flex: 1,
  },
  filterBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  searchWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: 'var(--bg-secondary, #15181e)',
    border: '1px solid var(--border-primary, rgba(255, 255, 255, 0.1))',
    borderRadius: 5,
    padding: '0 8px',
    height: 28,
    flex: '1 1 140px',
    maxWidth: 240,
  },
  filterInput: {
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: 'var(--text-primary, #ffffff)',
    fontSize: 11,
    width: '100%',
  },
  clearFilterBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-dim, #64748b)',
    cursor: 'pointer',
    fontSize: 10,
    padding: 1,
  },
  tabGroup: {
    display: 'flex',
    background: 'var(--bg-secondary, #15181e)',
    border: '1px solid var(--border-primary, rgba(255, 255, 255, 0.1))',
    borderRadius: 5,
    padding: 2,
    gap: 2,
  },
  tabBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-secondary, #94a3b8)',
    fontSize: 10.5,
    fontWeight: 600,
    padding: '3px 8px',
    borderRadius: 3,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  tabBtnActive: {
    background: 'var(--bg-elevated, #242934)',
    color: 'var(--text-primary, #ffffff)',
    boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
  },
  sectionContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  sectionTitleOT: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 11,
    fontWeight: 700,
    color: '#fcd34d',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginTop: 4,
  },
  sectionTitleNT: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 11,
    fontWeight: 700,
    color: '#a5b4fc',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginTop: 4,
  },
  sectionBadgeOT: {
    fontSize: 9.5,
    fontWeight: 700,
    padding: '1px 5px',
    borderRadius: 10,
    background: 'rgba(217, 119, 6, 0.18)',
    color: '#fde68a',
  },
  sectionBadgeNT: {
    fontSize: 9.5,
    fontWeight: 700,
    padding: '1px 5px',
    borderRadius: 10,
    background: 'rgba(99, 102, 241, 0.18)',
    color: '#c7d2fe',
  },
  booksGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))',
    gap: 6,
  },
  bookCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '7px 4px',
    borderRadius: 6,
    cursor: 'pointer',
    transition: 'all 0.12s ease',
    textAlign: 'center',
    minHeight: 48,
  },
  bookCardOT: {
    border: '1px solid rgba(217, 119, 6, 0.22)',
    background: 'linear-gradient(180deg, rgba(217, 119, 6, 0.08) 0%, var(--bg-secondary, #15181e) 100%)',
  },
  bookCardNT: {
    border: '1px solid rgba(99, 102, 241, 0.22)',
    background: 'linear-gradient(180deg, rgba(99, 102, 241, 0.08) 0%, var(--bg-secondary, #15181e) 100%)',
  },
  bookCardSelected: {
    borderColor: '#38bdf8',
    background: 'rgba(56, 189, 248, 0.16)',
    boxShadow: '0 0 8px rgba(56, 189, 248, 0.3)',
  },
  bookAbbrevOT: {
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: '0.4px',
    color: '#fef3c7',
    lineHeight: 1.15,
  },
  bookAbbrevNT: {
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: '0.4px',
    color: '#e0e7ff',
    lineHeight: 1.15,
  },
  bookFullName: {
    fontSize: 10,
    fontWeight: 500,
    color: 'var(--text-secondary, #94a3b8)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '96%',
    marginTop: 2,
    lineHeight: 1.15,
  },
  stepSubHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '2px 2px 6px 2px',
    borderBottom: '1px solid var(--border-primary, rgba(255, 255, 255, 0.06))',
  },
  badgePill: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '1px 6px',
    borderRadius: 999,
    fontSize: 10,
    fontWeight: 700,
  },
  numberGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(42px, 1fr))',
    gap: 6,
    paddingBottom: 12,
  },
  greenNumberBtn: {
    height: 38,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    border: '1px solid rgba(34, 197, 94, 0.3)',
    background: 'linear-gradient(180deg, rgba(34, 197, 94, 0.22) 0%, rgba(34, 197, 94, 0.12) 100%)',
    color: '#4ade80',
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
    transition: 'all 0.12s ease',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
  },
  greenNumberBtnSelected: {
    background: 'var(--green, #22c55e)',
    color: '#ffffff',
    borderColor: '#86efac',
    boxShadow: '0 0 10px rgba(34, 197, 94, 0.6)',
  },
  blueNumberBtn: {
    height: 38,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    border: '1px solid rgba(59, 130, 246, 0.3)',
    background: 'linear-gradient(180deg, rgba(59, 130, 246, 0.22) 0%, rgba(59, 130, 246, 0.12) 100%)',
    color: '#60a5fa',
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
    transition: 'all 0.12s ease',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
  },
};
