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
import { useI18n } from '../../i18n/useI18n';

/* No Backgrounds block here. Solid and gradient grounds are the Themes
   panel's job; this panel is the media library, and it gets the whole pane. */

function formatSize(bytes: number) {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function MediaPanel() {
  const { t } = useI18n();
  const projectScene = useAppStore((s) => s.projectScene);
  const pushNotice = useAppStore((s) => s.notify);
  const currentScene = useAppStore((s) => s.display.currentScene);
  const previewScene = useAppStore((s) => s.display.previewScene);
  const clearProgram = useAppStore((s) => s.clearProgram);
  const isStudio = useAppStore((s) => s.display.mode === 'studio');
  const setVideoTransportTarget = useAppStore((s) => s.setVideoTransportTarget);
  const standbyMedia = useAppStore((s) => s.standbyMedia);
  const setStandbyMedia = useAppStore((s) => s.setStandbyMedia);
  const doubleClickToGoLive = useAppStore((s) => s.doubleClickToGoLive);
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
  const [hoveredMediaId, setHoveredMediaId] = useState<string | null>(null);
  const [mediaFits, setMediaFits] = useState<Record<string, 'contain' | 'cover' | 'fill'>>(() => {
    try {
      const saved = localStorage.getItem('bsp_media_fits');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const getMediaFit = (item: MediaItem): 'contain' | 'cover' | 'fill' => {
    return mediaFits[item.id] || item.fit || 'contain';
  };

  /* An operator notice, not a room announcement — "Imported 1 file" has no
     business on the projector. */
  const notify = (text: string, type: 'info' | 'warning' = 'info') => {
    pushNotice({ id: `media-${Date.now()}`, text, type, duration: 4, animation: 'slideDown' });
  };

  const updateMediaFit = (item: MediaItem, fit: 'contain' | 'cover' | 'fill') => {
    const updated = { ...mediaFits, [item.id]: fit };
    setMediaFits(updated);
    try {
      localStorage.setItem('bsp_media_fits', JSON.stringify(updated));
    } catch {}

    // If currently live on Program or cued on Preview, update scene transform dynamically
    if (isSceneUsingItem(currentScene, item) && currentScene) {
      setCurrentScene({
        ...currentScene,
        background: {
          ...(currentScene.background || { type: item.type, mediaUrl: item.url, mediaType: item.type }),
          fit,
        },
      });
    }
    if (isSceneUsingItem(previewScene, item) && previewScene) {
      setPreviewScene({
        ...previewScene,
        background: {
          ...(previewScene.background || { type: item.type, mediaUrl: item.url, mediaType: item.type }),
          fit,
        },
      });
    }

    const fitLabels: Record<'contain' | 'cover' | 'fill', string> = {
      contain: 'Fit to Screen',
      cover: 'Fill (Zoom & Crop)',
      fill: 'Stretch to Fit',
    };
    notify(`${item.name}: ${fitLabels[fit]}`);
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

  const setCurrentScene = useAppStore((s) => s.setCurrentScene);
  const setPreviewScene = useAppStore((s) => s.setPreviewScene);

  const isSceneUsingItem = (scene: Scene | null, item: MediaItem) => {
    if (!scene) return false;
    const bgUrl = scene.background?.mediaUrl;
    if (!bgUrl) return false;
    return bgUrl === item.url || bgUrl === absoluteUrl(item);
  };

  /* Removes the entry, not the operator's file. The library only ever pointed
     at it, so deleting it here would destroy something the app does not own.
     If the item is currently on Program or Preview, clear it immediately. */
  const handleRemove = async (item: MediaItem) => {
    const result = await window.BSP?.media?.remove(item.id).catch(() => null);
    if (result?.ok) {
      if (standbyMedia?.url === item.url) {
        setStandbyMedia(null);
      }
      if (isSceneUsingItem(currentScene, item)) {
        if (currentScene?.type === 'media') {
          setCurrentScene(null);
        } else if (currentScene) {
          setCurrentScene({ ...currentScene, background: undefined });
        }
      }
      if (isSceneUsingItem(previewScene, item)) {
        if (previewScene?.type === 'media') {
          setPreviewScene(null);
        } else if (previewScene) {
          setPreviewScene({ ...previewScene, background: undefined });
        }
      }
      refresh();
    } else {
      notify(result?.error || 'Could not remove that entry', 'warning');
    }
  };

  const handleToggleStandby = (item: MediaItem) => {
    if (standbyMedia?.url === item.url) {
      setStandbyMedia(null);
      notify(t('settings.output.resetDefaultStandby') || 'Restored default standby cover');
    } else {
      setStandbyMedia({ url: item.url, type: item.type, name: item.name });
      notify(`${t('media.setStandby')}: ${item.name}`);
    }
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

  const sendMedia = (item: MediaItem, opts: { direct?: boolean } = {}) => {
    /* Nothing reaches the screen the operator has not seen. A missing file
       would take a black frame to air, so the take is refused and the fix is
       named instead. */
    if (item.missing) {
      notify(`${item.name} is not at its saved location. Right-click it to relink.`, 'warning');
      return;
    }

    const isLive = isSceneUsingItem(currentScene, item);
    const isCued = isSceneUsingItem(previewScene, item);

    // Clicking an active media item again clears it from display (matching slide presentation behavior)
    if (!opts.direct) {
      if (isStudio) {
        if (isCued) {
          setPreviewScene(null);
          return;
        }
        if (isLive) {
          clearProgram();
          return;
        }
      } else if (isLive) {
        clearProgram();
        return;
      }
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
        fit: getMediaFit(item),
        loop: true,
        muted: Boolean(mutedMediaIds[item.id]),
        opacity: 1,
      },
    };
    projectScene(scene, { direct: opts.direct });
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
          {busy ? t('panel.importing') : t('media.import')}
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
        title={t('media.title')}
        subtitle={t('media.inLibrary', { count: items.length })}
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
              const isHovered = hoveredMediaId === item.id;

              return (
              <div
                key={item.id}
                className="card card-hover"
                onMouseEnter={() => setHoveredMediaId(item.id)}
                onMouseLeave={() => setHoveredMediaId(null)}
                style={{
                  width: 156,
                  padding: 6,
                  cursor: 'pointer',
                  /* The tally reaches the whole tile, not just a corner chip —
                     at a glance across a dark pane the operator reads the lit
                     edge before they read any word. */
                  ...(isLive || isCued
                    ? { borderColor: tally, boxShadow: isLive ? `0 0 0 1px ${tally}, 0 0 12px var(--accent-glow)` : `0 0 0 1px ${tally}` }
                    : null),
                }}
                onClick={() => {
                  if (doubleClickToGoLive && isStudio) {
                    sendMedia(item, { direct: false });
                  } else {
                    sendMedia(item);
                  }
                }}
                onDoubleClick={() => {
                  sendMedia(item, { direct: true });
                }}
                title={
                  item.missing
                    ? `${item.name} — file not found. Right-click to relink.`
                    : isLive
                    ? `${item.name} (${item.type.toUpperCase()} • ${formatSize(item.size)}) — ON AIR`
                    : isCued
                    ? `${item.name} (${item.type.toUpperCase()} • ${formatSize(item.size)}) — PREVIEW`
                    : `${item.name} (${item.type.toUpperCase()} • ${formatSize(item.size)})`
                }
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setMenu({ item, x: e.clientX, y: e.clientY });
                }}
              >
                <div
                  style={{
                    position: 'relative',
                    width: '100%',
                    aspectRatio: '16/9',
                    background: '#000',
                    borderRadius: 'var(--radius-sm)',
                    overflow: 'hidden',
                    marginBottom: 4,
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

                  {standbyMedia?.url === item.url && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 6,
                        right: 6,
                        zIndex: 3,
                        background: 'rgba(99, 102, 241, 0.92)',
                        color: '#ffffff',
                        fontSize: 9,
                        fontWeight: 700,
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                        padding: '2px 6px',
                        borderRadius: 3,
                        boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
                        pointerEvents: 'none',
                      }}
                      title={t('media.standbyBadge')}
                    >
                      STANDBY
                    </div>
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
                  {getMediaFit(item) !== 'contain' && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 6,
                        right: 6,
                        background: 'rgba(0, 0, 0, 0.75)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: 3,
                        padding: '1px 5px',
                        fontSize: 9,
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                        color: 'var(--accent, #FF5500)',
                        zIndex: 2,
                        pointerEvents: 'none',
                      }}
                      title={`Transform mode: ${getMediaFit(item) === 'cover' ? 'Fill (Zoom & Crop)' : 'Stretch to Fit'}`}
                    >
                      {getMediaFit(item) === 'cover' ? 'FILL' : 'STRETCH'}
                    </div>
                  )}
                  {item.type === 'image' ? (
                    <img
                      src={absoluteUrl(item)}
                      alt={item.name}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: getMediaFit(item) === 'fill' ? 'fill' : getMediaFit(item) === 'cover' ? 'cover' : 'contain',
                      }}
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
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: getMediaFit(item) === 'fill' ? 'fill' : getMediaFit(item) === 'cover' ? 'cover' : 'contain',
                        }}
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMutedMediaIds((prev) => ({ ...prev, [item.id]: !prev[item.id] }));
                        }}
                        onDoubleClick={(e) => e.stopPropagation()}
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
                {/* Single compact title row with hover delete */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, height: 20 }}>
                  <div
                    style={{
                      fontSize: 11.5,
                      fontWeight: fontWeight.medium,
                      color: item.missing ? 'var(--tally-fault)' : 'var(--text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1,
                    }}
                    title={item.sourcePath || item.name}
                  >
                    {item.name}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(item);
                    }}
                    onDoubleClick={(e) => e.stopPropagation()}
                    title={t('media.remove')}
                    style={{
                      padding: '1px 4px',
                      flexShrink: 0,
                      background: 'transparent',
                      border: 'none',
                      borderRadius: 3,
                      color: 'var(--text-dim)',
                      cursor: isHovered ? 'pointer' : 'default',
                      opacity: isHovered ? 0.8 : 0,
                      pointerEvents: isHovered ? 'auto' : 'none',
                      transition: 'opacity 0.15s ease, color 0.15s ease',
                      fontSize: 11,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--tally-fault, #ef4444)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-dim)'; }}
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
              left: Math.min(menu.x, window.innerWidth - 240),
              top: Math.min(menu.y, window.innerHeight - 340),
              zIndex: 1000,
              width: 230,
              maxWidth: 250,
              padding: 5,
              background: 'var(--bsp-raised)',
              border: '1px solid var(--border-primary)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            {/* Projection Commands */}
            {(isStudio ? [
              { label: 'Take Live Directly', run: () => sendMedia(menu.item, { direct: true }), disabled: menu.item.missing },
              { label: 'Stage in Preview', run: () => sendMedia(menu.item, { direct: false }), disabled: menu.item.missing },
            ] : [
              { label: 'Project Live', run: () => sendMedia(menu.item, { direct: true }), disabled: menu.item.missing },
            ]).map((entry) => (
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
                  color: entry.disabled ? 'var(--text-mute)' : 'var(--text-primary)',
                  cursor: entry.disabled ? 'default' : 'pointer',
                  ...type.body,
                }}
                onMouseEnter={(e) => { if (!entry.disabled) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                {entry.label}
              </button>
            ))}

            <div style={{ height: 1, background: 'var(--border-primary)', margin: '4px 0' }} />

            {/* Transform / Aspect Ratio options */}
            <div style={{ padding: '4px 10px 2px', fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Transform / Aspect Ratio
            </div>

            {[
              { label: 'Fit to Screen', fit: 'contain' as const, desc: 'Preserves aspect ratio without cropping' },
              { label: 'Fill (Zoom & Crop)', fit: 'cover' as const, desc: 'Fills 16:9 screen without black bars' },
              { label: 'Stretch to Fit', fit: 'fill' as const, desc: 'Stretches media to screen width & height' },
            ].map((opt) => {
              const isSelected = getMediaFit(menu.item) === opt.fit;
              return (
                <button
                  key={opt.fit}
                  role="menuitem"
                  title={opt.desc}
                  onClick={() => { setMenu(null); updateMediaFit(menu.item, opt.fit); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    textAlign: 'left',
                    padding: '6px 10px',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    background: isSelected ? 'var(--accent-dim, rgba(255, 85, 0, 0.12))' : 'transparent',
                    color: isSelected ? 'var(--accent, #FF5500)' : 'var(--text-primary)',
                    fontWeight: isSelected ? 600 : 400,
                    cursor: 'pointer',
                    ...type.body,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = isSelected ? 'var(--accent-dim, rgba(255, 85, 0, 0.18))' : 'var(--bg-hover)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = isSelected ? 'var(--accent-dim, rgba(255, 85, 0, 0.12))' : 'transparent'; }}
                >
                  <span>{opt.label}</span>
                  {isSelected && <span style={{ fontSize: 12, fontWeight: 700 }}>✓</span>}
                </button>
              );
            })}

            <div style={{ height: 1, background: 'var(--border-primary)', margin: '4px 0' }} />

            {/* Utility options */}
            {[
              { label: standbyMedia?.url === menu.item.url ? t('media.clearStandby') : t('media.setStandby'), run: () => handleToggleStandby(menu.item), disabled: menu.item.missing },
              { label: menu.item.missing ? t('media.relink') : t('media.relink'), run: () => handleRelink(menu.item) },
              { label: t('media.showInFolder'), run: () => handleReveal(menu.item), disabled: !menu.item.sourcePath },
              { label: t('media.remove'), run: () => handleRemove(menu.item), fault: true },
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
                overflowX: 'auto',
                whiteSpace: 'nowrap',
                fontSize: 10,
                lineHeight: 1.4,
              }}
              title={menu.item.sourcePath || ''}
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
