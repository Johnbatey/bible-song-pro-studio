import { useState, useRef, useEffect } from 'react';
import { v4 as uuid } from 'uuid';
import { useAppStore } from '../stores/appStore';
import type { PresentationDeck, PresentationSlide, Scene } from '../types';
import { parsePptxFile, parsePdfFile } from '../utils/parsers';
import { type, fontWeight, numeric } from '../styles/type';
import { AppleToggle } from './AppleToggle';

type SlideTransition = PresentationSlide['transition'];

const TRANSITIONS: { value: SlideTransition; label: string }[] = [
  { value: 'cut', label: 'Cut' },
  { value: 'fade', label: 'Fade' },
  { value: 'crossfade', label: 'Dissolve' },
  { value: 'slide-left', label: 'Slide Left' },
  { value: 'slide-right', label: 'Slide Right' },
  { value: 'slide-up', label: 'Slide Up' },
  { value: 'slide-down', label: 'Slide Down' },
  { value: 'zoom-in', label: 'Zoom In' },
  { value: 'zoom-out', label: 'Zoom Out' },
];

const STORAGE_KEY = 'bsp-presentation-decks';
const ACTIVE_DECK_KEY = 'bsp-active-deck';

function loadDecks(): PresentationDeck[] {
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : []; }
  catch { return []; }
}
function saveDecks(decks: PresentationDeck[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(decks)); }
function loadActiveDeckId(): string | null { try { return localStorage.getItem(ACTIVE_DECK_KEY); } catch { return null; } }
function saveActiveDeckId(id: string | null) { if (id) localStorage.setItem(ACTIVE_DECK_KEY, id); else localStorage.removeItem(ACTIVE_DECK_KEY); }

function createBlankSlide(order: number): PresentationSlide {
  return { id: uuid(), title: '', body: '# New Slide\n\nEnter your content here...', label: `Slide ${order + 1}`, notes: '', transition: 'fade', durationMs: 0, hidden: false, buildCount: 0, buildStep: 0 };
}

function createBlankDeck(title: string): PresentationDeck {
  return { id: uuid(), title, slides: [createBlankSlide(0)], createdAt: Date.now(), updatedAt: Date.now(), sourceType: 'internal' };
}

function formatBody(text: string) {
  return text
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^- (.*$)/gm, '<li>$1</li>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br/>');
}

