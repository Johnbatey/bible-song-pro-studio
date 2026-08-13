/* =========================================================================
   MediaGrid — pick one clip or still out of the imported library
   -------------------------------------------------------------------------
   Shared by the theme editor and the Songs panel. Thumbnails rather than a
   dropdown of file names, because an operator recognises the mountain loop on
   sight and has no idea which of them is `sunrise-final-v2.mp4`.
   ========================================================================= */
import type { MediaItem } from '../types';
import { useMediaLibrary } from '../hooks/useMediaLibrary';
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

  if (matching.length === 0) {
    return (
      <div style={{ ...type.caption, color: 'var(--text-dim)', padding: '10px 2px' }}>
        No {kind === 'video' ? 'videos' : 'images'} in the library yet. Import them in the
        Media panel and they will appear here.
      </div>
    );
  }

  return (
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
  );
}
