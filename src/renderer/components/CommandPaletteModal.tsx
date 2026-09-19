import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAppStore } from '../stores/appStore';

export interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PaletteItem {
  id: string;
  category: 'scripture' | 'song' | 'slide' | 'command';
  title: string;
  subtitle?: string;
  badge?: string;
  action: () => void;
}

const COMMON_COMMANDS: Array<{
  id: string;
  title: string;
  subtitle: string;
  badge?: string;
  execute: () => void;
}> = [
  {
    id: 'cmd-clear-output',
    title: 'Clear Output (Standby)',
    subtitle: 'Takes down the live screen to black/clear background',
    badge: 'ESC',
    execute: () => {
      useAppStore.getState().clearProgram();
    },
  },
  {
    id: 'cmd-toggle-blackout',
    title: 'Toggle Blackout',
    subtitle: 'Completely blacks out all connected audience and NDI displays',
    badge: '⌘⇧B',
    execute: () => {
      useAppStore.getState().setBlackout();
    },
  },
  {
    id: 'cmd-toggle-mode',
    title: 'Toggle Operating Mode (Basic ↔ Studio)',
    subtitle: 'Switch between direct take and live/preview two-screen mode',
    execute: () => {
      const isStudio = useAppStore.getState().display.mode === 'studio';
      useAppStore.getState().setMode(isStudio ? 'basic' : 'studio');
    },
  },
  {
    id: 'cmd-toggle-output-mode',
    title: 'Toggle Output Mode (Fullscreen ↔ Lower Third)',
    subtitle: 'Switch display between full screen and live broadcast lower-third',
    execute: () => {
      const mode = useAppStore.getState().display.outputMode;
      useAppStore.getState().setOutputMode(mode === 'fullscreen' ? 'lowerThird' : 'fullscreen');
    },
  },
  {
    id: 'cmd-open-slide-editor',
    title: 'Open Pro Slide Editor',
    subtitle: 'Launch full-screen canvas design studio for presentations',
    badge: '⌘E',
    execute: () => {
      const decks = useAppStore.getState().presentationDecks;
      if (decks && decks.length > 0) {
        useAppStore.getState().openSlideEditor(decks[0].id);
      } else {
        useAppStore.getState().openSlideEditor();
      }
    },
  },
  {
    id: 'cmd-open-theme-studio',
    title: 'Open Theme Studio',
    subtitle: 'Customise typography, overlays, scripture templates and layouts',
    execute: () => {
      useAppStore.getState().openThemeStudio();
    },
  },
  {
    id: 'cmd-open-settings',
    title: 'Open Settings',
    subtitle: 'Configure audio inputs, NDI, hardware encoders, displays and hotkeys',
    badge: '⌘,',
    execute: () => {
      useAppStore.getState().openSettings();
    },
  },
  {
    id: 'cmd-open-shortcuts',
    title: 'Keyboard Shortcuts & Cheat Sheet',
    subtitle: 'View all operator keybindings, shortcuts and workflow controls',
    badge: '?',
    execute: () => {
      useAppStore.getState().openShortcuts();
    },
  },
];

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const songs = useAppStore((s) => s.songs) || [];
  const presentationDecks = useAppStore((s) => s.presentationDecks) || [];

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  const filteredItems = useMemo<PaletteItem[]>(() => {
    const q = query.trim().toLowerCase();
    const items: PaletteItem[] = [];

    // 1. Scripture search match (e.g. "John 3", "Gen 1:1", "Psalm 23")
    if (q.length >= 2) {
      const scriptureMatch = q.match(/^([1-3]?\s*[a-zA-Z]+)\s*(\d+)?(?::(\d+))?$/);
      if (scriptureMatch) {
        const bookName = scriptureMatch[1].trim();
        const chapter = scriptureMatch[2] ? Number(scriptureMatch[2]) : 1;
        const verse = scriptureMatch[3] ? Number(scriptureMatch[3]) : undefined;
        const label = `${bookName.charAt(0).toUpperCase() + bookName.slice(1)} ${chapter}${verse ? `:${verse}` : ''}`;
        items.push({
          id: `scripture-${q}`,
          category: 'scripture',
          title: `Jump to Scripture: ${label}`,
          subtitle: `Open ${label} in Bible reader and cue verse`,
          badge: 'Bible',
          action: () => {
            window.dispatchEvent(new CustomEvent('bsp:navigate-bible', {
              detail: { book: bookName, chapter, verse },
            }));
            onClose();
          },
        });
      }
    }

    // 2. Songs search match
    if (q) {
      const matchedSongs = songs
        .filter((song) => {
          return (
            song.title.toLowerCase().includes(q) ||
            song.author?.toLowerCase().includes(q) ||
            song.slides?.some((s) => s.text?.toLowerCase().includes(q) || s.label?.toLowerCase().includes(q))
          );
        })
        .slice(0, 5);

      matchedSongs.forEach((song) => {
        items.push({
          id: `song-${song.id}`,
          category: 'song',
          title: song.title,
          subtitle: song.author ? `Song by ${song.author} • ${song.slides?.length || 0} verses` : `${song.slides?.length || 0} slide segments`,
          badge: 'Song',
          action: () => {
            window.dispatchEvent(new CustomEvent('bsp:navigate-song', {
              detail: { songId: song.id },
            }));
            onClose();
          },
        });
      });
    }

    // 3. Presentation / Pro Slides match
    if (q) {
      const matchedDecks = presentationDecks
        .filter((deck) => {
          return (
            deck.title.toLowerCase().includes(q) ||
            deck.slides?.some((s: any) => s.body?.toLowerCase().includes(q) || s.title?.toLowerCase().includes(q))
          );
        })
        .slice(0, 5);

      matchedDecks.forEach((deck) => {
        items.push({
          id: `deck-${deck.id}`,
          category: 'slide',
          title: deck.title || 'Untitled Presentation',
          subtitle: `${deck.slides?.length || 0} slides in deck`,
          badge: 'Pro Slides',
          action: () => {
            window.dispatchEvent(new CustomEvent('bsp:navigate-presentation', {
              detail: { deckId: deck.id },
            }));
            onClose();
          },
        });
      });
    }

    // 4. Common Commands match
    COMMON_COMMANDS.forEach((cmd) => {
      if (!q || cmd.title.toLowerCase().includes(q) || cmd.subtitle.toLowerCase().includes(q)) {
        items.push({
          id: cmd.id,
          category: 'command',
          title: cmd.title,
          subtitle: cmd.subtitle,
          badge: cmd.badge || 'Command',
          action: () => {
            cmd.execute();
            onClose();
          },
        });
      }
    });

    return items;
  }, [query, songs, presentationDecks, onClose]);

  // Keep selected index valid
  useEffect(() => {
    if (selectedIndex >= filteredItems.length) {
      setSelectedIndex(Math.max(0, filteredItems.length - 1));
    }
  }, [filteredItems.length, selectedIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredItems.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        filteredItems[selectedIndex].action();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.70)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '12vh',
        zIndex: 100000,
        fontFamily: 'var(--bsp-font-interface, system-ui, -apple-system, sans-serif)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '580px',
          maxWidth: 'calc(100vw - 32px)',
          maxHeight: '520px',
          backgroundColor: 'var(--bsp-surface, #1C1A19)',
          border: '1px solid var(--bsp-edge, #2D2A28)',
          borderRadius: '8px',
          boxShadow: '0 24px 70px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(255, 255, 255, 0.08)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Search Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 16px',
            borderBottom: '1px solid var(--bsp-edge, #2D2A28)',
            backgroundColor: 'var(--bsp-ground, #111010)',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--bsp-signal, #FF5500)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>

          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a scripture (e.g. John 3:16), song, slide or command..."
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--bsp-screen, #F5F3F1)',
              fontSize: '14px',
              fontFamily: 'inherit',
            }}
          />

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '2px 6px',
              borderRadius: '4px',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              color: 'var(--bsp-dim, #8A8580)',
              fontSize: '10px',
              fontWeight: 600,
            }}
          >
            ESC
          </div>
        </div>

        {/* Results List */}
        <div
          ref={listRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '8px 0',
            maxHeight: '420px',
          }}
        >
          {filteredItems.length === 0 ? (
            <div
              style={{
                padding: '32px 20px',
                textAlign: 'center',
                color: 'var(--bsp-dim, #8A8580)',
                fontSize: '13px',
              }}
            >
              No matching scripture, song, slide, or command found.
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const isSelected = index === selectedIndex;
              const categoryColor =
                item.category === 'scripture'
                  ? '#38bdf8'
                  : item.category === 'song'
                  ? '#a855f7'
                  : item.category === 'slide'
                  ? '#FF5500'
                  : '#10b981';

              return (
                <div
                  key={item.id}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(index)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '9px 16px',
                    cursor: 'pointer',
                    backgroundColor: isSelected ? 'rgba(255, 85, 0, 0.14)' : 'transparent',
                    borderLeft: isSelected ? '3px solid #FF5500' : '3px solid transparent',
                    transition: 'background-color 0.1s ease',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          fontSize: '9.5px',
                          fontWeight: 700,
                          padding: '1px 5px',
                          borderRadius: '3px',
                          backgroundColor: `${categoryColor}22`,
                          color: categoryColor,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}
                      >
                        {item.category}
                      </span>
                      <span
                        style={{
                          fontSize: '13px',
                          fontWeight: isSelected ? 650 : 500,
                          color: 'var(--bsp-screen)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {item.title}
                      </span>
                    </div>

                    {item.subtitle && (
                      <div
                        style={{
                          fontSize: '11px',
                          color: 'var(--bsp-dim, #8A8580)',
                          marginTop: '2px',
                          paddingLeft: '48px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {item.subtitle}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {item.badge && (
                      <span
                        style={{
                          fontSize: '10.5px',
                          fontWeight: 600,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: 'rgba(255, 255, 255, 0.06)',
                          color: 'var(--bsp-dim, #8A8580)',
                        }}
                      >
                        {item.badge}
                      </span>
                    )}

                    {isSelected && (
                      <span style={{ fontSize: '11px', color: '#FF5500', fontWeight: 600 }}>
                        ↵
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Navigation Hints */}
        <div
          style={{
            padding: '8px 16px',
            borderTop: '1px solid var(--bsp-edge, #2D2A28)',
            backgroundColor: 'var(--bsp-ground, #111010)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '11px',
            color: 'var(--bsp-dim, #8A8580)',
          }}
        >
          <div style={{ display: 'flex', gap: 14 }}>
            <span><strong style={{ color: 'var(--bsp-screen, #F5F3F1)' }}>↑↓</strong> Navigate</span>
            <span><strong style={{ color: 'var(--bsp-screen, #F5F3F1)' }}>↵</strong> Select</span>
            <span><strong style={{ color: 'var(--bsp-screen, #F5F3F1)' }}>ESC</strong> Close</span>
          </div>
          <span style={{ fontSize: '10.5px', color: 'var(--bsp-dim, #8A8580)' }}>Quick Spotlight Command Palette</span>
        </div>
      </div>
    </div>
  );
};
