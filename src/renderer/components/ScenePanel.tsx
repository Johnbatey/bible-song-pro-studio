import { useAppStore } from '../stores/appStore';
import type { Scene } from '../types';

export function ScenePanel() {
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
      name: `Scene ${scenes.length + 1}`,
      type: 'custom',
      content: { text: 'New Scene' },
      background: {
        type: 'gradient',
        gradient: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)',
      },
    };
    addScene(newScene);
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600 }}>Scenes</h2>
        <button className="btn btn-primary btn-sm" onClick={handleAddScene}>
          + New Scene
        </button>
      </div>
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
                title={isStudio
                  ? 'Click to stage in Preview · double-click to go straight to Program'
                  : 'Click to go live'}
              >
                <div style={{ fontSize: 13, fontWeight: 500 }}>{scene.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2, textTransform: 'capitalize' }}>
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
                    Preview
                  </button>
                )}
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    cutToScene(scene);
                  }}
                >
                  Go Live
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
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)', fontSize: 13 }}>
            No scenes yet. Create your first scene to get started.
          </div>
        )}
      </div>
    </div>
  );
}
