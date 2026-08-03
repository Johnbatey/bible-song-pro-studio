import React, { useState, useEffect } from 'react';
import { useAppStore } from '../stores/appStore';
import { SlideEditorRail } from './SlideEditorRail';
import { SlideEditorCanvas } from './SlideEditorCanvas';
import { SlideEditorInspector } from './SlideEditorInspector';
import type { PresentationDeck, PresentationSlide, SlideElement } from '../types';

export function SlideEditorModal() {
  const isSlideEditorOpen = useAppStore((s) => s.isSlideEditorOpen);
  const closeSlideEditor = useAppStore((s) => s.closeSlideEditor);
  const activePresentationId = useAppStore((s) => s.activePresentationId);
  const presentationDecks = useAppStore((s) => s.presentationDecks);
  const updatePresentationDeck = useAppStore((s) => s.updatePresentationDeck);
  const addPresentationDeck = useAppStore((s) => s.addPresentationDeck);
  const scenes = useAppStore((s) => s.scenes);

  // Active Deck State
  const [deck, setDeck] = useState<PresentationDeck>(() => {
    const existing = presentationDecks.find((d) => d.id === activePresentationId);
    if (existing) return existing;
    return {
      id: activePresentationId || `deck-${Date.now()}`,
      title: 'Untitled Presentation',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      aspectRatio: '16:9',
      slides: [
        {
          id: 'slide-1',
          title: 'Welcome Presentation',
          body: 'Double click text to edit content',
          label: 'Slide 1',
          notes: '',
          transition: 'fade',
          durationMs: 3000,
          hidden: false,
          buildCount: 1,
          buildStep: 1,
          background: { type: 'gradient', value: 'linear-gradient(135deg, #f97316 0%, #7c2d12 100%)' },
          aspectRatio: '16:9',
          elements: [
            {
              id: 'title-1',
              type: 'text',
              x: 120,
              y: 220,
              width: 1680,
              height: 200,
              content: 'Welcome Presentation',
              fontSize: 64,
              fontFamily: 'Inter',
              fontWeight: 700,
              color: '#ffffff',
              textAlign: 'center',
              zIndex: 1,
            },
            {
              id: 'body-1',
              type: 'text',
              x: 160,
              y: 480,
              width: 1600,
              height: 300,
              content: 'Double click text to edit content',
              fontSize: 36,
              fontFamily: 'Inter',
              fontWeight: 500,
              color: 'rgba(255, 255, 255, 0.85)',
              textAlign: 'center',
              zIndex: 2,
            },
          ],
        },
      ],
    };
  });

  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(0); // 0 = Auto Fit

  // Sync state when modal opens for a specific presentation deck ID
  useEffect(() => {
    if (!isSlideEditorOpen) return;
    const existing = presentationDecks.find((d) => d.id === activePresentationId);
    if (existing && existing.slides.length > 0) {
      setDeck(existing);
    } else {
      // Find scene if presentation scene exists
      const scene = scenes.find((sc) => sc.id === activePresentationId);
      const title = scene?.name || 'Untitled Presentation';
      const slides = scene?.content?.slides || [];
      if (slides.length > 0) {
        setDeck({
          id: activePresentationId || `deck-${Date.now()}`,
          title,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          aspectRatio: '16:9',
          slides: slides.map((s, idx) => ({
            id: s.id || `slide-${idx + 1}`,
            title: s.title || `Slide ${idx + 1}`,
            body: s.text || '',
            label: s.label || `Slide ${idx + 1}`,
            notes: s.notes || '',
            transition: 'fade',
            durationMs: 3000,
            hidden: false,
            buildCount: 1,
            buildStep: 1,
            background: { type: 'color', value: '#18181b' },
            aspectRatio: '16:9',
          })),
        });
      }
    }
  }, [isSlideEditorOpen, activePresentationId, presentationDecks, scenes]);

  if (!isSlideEditorOpen) return null;

  const slides = deck.slides.length > 0 ? deck.slides : [
    {
      id: 'slide-default',
      title: 'Untitled Slide',
      body: 'Double click to edit',
      label: 'Slide 1',
      notes: '',
      transition: 'fade' as const,
      durationMs: 3000,
      hidden: false,
      buildCount: 1,
      buildStep: 1,
      background: { type: 'color' as const, value: '#18181b' },
      aspectRatio: '16:9' as const,
    },
  ];

  const activeSlide = slides[activeSlideIndex] || slides[0];
  const selectedElement = activeSlide.elements?.find((el) => el.id === selectedElementId) || null;

  // Slide CRUD Actions
  function handleAddSlide() {
    const newSlide: PresentationSlide = {
      id: `slide-${Date.now()}`,
      title: 'New Slide',
      body: 'Double click to edit body',
      label: `Slide ${slides.length + 1}`,
      notes: '',
      transition: 'fade',
      durationMs: 3000,
      hidden: false,
      buildCount: 1,
      buildStep: 1,
      background: { type: 'color', value: '#18181b' },
      aspectRatio: deck.aspectRatio || '16:9',
      elements: [
        {
          id: `title-${Date.now()}`,
          type: 'text',
          x: 120,
          y: 220,
          width: 1680,
          height: 200,
          content: 'New Slide Title',
          fontSize: 64,
          fontFamily: 'Inter',
          fontWeight: 700,
          color: '#ffffff',
          textAlign: 'center',
          zIndex: 1,
        },
      ],
    };

    const nextSlides = [...slides, newSlide];
    setDeck((prev) => ({ ...prev, slides: nextSlides }));
    setActiveSlideIndex(nextSlides.length - 1);
  }

  function handleDuplicateSlide(index: number) {
    const target = slides[index];
    if (!target) return;
    const duplicated: PresentationSlide = {
      ...target,
      id: `slide-${Date.now()}`,
      title: `${target.title} (Copy)`,
      elements: target.elements?.map((el) => ({ ...el, id: `${el.id}-copy-${Date.now()}` })),
    };
    const nextSlides = [...slides];
    nextSlides.splice(index + 1, 0, duplicated);
    setDeck((prev) => ({ ...prev, slides: nextSlides }));
    setActiveSlideIndex(index + 1);
  }

  function handleDeleteSlide(index: number) {
    if (slides.length <= 1) return;
    const nextSlides = slides.filter((_, i) => i !== index);
    setDeck((prev) => ({ ...prev, slides: nextSlides }));
    setActiveSlideIndex(Math.min(index, nextSlides.length - 1));
  }

  function handleMoveSlide(fromIndex: number, toIndex: number) {
    if (toIndex < 0 || toIndex >= slides.length) return;
    const nextSlides = [...slides];
    const [moved] = nextSlides.splice(fromIndex, 1);
    nextSlides.splice(toIndex, 0, moved);
    setDeck((prev) => ({ ...prev, slides: nextSlides }));
    setActiveSlideIndex(toIndex);
  }

  // Element Actions
  function handleAddTextElement() {
    const newElement: SlideElement = {
      id: `text-${Date.now()}`,
      type: 'text',
      x: 480,
      y: 400,
      width: 960,
      height: 180,
      content: 'New Text Box',
      fontSize: 48,
      fontFamily: 'Inter',
      fontWeight: 600,
      color: '#ffffff',
      textAlign: 'center',
      zIndex: (activeSlide.elements?.length || 0) + 1,
    };
    const updatedElements = [...(activeSlide.elements || []), newElement];
    handleUpdateSlide({ elements: updatedElements });
    setSelectedElementId(newElement.id);
  }

  function handleAddShapeElement() {
    const newElement: SlideElement = {
      id: `shape-${Date.now()}`,
      type: 'shape',
      x: 660,
      y: 360,
      width: 600,
      height: 360,
      content: 'rectangle',
      backgroundColor: 'rgba(255, 85, 0, 0.25)',
      borderColor: '#FF5500',
      borderWidth: 3,
      borderRadius: 12,
      zIndex: (activeSlide.elements?.length || 0) + 1,
    };
    const updatedElements = [...(activeSlide.elements || []), newElement];
    handleUpdateSlide({ elements: updatedElements });
    setSelectedElementId(newElement.id);
  }

  function handleUpdateSlide(updates: Partial<PresentationSlide>) {
    const updatedSlides = slides.map((s, idx) => (idx === activeSlideIndex ? { ...s, ...updates } : s));
    setDeck((prev) => ({ ...prev, slides: updatedSlides }));
  }

  function handleUpdateElement(elementId: string, updates: Partial<SlideElement>) {
    const currentElements = activeSlide.elements || [];
    const updatedElements = currentElements.map((el) => (el.id === elementId ? { ...el, ...updates } : el));
    handleUpdateSlide({ elements: updatedElements });
  }

  function handleDeleteElement(elementId: string) {
    const currentElements = activeSlide.elements || [];
    const updatedElements = currentElements.filter((el) => el.id !== elementId);
    handleUpdateSlide({ elements: updatedElements });
    setSelectedElementId(null);
  }

  function handleSave() {
    addPresentationDeck(deck);
    closeSlideEditor();
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#0d0d0f',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'var(--font-ui)',
        color: '#ffffff',
      }}
    >
      {/* Top Header Toolbar */}
      <header
        style={{
          height: 48,
          background: '#161414',
          borderBottom: '1px solid #262628',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          flexShrink: 0,
        }}
      >
        {/* Left: Deck Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <input
            type="text"
            value={deck.title}
            onChange={(e) => setDeck((prev) => ({ ...prev, title: e.target.value }))}
            style={{
              background: '#232221',
              border: '1px solid #262628',
              borderRadius: 6,
              color: '#ffffff',
              fontWeight: 700,
              fontSize: 13,
              padding: '4px 10px',
              outline: 'none',
              width: 220,
            }}
          />
        </div>

        {/* Center: Toolbar Tools (Add Text, Add Shape, Zoom) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            onClick={handleAddTextElement}
            style={{
              padding: '5px 12px',
              background: '#232221',
              border: '1px solid #262628',
              borderRadius: 6,
              color: '#ffffff',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            + Text Box
          </button>
          <button
            type="button"
            onClick={handleAddShapeElement}
            style={{
              padding: '5px 12px',
              background: '#232221',
              border: '1px solid #262628',
              borderRadius: 6,
              color: '#ffffff',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            + Shape
          </button>

          <div style={{ width: 1, height: 20, background: '#262628' }} />

          {/* Zoom Switcher */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 11, color: '#a1a1aa' }}>Zoom:</span>
            <select
              value={zoomLevel}
              onChange={(e) => setZoomLevel(parseInt(e.target.value, 10))}
              style={{
                background: '#232221',
                border: '1px solid #262628',
                borderRadius: 6,
                color: '#ffffff',
                padding: '4px 8px',
                fontSize: 11,
                outline: 'none',
              }}
            >
              <option value={0}>Auto Fit</option>
              <option value={50}>50%</option>
              <option value={75}>75%</option>
              <option value={100}>100%</option>
              <option value={150}>150%</option>
            </select>
          </div>
        </div>

        {/* Right Actions: Save & Close */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            onClick={handleSave}
            style={{
              padding: '6px 16px',
              background: '#FF5500',
              border: 'none',
              borderRadius: 6,
              color: '#ffffff',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Save Presentation
          </button>
          <button
            type="button"
            onClick={closeSlideEditor}
            style={{
              padding: '6px 12px',
              background: '#232221',
              border: '1px solid #262628',
              borderRadius: 6,
              color: '#a1a1aa',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            ✕ Close
          </button>
        </div>
      </header>

      {/* Main 3-Column Studio Workspace */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
        {/* Left Column: Slide Rail */}
        <SlideEditorRail
          slides={slides}
          activeSlideIndex={activeSlideIndex}
          onSelectSlide={(idx) => {
            setActiveSlideIndex(idx);
            setSelectedElementId(null);
          }}
          onAddSlide={handleAddSlide}
          onDuplicateSlide={handleDuplicateSlide}
          onDeleteSlide={handleDeleteSlide}
          onMoveSlide={handleMoveSlide}
        />

        {/* Center Column: Interactive Scaling Canvas */}
        <SlideEditorCanvas
          slide={activeSlide}
          zoomLevel={zoomLevel}
          selectedElementId={selectedElementId}
          onSelectElement={setSelectedElementId}
          onUpdateElement={handleUpdateElement}
          onUpdateSlideText={(title, body) => handleUpdateSlide({ title, body })}
        />

        {/* Right Column: Property Inspector */}
        <SlideEditorInspector
          slide={activeSlide}
          selectedElement={selectedElement}
          onUpdateSlide={handleUpdateSlide}
          onUpdateElement={handleUpdateElement}
          onDeleteElement={handleDeleteElement}
        />
      </div>
    </div>
  );
}
