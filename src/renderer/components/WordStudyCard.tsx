import React, { useState, useEffect } from 'react';
import type { WordStudyEntry, Scene } from '../types';
import { useAppStore } from '../stores/appStore';
import { annotateTextWithStrongsSync } from '../services/lexicon-annotator';

interface WordStudyCardProps {
  entry: WordStudyEntry;
  onClose?: () => void;
}

export function WordStudyCard({ entry, onClose }: WordStudyCardProps) {
  const projectScene = useAppStore((s) => s.projectScene);
  const [currentEntry, setCurrentEntry] = useState<WordStudyEntry>(entry);
  const [history, setHistory] = useState<WordStudyEntry[]>([]);

  useEffect(() => {
    setCurrentEntry(entry);
    setHistory([]);
  }, [entry]);

  const handleNavigateStrongs = async (code: string) => {
    const cleanCode = code.trim();
    let nextEntry: WordStudyEntry | null = null;

    if (window.BSP?.lexicon?.lookup) {
      nextEntry = await window.BSP.lexicon.lookup(cleanCode).catch(() => null);
    }

    if (!nextEntry) {
      const match = annotateTextWithStrongsSync(cleanCode)[0];
      if (match?.strongs) {
        nextEntry = match.strongs;
      }
    }

    if (nextEntry) {
      setHistory((prev) => [...prev, currentEntry]);
      setCurrentEntry(nextEntry);
    }
  };

  const handleBack = () => {
    if (history.length === 0) return;
    const prevEntry = history[history.length - 1];
    setHistory((prev) => prev.slice(0, prev.length - 1));
    setCurrentEntry(prevEntry);
  };

  const handleProject = () => {
    const scene: Scene = {
      id: `wordstudy-${Date.now()}`,
      name: `Word Study: ${currentEntry.transliteration}`,
      type: 'bible',
      content: {
        text: `${currentEntry.lemma} (${currentEntry.transliteration} • ${currentEntry.strongs}) — ${currentEntry.gloss}: ${currentEntry.definition}`,
        reference: `Word Study: ${currentEntry.transliteration} (${currentEntry.strongs})`,
        wordStudy: currentEntry,
      },
      transition: { type: 'fade', duration: 0.15 },
    };
    projectScene(scene);
    window.BSP?.display?.sendState?.({
      mode: 'lowerThird',
      outputMode: 'lowerThird',
      lowerThirdText: `${currentEntry.lemma} (${currentEntry.transliteration} • ${currentEntry.strongs})`,
      lowerThirdSub: `${currentEntry.gloss}: ${currentEntry.definition}`,
    });
  };

  const renderFormattedText = (text?: string) => {
    if (!text) return null;
    const parts = text.split(/(\b[GH]\d{1,5}\b)/g);

    return parts.map((part, index) => {
      if (/^[GH]\d{1,5}$/.test(part)) {
        return (
          <button
            key={index}
            onClick={(e) => {
              e.stopPropagation();
              void handleNavigateStrongs(part);
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#FF5500',
              fontWeight: 700,
              cursor: 'pointer',
              textDecoration: 'underline',
              fontSize: 'inherit',
              padding: '0 2px',
              fontFamily: 'inherit',
            }}
            title={`Click to view ${part}`}
          >
            {part}
          </button>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  const etymologyText = currentEntry.etymology || `from Strong's ${currentEntry.strongs}`;
  const kjvUsageText = currentEntry.kjvUsage || `${currentEntry.gloss.toLowerCase()}, ${currentEntry.transliteration.toLowerCase()}`;

  return (
    <div
      style={{
        background: 'rgba(20, 20, 23, 0.98)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: 12,
        padding: '16px 20px',
        boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(16px)',
        color: '#ffffff',
        fontFamily: 'var(--font-ui)',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        margin: '10px 0',
      }}
    >
      {/* Header Bar with Lemma, Transliteration, Strong's ID, and Close */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span
              style={{
                fontSize: 30,
                fontWeight: 700,
                color: '#FF5500',
                fontFamily: currentEntry.language === 'Hebrew' ? 'serif' : 'inherit',
                lineHeight: 1.1,
              }}
            >
              {currentEntry.lemma}
            </span>
            <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-dim)', fontStyle: 'italic' }}>
              / {currentEntry.transliteration.toLowerCase()} /
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 4,
                background: 'rgba(255, 85, 0, 0.15)',
                color: '#FF5500',
                border: '1px solid rgba(255, 85, 0, 0.3)',
              }}
            >
              {currentEntry.strongs} ({currentEntry.language})
            </span>
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#ffffff' }}>
            {currentEntry.gloss}
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: 18,
              padding: 4,
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* SECTION 1: DERIVATION & ETYMOLOGY */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: 'var(--text-dim)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span>🔗</span> DERIVATION & ETYMOLOGY
        </div>
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 8,
            padding: '10px 14px',
            fontSize: 13,
            fontStyle: 'italic',
            color: '#e4e4e7',
          }}
        >
          {renderFormattedText(etymologyText)}
        </div>
      </div>

      {/* SECTION 2: STRONGS DEFINITION */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: 'var(--text-dim)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span>📖</span> STRONGS DEFINITION
        </div>
        <div
          style={{
            fontSize: 13,
            lineHeight: 1.55,
            color: '#f4f4f5',
            fontFamily: 'serif',
            letterSpacing: '0.01em',
          }}
        >
          {renderFormattedText(currentEntry.definition)}
        </div>
      </div>

      {/* SECTION 3: KJV TRANSLATION USAGE */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: '#FF5500',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span>🏷️</span> KJV TRANSLATION USAGE
        </div>
        <div
          style={{
            background: 'rgba(255, 85, 0, 0.05)',
            border: '1px solid rgba(255, 85, 0, 0.18)',
            borderRadius: 8,
            padding: '10px 14px',
            fontSize: 13,
            color: '#e4e4e7',
          }}
        >
          {renderFormattedText(kjvUsageText)}
        </div>
      </div>

      {/* Action Footer */}
      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        {history.length > 0 && (
          <button
            onClick={handleBack}
            style={{
              padding: '6px 12px',
              background: 'rgba(255, 255, 255, 0.1)',
              color: '#ffffff',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            ← Back to {history[history.length - 1].strongs}
          </button>
        )}
        <button
          onClick={handleProject}
          style={{
            padding: '6px 14px',
            background: '#FF5500',
            color: '#ffffff',
            border: 'none',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span>📺</span> Project Word Study
        </button>
      </div>
    </div>
  );
}
