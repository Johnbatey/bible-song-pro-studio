import React, { useEffect, useRef } from 'react';
import { useAppStore } from '../stores/appStore';
import { Block, BlockButton } from './Block';
import { useI18n } from '../../i18n/useI18n';

export function QueuePanel() {
  const { t } = useI18n();
  const queue = useAppStore((s) => s.queue);
  const removeFromQueue = useAppStore((s) => s.removeFromQueue);
  const clearQueue = useAppStore((s) => s.clearQueue);
  const projectScene = useAppStore((s) => s.projectScene);
  const clearProgram = useAppStore((s) => s.clearProgram);
  const currentScene = useAppStore((s) => s.display.currentScene);
  const previewScene = useAppStore((s) => s.display.previewScene);

  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  /** Live wins over staged, matching how the rows colour themselves. */
  const activeSceneId = queue.some((q) => q.scene.id === currentScene?.id)
    ? currentScene?.id
    : previewScene?.id;

  /* A long queue scrolls the running item out of sight as it advances. */
  useEffect(() => {
    if (!activeSceneId) return;
    rowRefs.current[activeSceneId]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [activeSceneId, queue.length]);

  const emptyParts = t('queue.empty').split('{plus}');

  return (
    <Block
      className="blk-fill"
      title={t('queue.title')}
      tools={
        queue.length > 0 ? (
          <BlockButton onClick={clearQueue} title={t('queue.clear')}>
            {t('queue.clearAll')}
          </BlockButton>
        ) : undefined
      }
    >
      {queue.length === 0 ? (
        <div style={{ color: 'var(--text-dim)', fontSize: 12, padding: '24px 16px', textAlign: 'center' }}>
          {emptyParts[0]}
          <strong style={{ color: '#FF5500' }}>+</strong>
          {emptyParts[1] || ''}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '2px 0' }}>
          {queue.map((item) => {
            const isLive = currentScene?.id === item.scene.id;
            const isPreview = previewScene?.id === item.scene.id;

            return (
              <div
                key={item.id}
                ref={(el) => { rowRefs.current[item.scene.id] = el; }}
                onClick={() => {
                  if (isLive) {
                    clearProgram();
                    return;
                  }
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
                  <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                    {item.source || t('queue.manual')}
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
                  {/* Play → LIVE / Pause → take down */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isLive) clearProgram();
                      else projectScene(item.scene, { direct: true });
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
                    title={isLive ? t('queue.takeDown') : t('queue.sendLive')}
                  >
                    {isLive ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                        <rect x="6" y="4" width="4" height="16" rx="1" />
                        <rect x="14" y="4" width="4" height="16" rx="1" />
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                    )}
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
                      color: 'var(--text-dim)',
                      cursor: 'pointer',
                      padding: 4,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 4,
                    }}
                    title={t('queue.remove')}
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
