import { useCallback, useEffect, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import type { MediaItem, Scene } from '../types';

const GRADIENT_PRESETS = [
  { name: 'Purple Haze', value: 'linear-gradient(135deg, #667eea, #764ba2)' },
  { name: 'Sunset', value: 'linear-gradient(135deg, #f093fb, #f5576c)' },
  { name: 'Deep Space', value: 'linear-gradient(135deg, #0f0c29, #302b63)' },
  { name: 'Midnight', value: 'linear-gradient(135deg, #0f172a, #1e1b4b, #312e81)' },
  { name: 'Ocean', value: 'linear-gradient(135deg, #2193b0, #6dd5ed)' },
  { name: 'Ember', value: 'linear-gradient(135deg, #200122, #6f0000)' },
];

function formatSize(bytes: number) {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function MediaPanel() {
  const projectScene = useAppStore((s) => s.projectScene);
  const triggerAlert = useAppStore((s) => s.triggerAlert);

  const [bgType, setBgType] = useState<'solid' | 'gradient'>('gradient');
  const [bgColor, setBgColor] = useState('#0f172a');
  const [gradient, setGradient] = useState(GRADIENT_PRESETS[0].value);

  const [items, setItems] = useState<MediaItem[]>([]);
  const [baseUrl, setBaseUrl] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [busy, setBusy] = useState(false);

  const notify = (text: string, type: 'info' | 'warning' = 'info') => {
    triggerAlert({ id: `media-${Date.now()}`, text, type, duration: 4, animation: 'slideDown' });
  };

  const refresh = useCallback(async () => {
    const result = await window.BSP?.media?.list().catch(() => null);
    if (result?.ok) setItems(result.items);
  }, []);

  useEffect(() => {
    window.BSP?.media?.baseUrl().then(setBaseUrl).catch(() => {});
    refresh();
  }, [refresh]);

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

  const handleRemove = async (item: MediaItem) => {
    const result = await window.BSP?.media?.remove(item.id).catch(() => null);
    if (result?.ok) refresh();
    else notify(result?.error || 'Could not remove that file', 'warning');
  };

  const sendMedia = (item: MediaItem) => {
    const scene: Scene = {
      id: `media-${item.id}-${Date.now()}`,
      name: item.name,
      type: 'media',
      content: { text: '' },
      background: {
        type: item.type,
        mediaUrl: absoluteUrl(item),
        mediaType: item.type,
        fit: 'cover',
        loop: true,
        opacity: 1,
      },
    };
    projectScene(scene);
  };

  const sendBackground = (overrideGradient?: string) => {
    const value = overrideGradient ?? gradient;
    const usingGradient = overrideGradient !== undefined || bgType === 'gradient';
    const scene: Scene = {
      id: `background-${Date.now()}`,
      name: usingGradient ? 'Gradient Background' : 'Solid Background',
      type: 'media',
      content: { text: '' },
      background: {
        type: usingGradient ? 'gradient' : 'solid',
        color: bgColor,
        gradient: value,
        fit: 'cover',
        opacity: 1,
      },
    };
    projectScene(scene);
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600 }}>Media</h2>
        <button className="btn btn-sm btn-primary" onClick={handlePick} disabled={busy}>
          {busy ? 'Importing…' : 'Import Media'}
        </button>
      </div>

      {/* Colour / gradient backgrounds */}
      <div className="glass" style={{ padding: 12, borderRadius: 'var(--radius-md)', marginBottom: 12 }}>
        <div className="section-title">Backgrounds</div>
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr auto', gap: 8, marginBottom: 12 }}>
          <select className="input" value={bgType} onChange={(e) => setBgType(e.target.value as 'solid' | 'gradient')}>
            <option value="gradient">Gradient</option>
            <option value="solid">Solid</option>
          </select>
          {bgType === 'solid' ? (
            <input className="input" type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} />
          ) : (
            <input className="input" value={gradient} onChange={(e) => setGradient(e.target.value)} />
          )}
          <button className="btn btn-primary btn-sm" onClick={() => sendBackground()}>Preview</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {GRADIENT_PRESETS.map((preset) => (
            <button
              key={preset.name}
              className="card card-hover"
              onClick={() => { setBgType('gradient'); setGradient(preset.value); sendBackground(preset.value); }}
              style={{ aspectRatio: '16/9', padding: 0, overflow: 'hidden', border: 'none', cursor: 'pointer' }}
              title={`Preview ${preset.name}`}
            >
              <div style={{ width: '100%', height: '100%', background: preset.value, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)' }}>{preset.name}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Drop target */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleDrop(Array.from(e.dataTransfer.files || []));
        }}
        onClick={handlePick}
        style={{
          border: `2px dashed ${isDragging ? 'var(--border-accent)' : 'var(--border-primary)'}`,
          background: isDragging ? 'var(--accent-dim)' : 'transparent',
          borderRadius: 'var(--radius-md)',
          padding: 24,
          textAlign: 'center',
          cursor: 'pointer',
          marginBottom: 16,
          transition: 'background 0.15s, border-color 0.15s',
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="1.5" style={{ margin: '0 auto 8px' }}>
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
          Drop images or videos here, or click to browse
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4, opacity: 0.7 }}>
          JPG · PNG · WEBP · GIF · SVG · MP4 · MOV · WEBM
        </div>
      </div>

      {/* Library */}
      <div className="section-title" style={{ marginBottom: 8 }}>Media Library ({items.length})</div>
      {items.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-dim)', textAlign: 'center', padding: 20 }}>
          Nothing imported yet. Files you add are copied into the app's media folder.
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {items.map((item) => (
            <div key={item.id} className="card card-hover" style={{ width: 180 }}>
              <div
                onClick={() => sendMedia(item)}
                title={`Preview ${item.name}`}
                style={{
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
                {item.type === 'image' ? (
                  <img
                    src={absoluteUrl(item)}
                    alt={item.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <video
                    src={absoluteUrl(item)}
                    muted
                    playsInline
                    preload="metadata"
                    onMouseEnter={(e) => e.currentTarget.play().catch(() => {})}
                    onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.name}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                    {item.type} · {formatSize(item.size)}
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
          ))}
        </div>
      )}
    </div>
  );
}
