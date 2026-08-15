import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';
import { useAppStore } from '../stores/appStore';
import { useMediaLibrary } from '../hooks/useMediaLibrary';
import type { MediaItem, Scene } from '../types';
import { type, fontWeight } from '../styles/type';
import { Block, BlockButton } from './Block';
import { MediaTransport } from './MediaTransport';
import { TallyBadge } from './TallyBadge';
import { useBarPosition, MoveBarButton } from '../hooks/useBarPosition';

/* No Backgrounds block here. Solid and gradient grounds are the Themes
   panel's job; this panel is the media library, and it gets the whole pane. */

function formatSize(bytes: number) {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function MediaPanel() {
  const projectScene = useAppStore((s) => s.projectScene);
  const pushNotice = useAppStore((s) => s.notify);
  const currentScene = useAppStore((s) => s.display.currentScene);
  const previewScene = useAppStore((s) => s.display.previewScene);
  const setVideoTransportTarget = useAppStore((s) => s.setVideoTransportTarget);
  const { position: barPosition, move: moveBar } = useBarPosition('bsp_mediaBarPosition');

  /* The transport belongs to whichever surface is actually holding a video.
     Program wins: if a clip is on air, that is the one the operator needs the
     controls for. A clip only cued in Studio is the next best claim. Images
     get no transport at all — there is nothing to scrub. */
  const isVideoScene = (scene: Scene | null) =>
    scene?.background?.type === 'video' && Boolean(scene.background.mediaUrl);
  const transportTarget: 'program' | 'preview' | null =
    isVideoScene(currentScene) ? 'program' : isVideoScene(previewScene) ? 'preview' : null;

  /* Which library entry each surface is holding. A scene stores the media's
     own url, so that is the identity to match on — not the scene id, which is
     stamped with the moment of the take and differs every time the same clip
     is sent. Matching the url also catches the clip when it is riding under a
     song or a scripture slide: it is on the screen either way, and a library
     that only lit up for `type: 'media'` scenes would be lying about air. */
  const mediaUrlOf = (scene: Scene | null) => {
    const bg = scene?.background;
    if (!bg || (bg.type !== 'image' && bg.type !== 'video')) return null;
    return bg.mediaUrl || null;
  };
  const programUrl = mediaUrlOf(currentScene);
  const previewUrl = mediaUrlOf(previewScene);

  useEffect(() => {
    setVideoTransportTarget(transportTarget);
  }, [transportTarget, setVideoTransportTarget]);

  /* Shared with the theme editor's and the Songs panel's background pickers —
     an import here has to show up there without a reload. */
  const { items, refresh } = useMediaLibrary();
  const [baseUrl, setBaseUrl] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState<{ item: MediaItem; x: number; y: number } | null>(null);
  const [mutedMediaIds, setMutedMediaIds] = useState<Record<string, boolean>>({});

  /* An operator notice, not a room announcement — "Imported 1 file" has no
     business on the projector. */
  const notify = (text: string, type: 'info' | 'warning' = 'info') => {
    pushNotice({ id: `media-${Date.now()}`, text, type, duration: 4, animation: 'slideDown' });
  };

  useEffect(() => {
    window.BSP?.media?.baseUrl().then(setBaseUrl).catch(() => {});
  }, []);

  /* For this panel's own <img>/<video> thumbnails, which need a real origin
     now. What gets stored on a scene is the relative path — see below. */
  const absoluteUrl = (item: MediaItem) => `${baseUrl}${item.url}`;

  const applyImportResult = (result: { ok: boolean; items: MediaItem[]; errors: string[]; canceled?: boolean } | null) => {
    if (!result || result.canceled) return;
    if (result.items.length > 0) {
      notify(`Imported ${result.items.length} file${result.items.length === 1 ? '' : 's'}`);
      refresh();
    }
    if (result.errors?.length) notify(result.errors[0], 'warning');
  };

  const handlePick = async () => {
    setBusy(true);
    try {
      applyImportResult(await window.BSP?.media?.pick().catch(() => null) ?? null);
    } finally {
      setBusy(false);
    }
  };

  const handleDrop = async (files: File[]) => {
    if (files.length === 0) return;
    // webUtils.getPathForFile (via preload) — File.path was removed in Electron 32
    const paths = files.map((file) => window.BSP?.media?.pathForFile(file) || '').filter(Boolean);
    if (paths.length === 0) {
      notify('Could not read the dropped files — use the Import button instead.', 'warning');
      return;
    }
    setBusy(true);
    try {
      applyImportResult(await window.BSP?.media?.import(paths).catch(() => null) ?? null);
    } finally {
      setBusy(false);
    }
  };

  /* Removes the entry, not the operator's file. The library only ever pointed
     at it, so deleting it here would destroy something the app does not own. */
  const handleRemove = async (item: MediaItem) => {
    const result = await window.BSP?.media?.remove(item.id).catch(() => null);
    if (result?.ok) refresh();
    else notify(result?.error || 'Could not remove that entry', 'warning');
  };

  const handleRelink = async (item: MediaItem) => {
    const result = await window.BSP?.media
      ?.pickRelink(item.id, item.sourcePath || '', item.name)
      .catch(() => null);
    if (!result || result.canceled) return;
    if (result.ok) {
      notify(`Relinked ${item.name}`);
      refresh();
    } else {
      notify(result.error || 'Could not relink that file', 'warning');
    }
  };

  const handleReveal = async (item: MediaItem) => {
    if (!item.sourcePath) {
      notify('That entry has no file path to show.', 'warning');
      return;
    }
    const result = await window.BSP?.media?.reveal(item.sourcePath).catch(() => null);
    if (!result?.ok) notify(result?.error || 'Could not show that file', 'warning');
  };

  /* One menu at a time, and any click or Escape anywhere closes it. */
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('click', close);
    window.addEventListener('contextmenu', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('contextmenu', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [menu]);

  const sendMedia = (item: MediaItem) => {
    /* Nothing reaches the screen the operator has not seen. A missing file
       would take a black frame to air, so the take is refused and the fix is
       named instead. */
    if (item.missing) {
      notify(`${item.name} is not at its saved location. Right-click it to relink.`, 'warning');
      return;
    }
    const scene: Scene = {
      id: `media-${item.id}-${Date.now()}`,
      name: item.name,
      type: 'media',
      content: { text: '' },
      background: {
        type: item.type,
        /* Server-relative on purpose. This is persisted with the scene, and
           an absolute URL would pin the saved library to whatever port the
           server happened to hold the day it was added. Whoever renders the
           scene supplies the origin. */
        mediaUrl: item.url,
        mediaType: item.type,
        fit: 'cover',
        loop: true,
        muted: Boolean(mutedMediaIds[item.id]),
        opacity: 1,
      },
    };
    projectScene(scene);
  };

  /* Whole-panel drop. The dashed box that used to sit here took a fifth of
     the pane to mark a target the operator had to aim at; the panel itself is
     the target now, and the only time the invitation is drawn is when there is
     nothing in the library to draw instead.

     dragenter/dragleave fire for every child the pointer crosses, so a depth
     counter — not a boolean — decides when the drag has really left. */
  const dragDepth = useRef(0);

  const onDragEnter = (e: React.DragEvent) => {
    if (!Array.from(e.dataTransfer.types || []).includes('Files')) return;
    e.preventDefault();
    dragDepth.current += 1;
    setIsDragging(true);
  };
  const onDragOver = (e: React.DragEvent) => {
    if (!Array.from(e.dataTransfer.types || []).includes('Files')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };
  const onDragLeave = () => {
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setIsDragging(false);
  };
  const onDropAnywhere = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current = 0;
    setIsDragging(false);
    handleDrop(Array.from(e.dataTransfer.files || []));
  };

  /* Built once and rendered into whichever end is active — the same single
     element in both places, so the transport keeps its clock and its drag
     across a move rather than remounting into a second copy. */
  const toolbar = (
    <div className="blk blk--bar">
      <div style={styles.controlsRow}>
        <BlockButton onClick={handlePick} disabled={busy}>
          {busy ? 'Importing\u2026' : 'Import Media'}
        </BlockButton>
        {transportTarget && <MediaTransport />}
        <span style={{ marginLeft: 'auto' }}>
          <MoveBarButton
            position={barPosition}
            onMove={moveBar}
            label="Media"
            style={styles.moveBtn}
          />
        </span>
      </div>
    </div>
  );

  return (
    <div className="blk-col" style={{ height: '100%', minHeight: 0 }}>
      {barPosition === 'top' && toolbar}

      <Block
        className="blk-fill"
        title="Media"
        subtitle={`${items.length} in library`}
      >
      <div
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDropAnywhere}
        style={{ position: 'relative', minHeight: '100%' }}
      >
        {/* Drawn over the whole pane while a drag is in flight, so the target
            is unmistakable without costing anything at rest. */}
        {isDragging && (
          <div
            style={{
              position: 'absolute', inset: -4, zIndex: 5,
              border: '1px solid var(--accent)',
              background: 'var(--accent-dim)',
              borderRadius: 'var(--radius-md)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-signal)', fontSize: 11,
                letterSpacing: 'var(--ls-caps)', textTransform: 'uppercase',
                color: 'var(--accent)',
              }}
            >
              Drop to import
            </span>
          </div>
        )}

        {/* Library. Just the count — the tally lives on the card and nowhere
            else. The header used to repeat "Live · <name>" for the on-air clip,
            but the lit tile already says it with a lamp and a lit edge, and the
            same state announced twice is the one thing an operator has to stop
            and reconcile. */}
        <div className="section-title">Media Library ({items.length})</div>
        {items.length === 0 ? (
          <div
            onClick={handlePick}
            style={{ textAlign: 'center', padding: '32px 20px', cursor: 'pointer' }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 10px', display: 'block' }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <div style={{ ...type.secondary, color: 'var(--text-secondary)' }}>
              Drop images or videos anywhere on this panel
            </div>
            <div style={{ ...type.caption, color: 'var(--text-dim)', marginTop: 3 }}>
              or click to browse
            </div>
            <div style={{ ...type.caption, color: 'var(--text-mute)', marginTop: 10 }}>
              JPG · PNG · WEBP · GIF · SVG · MP4 · MOV · WEBM
            </div>
            <div style={{ ...type.caption, color: 'var(--text-mute)', marginTop: 10 }}>
              Files stay where they are on disk — the library points at them.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingBottom: 16 }}>
            {items.map((item) => {
              const isLive = programUrl === item.url;
              const isCued = previewUrl === item.url && !isLive;
              const tally = isLive ? 'var(--tally-program)' : 'var(--tally-preview)';

              return (
              <div
                key={item.id}
                className="card card-hover"
                style={{
                  width: 180,
                  /* The tally reaches the whole tile, not just a corner chip —
                     at a glance across a dark pane the operator reads the lit
                     edge before they read any word. */
                  ...(isLive || isCued
                    ? { borderColor: tally, boxShadow: isLive ? `0 0 0 1px ${tally}, 0 0 12px var(--accent-glow)` : `0 0 0 1px ${tally}` }
                    : null),
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setMenu({ item, x: e.clientX, y: e.clientY });
                }}
              >
                <div
                  onClick={() => sendMedia(item)}
                  title={
                    item.missing
                      ? `${item.name} — file not found. Right-click to relink.`
                      : isLive
                      ? `${item.name} is on the audience screen now`
                      : isCued
                      ? `${item.name} is cued in Preview — Take to put it on screen`
                      : `Preview ${item.name}`
                  }
                  style={{
                    position: 'relative',
                    width: '100%',
                    aspectRatio: '16/9',
                    background: '#000',
                    borderRadius: 'var(--radius-sm)',
                    overflow: 'hidden',
                    marginBottom: 8,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {/* The lamp — the same one Pro Slides hangs on its cards, in
                      the same corner, because two panels showing the same
                      state two different ways is one state too many. */}
                  {(isLive || isCued) && (
                    <TallyBadge state={isLive ? 'live' : 'cued'} style={{ zIndex: 2 }} />
                  )}

                  {/* Fault, because that is what a source with no file is. The
                      badge sits over the thumbnail rather than replacing it —
                      the operator still needs to recognise the clip. */}
                  {item.missing && (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'rgba(12, 11, 11, 0.72)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1,
                      }}
                    >
                      <span
                        style={{
                          ...type.label,
                          fontWeight: fontWeight.bold,
                          textTransform: 'uppercase',
                          letterSpacing: 'var(--ls-caps)',
                          color: 'var(--tally-fault)',
                          border: '1px solid var(--tally-fault)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '3px 7px',
                          background: 'rgba(239, 68, 68, 0.12)',
                        }}
                      >
                        Missing media
                      </span>
                    </div>
                  )}
                  {item.type === 'image' ? (
                    <img
                      src={absoluteUrl(item)}
                      alt={item.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <>
                      <video
                        src={absoluteUrl(item)}
                        muted
                        playsInline
                        preload="metadata"
                        onMouseEnter={(e) => e.currentTarget.play().catch(() => {})}
                        onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMutedMediaIds((prev) => ({ ...prev, [item.id]: !prev[item.id] }));
                        }}
                        title={mutedMediaIds[item.id] ? "Pre-muted: Audio will be muted when played. Click to unmute." : "Audio Enabled: Audio will play. Click to pre-mute."}
                        style={{
                          position: 'absolute',
                          bottom: 6,
                          left: 6,
                          width: 24,
                          height: 24,
                          borderRadius: 4,
                          background: mutedMediaIds[item.id] ? 'rgba(239, 68, 68, 0.95)' : 'rgba(0, 0, 0, 0.65)',
                          border: '1px solid rgba(255, 255, 255, 0.25)',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          zIndex: 10,
                          boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {mutedMediaIds[item.id] ? (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none" />
                            <line x1="22" y1="2" x2="2" y2="22" stroke="#ffffff" strokeWidth="2.5" />
                          </svg>
                        ) : (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none" />
                            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                          </svg>
                        )}
                      </button>
                    </>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ ...type.secondary, fontWeight: fontWeight.medium, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.name}
                    </div>
                    {/* Format and size only. State is the badge's job — saying
                        it twice on one tile just costs a line of wrap. */}
                    <div
                      style={{ ...type.caption, color: item.missing ? 'var(--tally-fault)' : 'var(--text-dim)', textTransform: 'uppercase' }}
                      title={item.sourcePath || ''}
                    >
                      {item.missing ? 'File not found' : `${item.type} · ${formatSize(item.size)}`}
                    </div>
                  </div>
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={() => handleRemove(item)}
                    title="Remove from library"
                    style={{ padding: '2px 6px', flexShrink: 0 }}
                  >
                    ✕
                  </button>
                </div>
              </div>
              );
            })}
          </div>
        )}

        {/* Right-click menu. Relink leads, because it is the one action that
            recovers a library the operator would otherwise rebuild by hand. */}
        {menu && (
          <div
            role="menu"
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
            style={{
              position: 'fixed',
              left: Math.min(menu.x, window.innerWidth - 200),
              top: Math.min(menu.y, window.innerHeight - 140),
              zIndex: 1000,
              minWidth: 184,
              padding: 4,
              background: 'var(--bsp-raised)',
              border: '1px solid var(--border-primary)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            {[
              { label: menu.item.missing ? 'Relink…' : 'Relink to another file…', run: () => handleRelink(menu.item) },
              { label: 'Show in Finder', run: () => handleReveal(menu.item), disabled: !menu.item.sourcePath },
              { label: 'Remove from library', run: () => handleRemove(menu.item), fault: true },
            ].map((entry) => (
              <button
                key={entry.label}
                role="menuitem"
                disabled={entry.disabled}
                onClick={() => { setMenu(null); entry.run(); }}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '6px 10px',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  background: 'transparent',
                  color: entry.disabled
                    ? 'var(--text-mute)'
                    : entry.fault ? 'var(--tally-fault)' : 'var(--text-primary)',
                  cursor: entry.disabled ? 'default' : 'pointer',
                  ...type.body,
                }}
                onMouseEnter={(e) => {
                  if (!entry.disabled) e.currentTarget.style.background = 'var(--bg-hover)';
                }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                {entry.label}
              </button>
            ))}
            <div
              style={{
                ...type.caption,
                color: 'var(--text-mute)',
                padding: '6px 10px 4px',
                borderTop: '1px solid var(--border-primary)',
                marginTop: 4,
                wordBreak: 'break-all',
              }}
            >
              {menu.item.sourcePath || 'Imported by an older build — stored in the app folder'}
            </div>
          </div>
        )}
      </div>
      </Block>

      {barPosition === 'bottom' && toolbar}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  controlsRow: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'nowrap', minWidth: '100%' },
  moveBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 32, height: 28,
    background: 'var(--chrome-control)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)', cursor: 'pointer', flexShrink: 0,
  },
};