function stripMarkdown(text: string) {
  return text.replace(/^#{1,3}\s+/gm, '').replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1').replace(/^- /gm, '');
}

export function SlideEditor({ onClose }: { onClose: () => void }) {
  const projectScene = useAppStore((s) => s.projectScene);
  const setCurrentScene = useAppStore((s) => s.setCurrentScene);
  const [decks, setDecks] = useState<PresentationDeck[]>(loadDecks);
  const [activeDeckId, setActiveDeckIdState] = useState<string | null>(loadActiveDeckId);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [outlineView, setOutlineView] = useState<'list' | 'grid'>('list');
  const [deckScale, setDeckScale] = useState(1);
  const [librarySearch, setLibrarySearch] = useState('');
  const [libraryFilter, setLibraryFilter] = useState('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newDeckTitle, setNewDeckTitle] = useState('');
  const [parsingStatus, setParsingStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeDeck = decks.find((d) => d.id === activeDeckId) || null;
  const currentSlide = activeDeck?.slides[currentSlideIndex] || null;
  const totalDuration = activeDeck?.slides.reduce((sum, s) => sum + s.durationMs, 0) || 0;

  const filteredDecks = decks.filter((d) => {
    if (libraryFilter !== 'all' && d.sourceType !== libraryFilter) return false;
    if (librarySearch && !d.title.toLowerCase().includes(librarySearch.toLowerCase())) return false;
    return true;
  });

  const setActiveDeckId = (id: string | null) => { setActiveDeckIdState(id); saveActiveDeckId(id); setCurrentSlideIndex(0); setDeckScale(1); };
  const updateDecks = (newDecks: PresentationDeck[]) => { setDecks(newDecks); saveDecks(newDecks); };
  const updateDeck = (updates: Partial<PresentationDeck>) => { if (!activeDeck) return; const d = { ...activeDeck, ...updates, updatedAt: Date.now() }; updateDecks(decks.map((x) => (x.id === activeDeck.id ? d : x))); };
  const updateSlide = (index: number, u: Partial<PresentationSlide>) => { if (!activeDeck) return; updateDeck({ slides: activeDeck.slides.map((s, i) => (i === index ? { ...s, ...u } : s)) }); };

  const handleSaveSlide = () => {
    if (!currentSlide || !activeDeck) return;
    const g = (id: string) => document.getElementById(id) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
    updateSlide(currentSlideIndex, {
      title: (g('slides-editor-slide-title') as HTMLInputElement)?.value || '',
      label: (g('slides-editor-slide-label') as HTMLInputElement)?.value || '',
      transition: ((g('slides-editor-slide-transition') as HTMLSelectElement)?.value as SlideTransition) || 'fade',
      durationMs: Number((g('slides-editor-slide-duration') as HTMLInputElement)?.value || 0) * 1000,
      hidden: (g('slides-editor-slide-hidden') as HTMLInputElement)?.checked || false,
      body: (g('slides-editor-slide-body') as HTMLTextAreaElement)?.value || '',
      notes: (g('slides-editor-slide-notes') as HTMLTextAreaElement)?.value || '',
    });
  };

  const handleAddBlankSlide = () => { if (!activeDeck) return; updateDeck({ slides: [...activeDeck.slides, createBlankSlide(activeDeck.slides.length)] }); setCurrentSlideIndex(activeDeck.slides.length); };
  const handleDuplicateSlide = () => { if (!activeDeck || currentSlide === null) return; const ns = [...activeDeck.slides]; ns.splice(currentSlideIndex + 1, 0, { ...currentSlide, id: uuid() }); updateDeck({ slides: ns }); setCurrentSlideIndex(currentSlideIndex + 1); };
  const handleDeleteSlide = () => { if (!activeDeck || activeDeck.slides.length <= 1) return; if (!confirm('Delete this slide?')) return; const ns = activeDeck.slides.filter((_, i) => i !== currentSlideIndex); updateDeck({ slides: ns }); setCurrentSlideIndex(Math.min(currentSlideIndex, ns.length - 1)); };
  const handleMoveUp = () => { if (!activeDeck || currentSlideIndex <= 0) return; const ns = [...activeDeck.slides]; [ns[currentSlideIndex - 1], ns[currentSlideIndex]] = [ns[currentSlideIndex], ns[currentSlideIndex - 1]]; updateDeck({ slides: ns }); setCurrentSlideIndex(currentSlideIndex - 1); };
  const handleMoveDown = () => { if (!activeDeck || currentSlideIndex >= activeDeck.slides.length - 1) return; const ns = [...activeDeck.slides]; [ns[currentSlideIndex], ns[currentSlideIndex + 1]] = [ns[currentSlideIndex + 1], ns[currentSlideIndex]]; updateDeck({ slides: ns }); setCurrentSlideIndex(currentSlideIndex + 1); };

  const handleCreateDeck = () => { if (!newDeckTitle.trim()) return; const d = createBlankDeck(newDeckTitle.trim()); updateDecks([...decks, d]); setActiveDeckId(d.id); setShowCreateDialog(false); setNewDeckTitle(''); };

  const handleImportDeck = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const sourceType = ext === 'pptx' ? 'pptx' : ext === 'pdf' ? 'pdf' : ext.match(/^(png|jpg|jpeg|gif|webp)$/) ? 'image' : ext === 'md' ? 'md' : 'txt';
    e.target.value = '';

    try {
      let result: Pick<PresentationDeck, 'title' | 'slides' | 'sourceType' | 'sourcePath'>;

      if (sourceType === 'pptx') {
        setParsingStatus('Parsing PPTX file...');
        result = await parsePptxFile(file);
      } else if (sourceType === 'pdf') {
        setParsingStatus('Parsing PDF file...');
        result = await parsePdfFile(file);
      } else {
        const text = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (ev) => resolve((ev.target?.result as string) || '');
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsText(file);
        });
        const lines = text.split('\n').filter(Boolean);
        const slides = lines.length > 0
          ? lines.map((line, i) => ({ id: uuid(), title: `Line ${i + 1}`, body: line, label: `Slide ${i + 1}`, notes: '', transition: 'fade' as SlideTransition, durationMs: 0, hidden: false, buildCount: 0, buildStep: 0 }))
          : [createBlankSlide(0)];
        result = { title: file.name.replace(/\.[^/.]+$/, ''), slides, sourceType: sourceType as PresentationDeck['sourceType'], sourcePath: file.name };
      }

      const newDeck: PresentationDeck = {
        id: uuid(),
        ...result,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      updateDecks([...decks, newDeck]);
      setActiveDeckId(newDeck.id);
    } catch (err) {
      alert(`Failed to parse ${file.name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setParsingStatus(null);
    }
  };

  const handleDeleteDeck = (id: string) => { if (!confirm('Delete this deck permanently?')) return; const nd = decks.filter((d) => d.id !== id); updateDecks(nd); if (activeDeckId === id) setActiveDeckId(nd[0]?.id || null); };

  const handleSendToDisplay = () => {
    if (!currentSlide) return;
    const scene: Scene = {
      id: `pres-${Date.now()}`,
      name: `${activeDeck?.title || 'Presentation'} - ${currentSlide.label || `Slide ${currentSlideIndex + 1}`}`,
      type: 'presentation',
      content: {
        text: stripMarkdown(currentSlide.body),
        html: formatBody(currentSlide.body),
        slides: activeDeck?.slides.map((s) => ({
          id: s.id, text: stripMarkdown(s.body), html: formatBody(s.body), notes: s.notes,
        })),
        slideId: currentSlide.id,
      },
      background: { type: 'gradient', gradient: 'linear-gradient(135deg, #0c0e14, #1a1a2e)' },
    };
    projectScene(scene);
  };

  const handleOpenPresenter = () => {
    window.open('/slides-presenter.html', 'bsp-presenter', 'width=1400,height=900');
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowRight') setCurrentSlideIndex((i) => Math.min(i + 1, (activeDeck?.slides.length || 1) - 1));
      if (e.key === 'ArrowLeft') setCurrentSlideIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeDeck?.slides.length]);

  return (
    <div style={css.overlay}>
      <div style={css.editor}>
        <div style={css.topbar}>
          <div style={css.topbarLeft}>
            <button style={css.backBtn} onClick={onClose}>← Back</button>
            <span style={css.topbarTitle}>Slide Editor</span>
            <span style={css.topbarStatus}>{activeDeck ? activeDeck.title : 'No deck selected'}</span>
          </div>
          <div style={css.topbarRight}>
            <button style={css.presenterBtn} onClick={handleOpenPresenter} title="Open Presenter View">Presenter</button>
            <button style={css.closeBtn} onClick={onClose}>✕</button>
          </div>
        </div>

        {parsingStatus && (
          <div style={css.parsingBar}>
            <span>{parsingStatus}</span>
          </div>
        )}
        <div style={css.body}>
          <aside style={css.rail}>
            <div style={css.railActions}>
              <button style={{ ...css.actionChip, ...css.acPrimary }} onClick={handleImportDeck}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>
                Import Deck
              </button>
              <button style={css.actionChip} onClick={() => fileInputRef.current?.click()}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
                Import Images
              </button>
              <button style={css.actionChip} onClick={() => setShowCreateDialog(true)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 14, height: 14 }}><path d="M12 5v14"/><path d="M5 12h14"/></svg>
                New Project
              </button>
            </div>
            <input style={css.searchInput} type="search" placeholder="Search..." value={librarySearch} onChange={(e) => setLibrarySearch(e.target.value)} />
            <div style={css.railScroll}>
              {filteredDecks.map((deck) => (
                <div key={deck.id} style={{ ...css.deckItem, ...(deck.id === activeDeckId ? css.deckItemActive : {}) }} onClick={() => setActiveDeckId(deck.id)}>
                  <div style={css.deckItemTitle}>{deck.title}</div>
                  <div style={css.deckItemMeta}>{deck.slides.length} slides • {deck.sourceType}</div>
                  <button style={css.deckDeleteBtn} onClick={(e) => { e.stopPropagation(); handleDeleteDeck(deck.id); }}>✕</button>
                </div>
              ))}
              {filteredDecks.length === 0 && <div style={css.emptyText}>No decks found. Import or create a new project.</div>}
            </div>
            <div style={css.railFooter}>
              <select style={css.filterSelect} value={libraryFilter} onChange={(e) => setLibraryFilter(e.target.value)}>
                <option value="all">All</option>
                <option value="internal">Internal</option>
                <option value="pptx">PPTX</option>
                <option value="pdf">PDF</option>
                <option value="image">Images</option>
                <option value="txt">Text</option>
                <option value="md">Markdown</option>
              </select>
            </div>
          </aside>

          <input ref={fileInputRef} type="file" accept=".pptx,.pdf,.png,.jpg,.jpeg,.gif,.webp,.txt,.md" style={{ display: 'none' }} onChange={handleFileChange} />

          <main style={css.main}>
            {activeDeck ? (
              <>
                <div style={css.canvasArea}>
                  <div style={css.canvasOuter}>
                    <div style={css.canvas}>
                      {currentSlide ? (
                        <div style={css.canvasContent}>
                          {currentSlide.body ? (
                            <div style={css.canvasBody} dangerouslySetInnerHTML={{ __html: formatBody(currentSlide.body) }} />
                          ) : (
                            <div style={css.canvasPlaceholder}>
                              <div style={css.canvasTitle}>{currentSlide.title || 'Untitled Slide'}</div>
                            </div>
                          )}
                          <div style={css.canvasFooter}>
                            <span>{currentSlide.label || `Slide ${currentSlideIndex + 1}`}</span>
                            <span>{currentSlide.transition || 'fade'}</span>
                          </div>
                        </div>
                      ) : (
                        <div style={css.canvasEmpty}>No slide selected</div>
                      )}
                    </div>
                  </div>

                  <div style={css.thumbStrip}>
                    {activeDeck.slides.map((slide, i) => (
                      <div
                        key={slide.id}
                        style={{ ...css.thumbItem, ...(i === currentSlideIndex ? css.thumbItemActive : {}), ...(slide.hidden ? css.thumbItemHidden : {}) }}
                        onClick={() => setCurrentSlideIndex(i)}
                      >
                        <div style={css.thumbNum}>{i + 1}</div>
                        <div style={css.thumbPreview} dangerouslySetInnerHTML={{ __html: formatBody(slide.body).slice(0, 80) }} />
                      </div>
                    ))}
                  </div>
                </div>

                <aside style={css.inspector}>
                  <div style={css.inspectorInfo}>
                    <div style={css.insStat}><div style={css.insStatVal}>{activeDeck.slides.length}</div><div style={css.insStatLabel}>Slides</div></div>
                    <div style={css.insStat}><div style={css.insStatVal}>{totalDuration > 0 ? `${Math.round(totalDuration / 1000)}s` : '—'}</div><div style={css.insStatLabel}>Duration</div></div>
                  </div>
                  <div style={css.insMeta}>
                    <div style={css.insMetaItem}><span style={css.insMetaLabel}>Type</span><span style={css.insMetaValue}>{activeDeck.sourceType || 'internal'}</span></div>
                    <div style={css.insMetaItem}><span style={css.insMetaLabel}>Added</span><span style={css.insMetaValue}>{new Date(activeDeck.createdAt).toLocaleDateString()}</span></div>
                  </div>
                  <div style={css.insCard}>
                    <h3 style={css.sectionTitle}>Slide Editor</h3>
                    <div style={css.edForm}>
                      <div style={css.edField}>
                        <label style={css.edLabel} htmlFor="slides-editor-deck-title">Deck Title</label>
                        <input id="slides-editor-deck-title" style={css.edInput} type="text" value={activeDeck.title} onChange={(e) => updateDeck({ title: e.target.value })} placeholder="Presentation title" />
                      </div>
                      <div style={css.edField}>
                        <label style={css.edLabel} htmlFor="slides-editor-slide-title">Slide Title</label>
                        <input id="slides-editor-slide-title" style={css.edInput} type="text" key={currentSlide?.id} defaultValue={currentSlide?.title || ''} placeholder="Slide title" />
                      </div>
                      <div style={css.edGrid2}>
                        <div style={css.edField}>
                          <label style={css.edLabel} htmlFor="slides-editor-slide-label">Slide Label</label>
                          <input id="slides-editor-slide-label" style={css.edInput} type="text" key={currentSlide?.id + '-l'} defaultValue={currentSlide?.label || ''} placeholder="Label" />
                        </div>
                        <div style={css.edField}>
                          <label style={css.edLabel} htmlFor="slides-editor-slide-transition">Transition</label>
                          <select id="slides-editor-slide-transition" style={css.edSelect} key={currentSlide?.id + '-t'} defaultValue={currentSlide?.transition || 'fade'}>
                            {TRANSITIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                          </select>
                        </div>
                      </div>
                      <div style={css.edGrid2}>
                        <div style={css.edField}>
                          <label style={css.edLabel} htmlFor="slides-editor-slide-duration">Duration (seconds)</label>
                          <input id="slides-editor-slide-duration" style={css.edInput} type="number" min="0" step="1" key={currentSlide?.id + '-d'} defaultValue={currentSlide ? currentSlide.durationMs / 1000 : 0} placeholder="0" />
                        </div>
                        <AppleToggle
                          id="slides-editor-slide-hidden"
                          label="Hide this slide"
                          checked={currentSlide?.hidden || false}
                          onChange={(checked) => {
                            const hiddenEl = document.getElementById('slides-editor-slide-hidden') as HTMLInputElement | null;
                            if (hiddenEl) hiddenEl.checked = checked;
                          }}
                        />
                      </div>
                      <div style={css.edField}>
                        <label style={css.edLabel} htmlFor="slides-editor-slide-body">Slide Body</label>
                        <textarea id="slides-editor-slide-body" style={css.edTextarea} key={currentSlide?.id + '-b'} defaultValue={currentSlide?.body || ''} placeholder="Slide body text" rows={3} />
                      </div>
                      <div style={css.edField}>
                        <label style={css.edLabel} htmlFor="slides-editor-slide-notes">Operator Notes</label>
                        <textarea id="slides-editor-slide-notes" style={css.edTextarea} key={currentSlide?.id + '-n'} defaultValue={currentSlide?.notes || ''} placeholder="Private operator notes" rows={2} />
                      </div>
                      <div style={css.edActions}>
                        <button style={{ ...css.actionChip, ...css.acPrimary }} onClick={handleSaveSlide}>Save Slide</button>
                        <button style={css.actionChip} onClick={handleMoveUp} disabled={currentSlideIndex <= 0}>Move Up</button>
                        <button style={css.actionChip} onClick={handleMoveDown} disabled={!activeDeck || currentSlideIndex >= activeDeck.slides.length - 1}>Move Down</button>
                        <button style={css.actionChip} onClick={handleAddBlankSlide}>Add Blank</button>
                        <button style={css.actionChip} onClick={handleDuplicateSlide}>Duplicate</button>
                        <button style={{ ...css.actionChip, ...css.acDanger }} onClick={handleDeleteSlide} disabled={!activeDeck || activeDeck.slides.length <= 1}>Delete</button>
                      </div>
                      <div style={{ marginTop: 10 }}>
                        <button
                          style={{ ...css.actionChip, ...css.acPrimary, width: '100%', justifyContent: 'center' }}
                          onClick={handleSendToDisplay}
                        >
                          Send to Display
                        </button>
                      </div>
                    </div>
                  </div>
                </aside>
              </>
            ) : (
              <div style={css.noDeck}>
                <h3 style={{ margin: 0, ...type.title, color: 'rgba(255,255,255,0.5)' }}>No deck selected</h3>
                <p style={{ margin: '8px 0 0', ...type.body, color: 'rgba(255,255,255,0.3)' }}>Select a deck from the library or import a new presentation.</p>
              </div>
            )}
          </main>
        </div>
      </div>

      {showCreateDialog && (
        <div style={css.dlgBackdrop} onClick={() => setShowCreateDialog(false)}>
          <div style={css.dlg} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: 0, ...type.title, color: '#f3f5f8' }}>Create Slide Project</h3>
            <label style={{ display: 'block', marginBottom: 7, ...type.secondary, color: 'rgba(255,255,255,0.5)' }}>Project Name</label>
            <input style={css.dlgInput} type="text" value={newDeckTitle} onChange={(e) => setNewDeckTitle(e.target.value)} placeholder="My Presentation" autoFocus onKeyDown={(e) => { if (e.key === 'Enter') handleCreateDeck(); }} />
            <div style={css.dlgActions}>
              <button style={css.actionChip} onClick={() => setShowCreateDialog(false)}>Cancel</button>
              <button style={{ ...css.actionChip, ...css.acPrimary }} onClick={handleCreateDeck}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const css: Record<string, React.CSSProperties> = {
  parsingBar: { height: 32, flex: '0 0 32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(74,134,255,0.15)', borderBottom: '1px solid rgba(74,134,255,0.25)', ...type.secondary, fontWeight: fontWeight.semibold, color: '#8ab4ff' },
  overlay: { position: 'fixed', inset: 0, zIndex: 1000, background: '#0b0d12', display: 'flex', flexDirection: 'column', color: '#f3f5f8', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' },
  editor: { display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 },
  topbar: { height: 48, flex: '0 0 48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(15,21,31,0.94)', backdropFilter: 'blur(14px)' },
  topbarLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  backBtn: { padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#fff', ...type.secondary, fontWeight: fontWeight.semibold, cursor: 'pointer' },
  topbarTitle: { ...type.heading, color: 'rgba(255,255,255,0.8)' },
  topbarStatus: { ...type.label, color: 'rgba(255,255,255,0.46)' },
  topbarRight: { display: 'flex', alignItems: 'center', gap: 10 },
  presenterBtn: { padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(74,134,255,0.85)', color: '#fff', ...type.secondary, fontWeight: fontWeight.semibold, cursor: 'pointer' },
  closeBtn: { padding: '4px 10px', borderRadius: 6, border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.5)', ...type.title, cursor: 'pointer' },
  body: { flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' },
  rail: { width: 220, flex: '0 0 220px', display: 'flex', flexDirection: 'column', borderRight: '1px solid rgba(255,255,255,0.08)', background: '#0f1117' },
  railActions: { display: 'flex', flexDirection: 'column', gap: 6, padding: 12, borderBottom: '1px solid rgba(255,255,255,0.08)' },
  actionChip: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#f3f5f8', ...type.secondary, fontWeight: fontWeight.semibold, cursor: 'pointer' },
  acPrimary: { background: 'rgba(74,134,255,0.94)', borderColor: 'rgba(120,167,255,0.42)', color: '#fff' },
  acDanger: { color: '#ff6b6b', borderColor: 'rgba(255,107,107,0.3)' },
  searchInput: { margin: '8px 12px', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: '#f3f5f8', ...type.secondary, outline: 'none' },
  railScroll: { flex: 1, overflowY: 'auto', padding: '4px 8px' },
  deckItem: { position: 'relative', padding: '8px 10px', borderRadius: 6, cursor: 'pointer', marginBottom: 2 },
  deckItemActive: { background: 'rgba(74,134,255,0.15)' },
  deckItemTitle: { ...type.secondary, fontWeight: fontWeight.semibold, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  deckItemMeta: { ...type.caption, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  deckDeleteBtn: { position: 'absolute', top: 4, right: 4, width: 20, height: 20, border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.3)', ...type.caption, cursor: 'pointer', borderRadius: 4, display: 'none' },
  emptyText: { padding: 20, textAlign: 'center', ...type.caption, color: 'rgba(255,255,255,0.35)' },
  railFooter: { padding: '8px 12px', borderTop: '1px solid rgba(255,255,255,0.08)' },
  filterSelect: { width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: '#f3f5f8', ...type.caption, outline: 'none' },
  main: { flex: 1, display: 'flex', minWidth: 0, overflow: 'hidden', gap: 0 },
  canvasArea: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, padding: 16, gap: 12, overflow: 'hidden' },
  canvasOuter: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0, overflow: 'hidden' },
  canvas: { width: '100%', maxWidth: '100%', height: '100%', maxHeight: '100%', aspectRatio: '16/9', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', background: 'linear-gradient(135deg, #0c0e14, #1a1a2e)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' },
  canvasContent: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '6%', textAlign: 'center', position: 'relative' },
  // Slide canvas renders the output, not chrome — deliberately outside the UI type scale.
  canvasBody: { fontSize: 'clamp(14px, 2.5vw, 38px)', fontWeight: 600, color: '#f0ece4', lineHeight: 1.35, maxWidth: '88%', textShadow: '0 2px 10px rgba(0,0,0,0.3)' },
  canvasPlaceholder: { fontSize: 'clamp(18px, 3vw, 44px)', fontWeight: 700, color: 'rgba(240,236,228,0.7)' },
  canvasTitle: {},
  canvasFooter: { position: 'absolute', bottom: 8, left: 12, right: 12, display: 'flex', justifyContent: 'space-between', ...type.label, fontWeight: fontWeight.regular, color: 'rgba(255,255,255,0.25)' },
  canvasEmpty: { color: 'rgba(255,255,255,0.3)', ...type.body },
  thumbStrip: { display: 'flex', gap: 8, overflowX: 'auto', padding: '4px 0', flex: '0 0 auto', minHeight: 60 },
  thumbItem: { flex: '0 0 100px', padding: 6, borderRadius: 8, cursor: 'pointer', border: '2px solid transparent', background: 'rgba(255,255,255,0.03)', transition: 'border-color 0.15s', overflow: 'hidden' },
  thumbItemActive: { borderColor: 'rgba(74,134,255,0.6)', background: 'rgba(74,134,255,0.1)' },
  thumbItemHidden: { opacity: 0.5 },
  thumbNum: { ...type.caption, ...numeric, fontWeight: fontWeight.bold, color: 'rgba(255,255,255,0.4)', marginBottom: 4 },
  thumbPreview: { ...type.caption, color: 'rgba(255,255,255,0.5)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as any },
  inspector: { width: 310, flex: '0 0 310px', display: 'flex', flexDirection: 'column', borderLeft: '1px solid rgba(255,255,255,0.08)', background: '#0f1117', overflowY: 'auto' },
  inspectorInfo: { display: 'flex', padding: 16, gap: 16 },
  insStat: { flex: 1, textAlign: 'center' },
  insStatVal: { ...type.display, ...numeric, color: '#f3f5f8' },
  insStatLabel: { ...type.label, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  insMeta: { padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: 8 },
  insMetaItem: { display: 'flex', justifyContent: 'space-between', ...type.secondary },
  insMetaLabel: { color: 'rgba(255,255,255,0.4)', fontWeight: fontWeight.medium },
  insMetaValue: { color: 'rgba(255,255,255,0.8)', fontWeight: fontWeight.semibold },
  insCard: { padding: 16, borderTop: '1px solid rgba(255,255,255,0.08)' },
  sectionTitle: { margin: '0 0 12px', ...type.label, color: 'rgba(255,255,255,0.48)' },
  edForm: { display: 'flex', flexDirection: 'column', gap: 10 },
  edField: { display: 'flex', flexDirection: 'column', gap: 4 },
  edLabel: { ...type.caption, fontWeight: fontWeight.semibold, color: 'rgba(255,255,255,0.5)' },
  edInput: { padding: '7px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: '#f3f5f8', ...type.secondary, outline: 'none' },
  edSelect: { padding: '7px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: '#f3f5f8', ...type.secondary, outline: 'none', cursor: 'pointer' },
  edTextarea: { padding: '7px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: '#f3f5f8', ...type.secondary, outline: 'none', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.45 },
  edGrid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  edCheck: { display: 'flex', alignItems: 'center', gap: 6, ...type.secondary, color: 'rgba(255,255,255,0.6)', cursor: 'pointer', paddingTop: 22 },
  edActions: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  noDeck: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 },
  dlgBackdrop: { position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.42)', backdropFilter: 'blur(4px)' },
  dlg: { width: 360, padding: 20, borderRadius: 14, border: '1px solid rgba(255,255,255,0.14)', background: '#1a1d24', boxShadow: '0 24px 70px rgba(0,0,0,0.45)', display: 'flex', flexDirection: 'column', gap: 12 },
  dlgInput: { padding: '10px 11px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.16)', background: 'rgba(0,0,0,0.2)', color: '#f3f5f8', ...type.body, outline: 'none' },
  dlgActions: { display: 'flex', justifyContent: 'flex-end', gap: 8 },
};
