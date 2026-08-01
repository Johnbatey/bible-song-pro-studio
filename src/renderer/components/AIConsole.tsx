import { useState } from 'react';
import { useAppStore } from '../stores/appStore';
import type { Scene } from '../types';
import { type, fontWeight, iconSize } from '../styles/type';

export function AIConsole({ onClose }: { onClose: () => void }) {
  const scenes = useAppStore((s) => s.scenes);
  const projectScene = useAppStore((s) => s.projectScene);
  const [prompt, setPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const aiActions = [
    {
      id: 'auto-ref',
      label: 'Auto-Detect Bible Reference',
      desc: 'Detect book, chapter, and verse from any text',
      icon: '📖',
      action: () => {
        setIsProcessing(true);
        setTimeout(() => {
          const scene: Scene = {
            id: `ai-${Date.now()}`,
            name: 'AI: John 3:16',
            type: 'bible',
            content: {
              text: 'For God so loved the world...',
              reference: 'John 3:16 (KJV)',
              version: 'KJV',
            },
            background: { type: 'gradient', gradient: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)' },
          };
          projectScene(scene);
          setIsProcessing(false);
        }, 1200);
      },
    },
    {
      id: 'auto-lyrics',
      label: 'Auto-Arrange Lyrics',
      desc: 'Parse and arrange raw lyrics into slide format',
      icon: '🎵',
      action: () => {
        alert('AI will parse pasted lyrics into structured song slides with verse/chorus labels.');
      },
    },
    {
      id: 'gen-sermon',
      label: 'Generate Sermon Notes',
      desc: 'Create sermon note slides from a topic or passage',
      icon: '✍️',
      action: () => {
        setIsProcessing(true);
        setTimeout(() => {
          const scene: Scene = {
            id: `ai-${Date.now()}`,
            name: 'AI: Sermon Outline',
            type: 'presentation',
            content: {
              text: '# Walking in Faith\n\n## Key Points\n1. Faith is confidence in God\n2. Faith requires action\n3. Faith pleases God\n\n— Hebrews 11:1',
              slides: [
                { id: 'a1', text: '# Walking in Faith\n## Hebrews 11:1-6', notes: '' },
                { id: 'a2', text: '## 1. Faith is Confidence\n\n"Faith is the substance of things hoped for, the evidence of things not seen."', notes: '' },
                { id: 'a3', text: '## 2. Faith Requires Action\n\nFaith without works is dead. We must step out.', notes: '' },
              ],
            },
            background: { type: 'gradient', gradient: 'linear-gradient(135deg, #0c0e14, #1a1a2e)' },
          };
          projectScene(scene);
          setIsProcessing(false);
        }, 1500);
      },
    },
    {
      id: 'auto-bg',
      label: 'Smart Background Match',
      desc: 'AI selects the best background for your content',
      icon: '🎨',
      action: () => {
        alert('AI analyzes the mood and theme of your content to select the perfect background gradient, image, or video.');
      },
    },
    {
      id: 'transcribe',
      label: 'Live Transcription',
      desc: 'Real-time AI transcription from Deepgram or local',
      icon: '🎤',
      action: () => {
        const store = useAppStore.getState();
        const enabled = store.aiProviders.find((p) => p.enabled);
        if (enabled) {
          store.setTranscription({ isActive: true, provider: enabled });
        } else {
          alert('Enable an AI provider in Settings first.');
        }
      },
    },
    {
      id: 'summarize',
      label: 'AI Sermon Summary',
      desc: 'Summarize spoken sermon into key points',
      icon: '📝',
      action: () => {
        alert('AI will transcribe and summarize the sermon into key points, scripture references, and call-to-action.');
      },
    },
  ];

  return (
    <div
      className="glass-accent"
      style={{
        position: 'fixed',
        bottom: 60,
        right: 20,
        width: 380,
        maxHeight: '60vh',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid var(--border-accent)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4" />
            <path d="M12 8h.01" />
          </svg>
          <span style={{ ...type.heading }}>AI Console</span>
        </div>
        <button className="btn btn-sm btn-ghost" onClick={onClose}>✕</button>
      </div>

      {/* Prompt input */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-primary)' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            className="input"
            placeholder="Ask AI to do anything..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && alert(`Processing: "${prompt}"`)}
          />
          <button className="btn btn-primary btn-sm" disabled={isProcessing || !prompt.trim()}>
            {isProcessing ? '...' : 'Go'}
          </button>
        </div>
      </div>

      {/* Actions list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
        {isProcessing ? (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <div style={{
              width: 24, height: 24,
              border: '2px solid var(--accent-dim)',
              borderTopColor: 'var(--accent)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 12px',
            }} />
            <div style={{ ...type.secondary, color: 'var(--text-dim)' }}>AI processing...</div>
          </div>
        ) : (
          aiActions.map((item) => (
            <div
              key={item.id}
              className="card card-hover"
              style={{ padding: '10px 12px', cursor: 'pointer', marginBottom: 4 }}
              onClick={item.action}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: iconSize.md }}>{item.icon}</span>
                <div>
                  <div style={{ ...type.secondary, fontWeight: fontWeight.medium }}>{item.label}</div>
                  <div style={{ ...type.caption, color: 'var(--text-dim)', marginTop: 1 }}>{item.desc}</div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
