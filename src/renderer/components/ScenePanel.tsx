import { useAppStore } from '../stores/appStore';
import type { Scene } from '../types';
import { type, fontWeight } from '../styles/type';
import { Block, BlockButton } from './Block';
import { useI18n } from '../../i18n/useI18n';

export function ScenePanel() {
  const { t } = useI18n();
  const scenes = useAppStore((s) => s.scenes);
  const currentScene = useAppStore((s) => s.display.currentScene);
  const setPreviewScene = useAppStore((s) => s.setPreviewScene);
  const cutToScene = useAppStore((s) => s.cutToScene);
  const projectScene = useAppStore((s) => s.projectScene);
  const addScene = useAppStore((s) => s.addScene);
  const isStudio = useAppStore((s) => s.display.mode) === 'studio';
  const removeScene = useAppStore((s) => s.removeScene);

  const handleAddScene = () => {
    const newScene: Scene = {
      id: `scene-${Date.now()}`,
      name: t('scenes.name', { n: scenes.length + 1 }),
      type: 'custom',
      content: { text: t('scenes.newTitle') },
      background: {
        type: 'gradient',
        gradient: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)',
      },
    };
    addScene(newScene);
  };

  return (
    <Block
      title={t('scenes.title')}
      subtitle={`${scenes.length}`}
      tools={(
        <BlockButton onClick={handleAddScene} title={t('scenes.newTitle')}>{t('scenes.new')}</BlockButton>
      )}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {scenes.map((scene) => (
          <div
            key={scene.id}
            className={`card card-hover ${currentScene?.id === scene.id ? 'glass-accent' : ''}`}
            style={{
              cursor: 'pointer',
              borderColor: currentScene?.id === scene.id ? 'var(--border-accent)' : undefined,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div
                style={{ flex: 1 }}
                onClick={() => projectScene(scene)}
                onDoubleClick={() => projectScene(scene, { direct: true })}
                title={isStudio ? t('scenes.clickStudio') : t('scenes.clickLive')}
              >
                <div style={{ ...type.heading, fontWeight: fontWeight.medium }}>{scene.name}</div>
                <div style={{ ...type.caption, color: 'var(--text-dim)', marginTop: 2, textTransform: 'capitalize' }}>
                  {scene.type}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {isStudio && (
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewScene(scene);
                    }}
                  >
                    {t('scenes.preview')}
                  </button>
                )}
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    cutToScene(scene);
                  }}
                >
                  {t('scenes.goLive')}
                </button>
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeScene(scene.id);
                  }}
                  style={{ color: 'var(--red)' }}
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        ))}
        {scenes.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)', ...type.body }}>
            {t('scenes.empty')}
          </div>
        )}
      </div>
    </Block>
  );
}
