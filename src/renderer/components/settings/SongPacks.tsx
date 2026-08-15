import { useState } from 'react';
import { useAppStore } from '../../stores/appStore';
import { SONG_PACKS, songFromPack, isInstalled, type SongPack } from '../../data/song-packs';

/**
 * Song packs, laid out the way the Bible translation downloads are: one
 * collapsible group per pack, a "Download all" action on the group header, and
 * a row per song carrying either a tick (already in the library) or a download
 * button.
 */
export function SongPacks() {
  const songs = useAppStore((s) => s.songs);
  const setSongs = useAppStore((s) => s.setSongs);
  const [openPacks, setOpenPacks] = useState<Record<string, boolean>>({});

  function addSongs(titles: Array<{ pack: SongPack; title: string }>) {
    const fresh = titles
      .map(({ pack, title }) => {
        const entry = pack.songs.find((s) => s.title === title);
        return entry ? songFromPack(entry, pack.name) : null;
      })
      .filter((song): song is NonNullable<typeof song> => Boolean(song))
      .filter((song) => !isInstalled(songs, song.title));
    if (fresh.length) setSongs([...songs, ...fresh]);
  }

  return (
    <div style={styles.stack}>
      {SONG_PACKS.map((pack) => {
        const isOpen = Boolean(openPacks[pack.id]);
        const pending = pack.songs.filter((song) => !isInstalled(songs, song.title));

        return (
          <section key={pack.id} style={styles.group}>
            <header
              style={{ ...styles.groupHeader, cursor: 'pointer' }}
              onClick={() => setOpenPacks((prev) => ({ ...prev, [pack.id]: !isOpen }))}
            >
              <div style={styles.groupLabel}>
                <span style={styles.groupIcon} aria-hidden>♪</span>
                <span style={styles.groupName}>{pack.name}</span>
              </div>
              <div style={styles.groupActions}>
                {pending.length > 0 ? (
                  <button
                    style={styles.downloadAll}
                    onClick={(e) => {
                      e.stopPropagation();
                      addSongs(pending.map((song) => ({ pack, title: song.title })));
                    }}
                  >
                    Download all ({pending.length} {pending.length === 1 ? 'song' : 'songs'})
                  </button>
                ) : (
                  <span style={styles.allInstalled}>Installed</span>
                )}
                <button
                  style={styles.chevron}
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenPacks((prev) => ({ ...prev, [pack.id]: !isOpen }));
                  }}
                  title={isOpen ? 'Collapse' : 'Expand'}
                  aria-expanded={isOpen}
                >
                  <svg
                    width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }}
                  >
                    <polyline points="6 15 12 9 18 15" />
                  </svg>
                </button>
              </div>
            </header>

            {isOpen && (
              <div style={styles.rows}>
                {pack.songs.map((song) => {
                  const installed = isInstalled(songs, song.title);
                  return (
                    <div key={song.title} style={styles.row}>
                      <span style={styles.rowLabel}>
                        <strong style={styles.rowTitle}>{song.title}</strong>
                        <span style={styles.rowDot}> · </span>
                        <span style={styles.rowArtist}>{song.artist}</span>
                      </span>
                      {installed ? (
                        <span style={styles.installedIcon} title="In your library">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="8.5 12.5 11 15 16 9.5" />
                          </svg>
                        </span>
                      ) : (
                        <button
                          style={styles.downloadIcon}
                          onClick={() => addSongs([{ pack, title: song.title }])}
                          title={`Add ${song.title} to your library`}
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="4" />
                            <path d="M12 7.5v7" />
                            <polyline points="9 11.5 12 14.5 15 11.5" />
                            <path d="M8 17h8" />
                          </svg>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  stack: { display: 'flex', flexDirection: 'column', gap: 12 },
  group: {
    background: 'var(--settings-card)',
    border: '1px solid var(--settings-line)',
    borderRadius: 6,
    overflow: 'hidden',
  },
  groupHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '12px 16px',
  },
  groupLabel: { display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 },
  groupIcon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 26,
    height: 26,
    borderRadius: '50%',
    background: 'var(--settings-panel)',
    border: '1px solid var(--settings-line)',
    color: 'var(--accent)',
    fontSize: 13,
    flexShrink: 0,
  },
  groupName: { fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' },
  groupActions: { display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 },
  downloadAll: {
    border: 'none',
    background: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    padding: 0,
    fontFamily: 'var(--font-ui)',
  },
  allInstalled: { fontSize: 13, color: 'var(--text-dim)' },
  chevron: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 24,
    border: 'none',
    background: 'transparent',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: 0,
  },
  rows: { display: 'flex', flexDirection: 'column', paddingBottom: 6 },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '9px 16px',
  },
  rowLabel: { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  rowTitle: { fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' },
  rowDot: { color: 'var(--text-dim)' },
  rowArtist: { fontSize: 14, fontWeight: 400, color: 'var(--text-secondary)' },
  installedIcon: { display: 'inline-flex', color: 'var(--text-secondary)', flexShrink: 0 },
  downloadIcon: {
    display: 'inline-flex',
    border: 'none',
    background: 'transparent',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: 0,
    flexShrink: 0,
  },
};
