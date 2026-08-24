/* =========================================================================
   MediaGrid — pick one clip or still out of the imported library
   -------------------------------------------------------------------------
   Shared by the theme editor and the Songs panel. Thumbnails rather than a
   dropdown of file names, because an operator recognises the mountain loop on
   sight and has no idea which of them is `sunrise-final-v2.mp4`.
   ========================================================================= */
import { useState, type DragEvent } from 'react';
import type { MediaItem } from '../types';
import { useMediaLibrary, refreshMediaLibrary } from '../hooks/useMediaLibrary';
import { useAssetBaseUrl } from '../hooks/useAssetBaseUrl';
import { type } from '../styles/type';

interface MediaGridProps {
  kind: 'image' | 'video';
  /** The chosen media's server-relative url, or '' for none. */
  selectedUrl: string;
  onSelect: (item: MediaItem) => void;
}

export function MediaGrid({ kind, selectedUrl, onSelect }: MediaGridProps) {
  const { items } = useMediaLibrary();
  const baseUrl = useAssetBaseUrl();
  const matching = items.filter((item) => item.type === kind);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState('');

  const applyImported = (imported: MediaItem[]) => {
    const match = imported.find((item) => item.type === kind);
    if (match) onSelect(match);
  };

  const handleImport = async () => {
    if (!window.BSP?.media?.pick) return;
    setBusy(true);
    setHint('');
    try {
      const result = await window.BSP.media.pick();
      if (result?.canceled) return;
      await refreshMediaLibrary();
      if (result?.items?.length) applyImported(result.items);
      else if (result?.errors?.[0]) setHint(result.errors[0]);
    } finally {
      setBusy(false);
    }
  };

  const handleDrop = async (event: DragEvent) => {
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files || []);
    if (files.length === 0 || !window.BSP?.media) return;
    const paths = files.map((file) => window.BSP.media.pathForFile(file) || '').filter(Boolean);
    if (paths.length === 0) {
      setHint('Could not read those files — use Import instead.');
      return;
    }
    setBusy(true);
    setHint('');
    try {
      const result = await window.BSP.media.import(paths);
      await refreshMediaLibrary();
      if (result?.items?.length) applyImported(result.items);
      else if (result?.errors?.[0]) setHint(result.errors[0]);
    } finally {
      setBusy(false);
    }
  };

  const importRow = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button
        type="button"
        className="btn btn-sm btn-secondary"
        disabled={busy}
        onClick={handleImport}
      >
        {busy ? 'Importing…' : kind === 'video' ? 'Import video…' : 'Import image…'}
      </button>
      <span style={{ ...type.caption, color: 'var(--text-dim)' }}>
        or drop a file here
      </span>
    </div>
  );

  if (matching.length === 0) {
    return (
      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          padding: '12px 10px',
          border: '1px dashed var(--border-primary)',
          borderRadius: 6,
          background: 'rgba(255,255,255,0.02)',
        }}
      >
        <div style={{ ...type.caption, color: 'var(--text-secondary)' }}>
          No {kind === 'video' ? 'videos' : 'images'} in the library yet.
        </div>
        {importRow}
        {hint && <div style={{ ...type.caption, color: 'var(--warning, #f59e0b)' }}>{hint}</div>}
      </div>
    );
  }

  return (
    <div
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
      style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
    >
    {importRow}
    {hint && <div style={{ ...type.caption, color: 'var(--warning, #f59e0b)' }}>{hint}</div>}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, maxHeight: 190, overflowY: 'auto' }}>
      {matching.map((item) => {
        const selected = item.url === selectedUrl;
        return (
          <button
            key={item.id}
            type="button"
            title={item.missing ? `${item.name} — file not found. Relink it in the Media panel.` : item.name}
            onClick={() => onSelect(item)}
            style={{
              position: 'relative',
              padding: 0,
              aspectRatio: '16/9',
              overflow: 'hidden',
              background: '#000',
              cursor: 'pointer',
              borderRadius: 'var(--radius-sm)',
              /* The selected tile carries the same lit edge a live media card
                 does, so "chosen" reads the same way everywhere in the app. */
              border: selected ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.12)',
              boxShadow: selected ? '0 0 0 1px var(--accent)' : undefined,
              opacity: item.missing ? 0.45 : 1,
            }}
          >
            {kind === 'image' ? (
              <img
                src={`${baseUrl}${item.url}`}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            ) : (
              /* Muted, unplayed, and preloading metadata only — this is a
                 contact sheet, not six clips running behind a dialog. */
              <video
                src={`${baseUrl}${item.url}`}
                muted
                playsInline
                preload="metadata"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            )}
            <span
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                padding: '2px 4px',
                background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
                color: '#fff',
                fontSize: 9,
                textAlign: 'left',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {item.missing ? 'Missing · ' : ''}{item.name}
            </span>
          </button>
        );
      })}
    </div>
    </div>
  );
}
