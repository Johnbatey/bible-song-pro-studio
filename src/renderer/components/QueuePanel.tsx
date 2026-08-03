import React from 'react';
import { useAppStore } from '../stores/appStore';
import { Block, BlockButton } from './Block';

export function QueuePanel() {
  const queue = useAppStore((s) => s.queue);
  const removeFromQueue = useAppStore((s) => s.removeFromQueue);
  const clearQueue = useAppStore((s) => s.clearQueue);
  const projectScene = useAppStore((s) => s.projectScene);
  const currentScene = useAppStore((s) => s.display.currentScene);
  const previewScene = useAppStore((s) => s.display.previewScene);
  const mode = useAppStore((s) => s.display.mode);

  return (
    <Block
      className="blk-fill"
      title="Queue"
      tools={
        queue.length > 0 ? (
          <BlockButton onClick={clearQueue} title="Clear all queued items">
            ✕ Clear all
          </BlockButton>
        ) : undefined
      }
    >
      {queue.length === 0 ? (
        <div style={{ color: '#a1a1aa', fontSize: 12, padding: '24px 16px', textAlign: 'center' }}>
          Queue is empty. Click the <strong style={{ color: '#FF5500' }}>+</strong> button on any scripture or song to queue it.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '2px 0' }}>
          {queue.map((item) => {
            const isLive = currentScene?.id === item.scene.id;
            const isPreview = previewScene?.id === item.scene.id;
            const isActive = isLive || isPreview;

            return (
              <div
                key={item.id}
                onClick={() => {
                  // In Studio Mode, clicking row sends to Preview first
                  projectScene(item.scene);
                }}
                style={{
                  padding: '10px 14px',
                  background: isLive ? '#3d1403' : isPreview ? '#232221' : '#141416',
                  border: isLive ? '1px solid #FF5500' : '1px solid #262628',
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  userSelect: 'none',
                }}
              >
                {/* Left Meta Group */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 100, flexShrink: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: isLive ? '#FF5500' : '#ffffff' }}>
                    {item.reference}
                  </div>
                  <div style={{ fontSize: 11, color: '#a1a1aa' }}>
                    {item.source || 'Manual'}
                  </div>
                </div>

                {/* Content Snippet */}
                <div
                  style={{
                    flex: 1,
                    fontSize: 13,
                    color: '#ffffff',
                    lineHeight: 1.35,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {item.text}
                </div>

                {/* Right Action Icons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  {/* Play (▶) Button — Direct to Live */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      projectScene(item.scene, { direct: true });
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: isLive ? '#FF5500' : '#ffffff',
                      cursor: 'pointer',
                      padding: 4,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 4,
                      transition: 'transform 0.1s ease',
                    }}
                    title="Send directly to LIVE full-screen output"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                  </button>

                  {/* Delete (✕) Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFromQueue(item.id);
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#a1a1aa',
                      cursor: 'pointer',
                      padding: 4,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 4,
                    }}
                    title="Remove from queue"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Block>
  );
}
