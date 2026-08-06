import React from 'react';

interface SlideEditorHeaderProps {
  title: string;
  onUpdateTitle: (title: string) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onImportFile: (file: File) => void;
  onBackToDeck: () => void;
  onSaveToDeck: () => void;
  onSaveExport: () => void;
}

export function SlideEditorHeader({
  title,
  onUpdateTitle,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onImportFile,
  onBackToDeck,
  onSaveToDeck,
  onSaveExport,
}: SlideEditorHeaderProps) {
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px',
        borderBottom: '1px solid var(--block-line, #262628)',
        background: 'var(--bg-surface, #161414)',
        backdropFilter: 'saturate(180%) blur(20px)',
        userSelect: 'none',
        height: 52,
        boxSizing: 'border-box',
      }}
    >
      {/* Left: Wordmark & Undo/Redo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <h1
          style={{
            margin: 0,
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: '-0.01em',
            color: '#f3f5f8',
            fontFamily: 'var(--font-ui)',
          }}
        >
          BSP Editor
        </h1>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            type="button"
            disabled={!canUndo}
            onClick={onUndo}
            style={{
              width: 32,
              height: 32,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 6,
              color: canUndo ? '#ffffff' : 'rgba(255, 255, 255, 0.3)',
              cursor: canUndo ? 'pointer' : 'not-allowed',
            }}
            title="Undo (⌘/Ctrl+Z)"
          >
            <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
              <path d="M9 14 4 9l5-5" />
              <path d="M4 9h11a6 6 0 0 1 0 12h-3" />
            </svg>
          </button>

          <button
            type="button"
            disabled={!canRedo}
            onClick={onRedo}
            style={{
              width: 32,
              height: 32,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 6,
              color: canRedo ? '#ffffff' : 'rgba(255, 255, 255, 0.3)',
              cursor: canRedo ? 'pointer' : 'not-allowed',
            }}
            title="Redo (⌘/Ctrl+Shift+Z)"
          >
            <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
              <path d="m15 14 5-5-5-5" />
              <path d="M20 9H9a6 6 0 0 0 0 12h3" />
            </svg>
          </button>
        </div>

        {/* Deck Title Field */}
        <input
          type="text"
          value={title}
          onChange={(e) => onUpdateTitle(e.target.value)}
          placeholder="Untitled Deck"
          style={{
            background: 'rgba(0, 0, 0, 0.25)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: 6,
            color: '#ffffff',
            padding: '5px 10px',
            fontSize: 13,
            fontWeight: 600,
            outline: 'none',
            width: 200,
          }}
        />
      </div>

      {/* Right: Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <input
          type="file"
          id="slide-import-file-input"
          accept=".pptx,.pdf,.json,.txt,.md,image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              onImportFile(file);
              e.target.value = '';
            }
          }}
        />

        <button
          type="button"
          onClick={() => document.getElementById('slide-import-file-input')?.click()}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: 8,
            color: '#f3f5f8',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
          title="Import PPTX, PDF, JSON, TXT, MD or Images"
        >
          <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
            <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" />
          </svg>
          Import Presentation
        </button>

        <button
          type="button"
          onClick={onBackToDeck}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: 8,
            color: '#f3f5f8',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
          title="Return to the deck without saving"
        >
          <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to Deck
        </button>

        <button
          type="button"
          onClick={onSaveToDeck}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            background: '#2f80ed',
            border: 'none',
            borderRadius: 8,
            color: '#ffffff',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
          title="Save the deck and return to the library"
        >
          <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <path d="M17 21v-8H7v8M7 3v5h8" />
          </svg>
          Save to Deck
        </button>

        <button
          type="button"
          onClick={onSaveExport}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            background: '#30d158',
            border: 'none',
            borderRadius: 8,
            color: '#000000',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
          }}
          title="Save and export presentation file"
        >
          <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, fill: 'none', stroke: 'currentColor', strokeWidth: 2.2 }}>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <path d="m7 10 5 5 5-5" />
            <path d="M12 15V3" />
          </svg>
          Save / Export
        </button>
      </div>
    </header>
  );
}
