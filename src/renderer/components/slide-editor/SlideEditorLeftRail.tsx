import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { PresentationSlide } from '../../types';
import { NativeSlideBoard, slideElementsFor } from '../NativeSlideBoard';
import {
  getCustomTemplates,
  saveCustomTemplate,
  updateCustomTemplateFromSlide,
  renameCustomTemplate,
  deleteCustomTemplate,
  exportCustomTemplate,
  importCustomTemplateFile,
  subscribeCustomTemplates,
  type CustomSlideTemplate,
} from '../../services/customTemplateStore';

interface SlideEditorLeftRailProps {
  slides: PresentationSlide[];
  activeSlideIndex: number;
  onSelectSlide: (index: number) => void;
  onAddSlide: () => void;
  onDuplicateSlide: (index: number) => void;
  onDeleteSlide: (index: number) => void;
  onMoveSlide: (fromIndex: number, toIndex: number) => void;
  onApplyTemplate: (templateType: string) => void;
  renderThumb?: (index: number, width: number) => React.ReactNode;
  readOnlyDeck?: boolean;
}

function RailSlideThumb({
  index,
  renderThumb,
}: {
  index: number;
  renderThumb: (index: number, width: number) => React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number>(180);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const measured = entries[0]?.contentRect?.width;
      if (measured && measured > 0) {
        setWidth(Math.round(measured));
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} style={{ width: '100%', overflow: 'hidden', background: '#000', display: 'flex' }}>
      {renderThumb(index, width)}
    </div>
  );
}

function CustomTemplateThumb({ template }: { template: CustomSlideTemplate }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number>(210);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const measured = entries[0]?.contentRect?.width;
      if (measured && measured > 0) {
        setWidth(Math.round(measured));
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} style={{ width: '100%', overflow: 'hidden', background: '#000', display: 'flex' }}>
      <NativeSlideBoard
        elements={template.elements || []}
        background={template.background}
        width={width}
      />
    </div>
  );
}

const PREBUILT_TEMPLATES = [
  { id: 'worship', name: 'Worship Song Classic' },
  { id: 'sermon', name: 'Sermon Key Points' },
  { id: 'scripture', name: 'Scripture Verse Display' },
  { id: 'lower-third', name: 'Lower Third Overlay Bar' },
  { id: 'announcement', name: 'Event Announcement' },
  { id: 'welcome', name: 'Welcome & Fellowship' },
  { id: 'offering', name: 'Offering & Tithing' },
  { id: 'benediction', name: 'Benediction & Closing' },
];

function getPrebuiltTemplateObj(id: string, name: string): CustomSlideTemplate {
  const now = Date.now();
  switch (id) {
    case 'worship':
      return {
        id: 'tpl-worship',
        name: 'Worship Song Classic',
        createdAt: now,
        updatedAt: now,
        background: { type: 'gradient', value: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #311042 100%)' },
        elements: [
          {
            id: 'el-worship-title',
            type: 'text',
            content: 'AMAZING GRACE, HOW SWEET THE SOUND',
            x: 10,
            y: 28,
            width: 80,
            height: 25,
            fontSize: 48,
            color: '#ffffff',
            fontWeight: 700,
            textAlign: 'center',
          },
          {
            id: 'el-worship-sub',
            type: 'text',
            content: 'That saved a wretch like me! I once was lost, but now am found',
            x: 10,
            y: 56,
            width: 80,
            height: 20,
            fontSize: 28,
            color: 'rgba(255, 255, 255, 0.8)',
            textAlign: 'center',
          },
        ],
      };
    case 'sermon':
      return {
        id: 'tpl-sermon',
        name: 'Sermon Key Points',
        createdAt: now,
        updatedAt: now,
        background: { type: 'gradient', value: 'linear-gradient(135deg, #18181b 0%, #09090b 100%)' },
        elements: [
          {
            id: 'el-sermon-card',
            type: 'shape',
            content: 'box',
            x: 8,
            y: 12,
            width: 84,
            height: 76,
            backgroundColor: 'rgba(35, 34, 33, 0.7)',
            borderColor: 'rgba(255, 85, 0, 0.3)',
            borderWidth: 1,
            borderRadius: 6,
          },
          {
            id: 'el-sermon-badge',
            type: 'shape',
            content: 'box',
            x: 12,
            y: 18,
            width: 6,
            height: 10,
            backgroundColor: '#FF5500',
            borderRadius: 6,
          },
          {
            id: 'el-sermon-num',
            type: 'text',
            content: '01',
            x: 12,
            y: 19,
            width: 6,
            height: 8,
            fontSize: 24,
            color: '#ffffff',
            fontWeight: 700,
            textAlign: 'center',
          },
          {
            id: 'el-sermon-title',
            type: 'text',
            content: 'FAITH OVER FEAR: WALKING IN PURPOSE',
            x: 20,
            y: 18,
            width: 68,
            height: 12,
            fontSize: 34,
            color: '#ffffff',
            fontWeight: 700,
          },
          {
            id: 'el-sermon-body',
            type: 'text',
            content: '• Trusting God in times of uncertainty\n• Stepping out of your comfort zone\n• Building a foundation rooted in Prayer',
            x: 20,
            y: 34,
            width: 68,
            height: 48,
            fontSize: 26,
            color: 'rgba(255, 255, 255, 0.75)',
          },
        ],
      };
    case 'scripture':
      return {
        id: 'tpl-scripture',
        name: 'Scripture Verse Display',
        createdAt: now,
        updatedAt: now,
        background: { type: 'gradient', value: 'linear-gradient(135deg, #0b132b 0%, #1c2541 100%)' },
        elements: [
          {
            id: 'el-scripture-verse',
            type: 'text',
            content: '"For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life."',
            x: 10,
            y: 25,
            width: 80,
            height: 40,
            fontSize: 36,
            color: '#ffffff',
            fontWeight: 700,
            textAlign: 'center',
          },
          {
            id: 'el-scripture-ref',
            type: 'text',
            content: 'JOHN 3:16 (KJV)',
            x: 25,
            y: 70,
            width: 50,
            height: 12,
            fontSize: 26,
            color: '#FF5500',
            fontWeight: 700,
            textAlign: 'center',
          },
        ],
      };
    case 'lower-third':
      return {
        id: 'tpl-lower-third',
        name: 'Lower Third Overlay Bar',
        createdAt: now,
        updatedAt: now,
        background: { type: 'color', value: 'transparent' },
        elements: [
          {
            id: 'el-lowerthird-bg',
            type: 'shape',
            content: 'box',
            x: 6,
            y: 70,
            width: 88,
            height: 22,
            backgroundColor: 'rgba(22, 20, 20, 0.92)',
            borderColor: '#FF5500',
            borderWidth: 2,
            borderRadius: 6,
          },
          {
            id: 'el-lowerthird-name',
            type: 'text',
            content: 'PASTOR DAVID E. JOHNSON',
            x: 10,
            y: 73,
            width: 80,
            height: 10,
            fontSize: 32,
            color: '#ffffff',
            fontWeight: 700,
          },
          {
            id: 'el-lowerthird-role',
            type: 'text',
            content: 'Senior Pastor · Grace Community Church',
            x: 10,
            y: 82,
            width: 80,
            height: 8,
            fontSize: 20,
            color: '#FF5500',
            fontWeight: 700,
          },
        ],
      };
    case 'announcement':
      return {
        id: 'tpl-announcement',
        name: 'Event Announcement',
        createdAt: now,
        updatedAt: now,
        background: { type: 'gradient', value: 'linear-gradient(135deg, #4c1d95 0%, #831843 100%)' },
        elements: [
          {
            id: 'el-announcement-badge',
            type: 'shape',
            content: 'box',
            x: 35,
            y: 15,
            width: 30,
            height: 8,
            backgroundColor: '#FF5500',
            borderRadius: 6,
          },
          {
            id: 'el-announcement-badgetxt',
            type: 'text',
            content: 'UPCOMING EVENT',
            x: 35,
            y: 16,
            width: 30,
            height: 6,
            fontSize: 16,
            color: '#ffffff',
            fontWeight: 700,
            textAlign: 'center',
          },
          {
            id: 'el-announcement-title',
            type: 'text',
            content: 'SUNDAY NIGHT WORSHIP & HEALING',
            x: 10,
            y: 28,
            width: 80,
            height: 25,
            fontSize: 44,
            color: '#ffffff',
            fontWeight: 700,
            textAlign: 'center',
          },
          {
            id: 'el-announcement-details',
            type: 'text',
            content: 'THIS SUNDAY · 6:00 PM · MAIN SANCTUARY\nJoin us for a powerful evening of praise, prayer and communion.',
            x: 10,
            y: 56,
            width: 80,
            height: 25,
            fontSize: 24,
            color: 'rgba(255, 255, 255, 0.85)',
            textAlign: 'center',
          },
        ],
      };
    case 'welcome':
      return {
        id: 'tpl-welcome',
        name: 'Welcome & Fellowship',
        createdAt: now,
        updatedAt: now,
        background: { type: 'gradient', value: 'linear-gradient(135deg, #1c1917 0%, #292524 100%)' },
        elements: [
          {
            id: 'el-welcome-title',
            type: 'text',
            content: 'WELCOME TO OUR CHURCH',
            x: 10,
            y: 30,
            width: 80,
            height: 25,
            fontSize: 52,
            color: '#ffffff',
            fontWeight: 700,
            textAlign: 'center',
          },
          {
            id: 'el-welcome-sub',
            type: 'text',
            content: 'We are so glad you are worshipping with us today!',
            x: 10,
            y: 58,
            width: 80,
            height: 18,
            fontSize: 28,
            color: '#FF5500',
            fontWeight: 700,
            textAlign: 'center',
          },
        ],
      };
    case 'offering':
      return {
        id: 'tpl-offering',
        name: 'Offering & Tithing',
        createdAt: now,
        updatedAt: now,
        background: { type: 'gradient', value: 'linear-gradient(135deg, #064e3b 0%, #022c22 100%)' },
        elements: [
          {
            id: 'el-offering-title',
            type: 'text',
            content: 'TITHE & OFFERING',
            x: 10,
            y: 20,
            width: 80,
            height: 20,
            fontSize: 48,
            color: '#ffffff',
            fontWeight: 700,
            textAlign: 'center',
          },
          {
            id: 'el-offering-verse',
            type: 'text',
            content: '"Honor the LORD with your wealth and with the firstfruits of all your produce." — Proverbs 3:9',
            x: 10,
            y: 42,
            width: 80,
            height: 18,
            fontSize: 22,
            color: 'rgba(255, 255, 255, 0.8)',
            textAlign: 'center',
          },
          {
            id: 'el-offering-ways',
            type: 'text',
            content: 'GIVE ONLINE: www.church.org/give  |  TEXT TO GIVE: (800) 555-GIVE',
            x: 10,
            y: 64,
            width: 80,
            height: 15,
            fontSize: 24,
            color: '#6ee7b7',
            fontWeight: 700,
            textAlign: 'center',
          },
        ],
      };
    case 'benediction':
      return {
        id: 'tpl-benediction',
        name: 'Benediction & Closing',
        createdAt: now,
        updatedAt: now,
        background: { type: 'gradient', value: 'linear-gradient(135deg, #450a0a 0%, #1c0505 100%)' },
        elements: [
          {
            id: 'el-benediction-title',
            type: 'text',
            content: 'GO IN PEACE & GRACE',
            x: 10,
            y: 30,
            width: 80,
            height: 25,
            fontSize: 48,
            color: '#ffffff',
            fontWeight: 700,
            textAlign: 'center',
          },
          {
            id: 'el-benediction-sub',
            type: 'text',
            content: 'The LORD bless you and keep you; the LORD make his face shine upon you.',
            x: 10,
            y: 58,
            width: 80,
            height: 20,
            fontSize: 26,
            color: '#FF5500',
            fontWeight: 700,
            textAlign: 'center',
          },
        ],
      };
    default:
      return {
        id: `tpl-${id}`,
        name: name || id.toUpperCase(),
        createdAt: now,
        updatedAt: now,
        background: { type: 'color', value: '#18181b' },
        elements: [
          {
            id: `el-${id}-title`,
            type: 'text',
            content: name || id.toUpperCase(),
            x: 10,
            y: 35,
            width: 80,
            height: 25,
            fontSize: 48,
            color: '#ffffff',
            fontWeight: 700,
            textAlign: 'center',
          },
        ],
      };
  }
}

export function SlideEditorLeftRail({
  slides,
  activeSlideIndex,
  onSelectSlide,
  onAddSlide,
  onDuplicateSlide,
  onDeleteSlide,
  onMoveSlide,
  onApplyTemplate,
  renderThumb,
  readOnlyDeck = false,
}: SlideEditorLeftRailProps) {
  const [activeTab, setActiveTab] = useState<'slides' | 'templates'>('slides');
  const [customTemplates, setCustomTemplates] = useState<CustomSlideTemplate[]>(getCustomTemplates());

  // Context Menu & Modal States
  const [slideContextMenu, setSlideContextMenu] = useState<{ x: number; y: number; slideIndex: number } | null>(null);
  const [templateContextMenu, setTemplateContextMenu] = useState<{ x: number; y: number; template: CustomSlideTemplate; isPrebuilt?: boolean } | null>(null);
  const [saveModal, setSaveModal] = useState<{ slideIndex: number } | null>(null);
  const [renameModal, setRenameModal] = useState<{ templateId: string; currentName: string } | null>(null);
  const [templateNameInput, setTemplateNameInput] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Subscribe to store updates
  useEffect(() => {
    setCustomTemplates(getCustomTemplates());
    const unsubscribe = subscribeCustomTemplates(() => {
      setCustomTemplates(getCustomTemplates());
    });
    return () => unsubscribe();
  }, []);

  // Dismiss context menus on global click
  useEffect(() => {
    const handleGlobalClick = () => {
      setSlideContextMenu(null);
      setTemplateContextMenu(null);
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  const handleOpenSaveModal = (slideIndex: number) => {
    const targetSlide = slides[slideIndex];
    setTemplateNameInput(targetSlide?.title || `Custom Template ${customTemplates.length + 1}`);
    setSaveModal({ slideIndex });
    setSlideContextMenu(null);
  };

  const handleSaveModalSubmit = () => {
    if (!saveModal) return;
    const slide = slides[saveModal.slideIndex];
    if (slide) {
      saveCustomTemplate(templateNameInput || 'Custom Template', slide);
    }
    setSaveModal(null);
    setTemplateNameInput('');
    setActiveTab('templates');
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await importCustomTemplateFile(file);
      setActiveTab('templates');
    } catch (err: any) {
      alert(`Failed to import template: ${err?.message || 'Invalid format'}`);
    }
    if (e.target) e.target.value = '';
  };

  const handleExportAllTemplates = () => {
    if (customTemplates.length > 0) {
      customTemplates.forEach((t) => exportCustomTemplate(t));
    } else {
      // Export prebuilt templates if no custom templates yet
      PREBUILT_TEMPLATES.forEach((pt) => {
        exportCustomTemplate(getPrebuiltTemplateObj(pt.id, pt.name));
      });
    }
  };

  const handleRenameSubmit = () => {
    if (!renameModal) return;
    renameCustomTemplate(renameModal.templateId, templateNameInput);
    setRenameModal(null);
    setTemplateNameInput('');
  };

  return (
    <aside
      style={{
        width: 240,
        minWidth: 240,
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border-primary)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        userSelect: 'none',
        boxSizing: 'border-box',
        position: 'relative',
      }}
    >
      {/* Hidden File Input for Importing Templates */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".bsptemplate,.json"
        onChange={handleFileImport}
        style={{ display: 'none' }}
      />

      {/* Rail Nav Segmented Switcher */}
      <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-primary)' }}>
        <div
          style={{
            display: 'flex',
            background: 'var(--chrome-control)',
            border: '1px solid var(--border-primary)',
            padding: 3,
            borderRadius: 6,
            gap: 2,
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('slides')}
            style={{
              flex: 1,
              padding: '6px 8px',
              background: activeTab === 'slides' ? '#FF5500' : 'transparent',
              border: 'none',
              borderRadius: 6,
              color: activeTab === 'slides' ? '#ffffff' : 'var(--text-secondary)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
              <rect x="3" y="4" width="18" height="13" rx="2" />
              <path d="M7 21h10M12 17v4" />
            </svg>
            Slides
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('templates')}
            style={{
              flex: 1,
              padding: '6px 8px',
              background: activeTab === 'templates' ? '#FF5500' : 'transparent',
              border: 'none',
              borderRadius: 6,
              color: activeTab === 'templates' ? '#ffffff' : 'var(--text-secondary)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
              <path d="M4 5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5z" />
              <path d="M4 11a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8z" />
              <path d="M14 11a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-4z" />
            </svg>
            Templates
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      {activeTab === 'slides' ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          {/* Action Toolbar */}
          <div
            style={{
              padding: '10px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid var(--border-primary)',
              background: 'var(--bg-primary)',
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Slide Deck ({slides.length})
            </span>
            {!readOnlyDeck && (
              <button
                type="button"
                onClick={onAddSlide}
                style={{
                  background: 'var(--accent, #FF5500)',
                  border: 'none',
                  borderRadius: 4,
                  color: '#ffffff',
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '4px 8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
                title="Add New Slide"
              >
                <span>+</span> New
              </button>
            )}
          </div>

          {/* Slides Thumbnail List */}
          <div style={{ flex: 1, padding: 12, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
            {slides.map((slide, index) => {
              const isActive = index === activeSlideIndex;
              return (
                <div
                  key={slide.id || index}
                  onClick={() => onSelectSlide(index)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setSlideContextMenu({ x: e.clientX, y: e.clientY, slideIndex: index });
                  }}
                  style={{
                    position: 'relative',
                    cursor: 'pointer',
                    borderRadius: 6,
                    border: isActive ? '2px solid var(--accent, #FF5500)' : '1px solid var(--border-primary)',
                    background: '#09090b',
                    boxShadow: isActive ? '0 0 12px rgba(255, 85, 0, 0.35)' : 'none',
                    overflow: 'hidden',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {/* Badge Number */}
                  <div
                    style={{
                      position: 'absolute',
                      top: 4,
                      left: 4,
                      zIndex: 10,
                      background: isActive ? 'var(--accent, #FF5500)' : 'rgba(0, 0, 0, 0.75)',
                      color: '#ffffff',
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: 4,
                      backdropFilter: 'blur(2px)',
                    }}
                  >
                    {index + 1}
                  </div>

                  {/* Thumbnail Container */}
                  <div style={{ width: '100%', aspectRatio: '16/9', overflow: 'hidden', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {renderThumb ? (
                      <RailSlideThumb index={index} renderThumb={renderThumb} />
                    ) : (
                      <NativeSlideBoard
                        elements={slideElementsFor(slide)}
                        background={slide.background}
                        width={210}
                      />
                    )}
                  </div>

                  {/* Slide Label Footer */}
                  <div
                    style={{
                      padding: '4px 8px',
                      fontSize: 11,
                      color: isActive ? '#ffffff' : 'var(--text-secondary)',
                      background: isActive ? 'rgba(255, 85, 0, 0.15)' : 'rgba(0, 0, 0, 0.4)',
                      borderTop: '1px solid var(--border-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontWeight: isActive ? 600 : 400,
                    }}
                  >
                    {slide.title || `Slide ${index + 1}`}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Info Bar */}
          <div
            style={{
              padding: '8px 12px',
              borderTop: '1px solid var(--border-primary)',
              background: 'var(--bg-primary)',
              fontSize: 11,
              color: 'var(--text-dim)',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span>Active Slide: <strong style={{ color: 'var(--text-primary)' }}>{activeSlideIndex + 1}</strong></span>
            <span>Total: {slides.length}</span>
          </div>
        </div>
      ) : (
        /* Templates Panel */
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          {/* Templates Action Toolbar */}
          <div
            style={{
              padding: '10px 12px',
              display: 'flex',
              gap: 6,
              borderBottom: '1px solid var(--border-primary)',
              background: 'var(--bg-primary)',
            }}
          >
            <button
              type="button"
              onClick={() => handleOpenSaveModal(activeSlideIndex)}
              style={{
                flex: 1,
                padding: '6px 8px',
                background: 'var(--accent, #FF5500)',
                border: 'none',
                borderRadius: 5,
                color: '#ffffff',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
              }}
              title="Save active slide as a custom template"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>Save Active Slide</span>
            </button>
            <button
              type="button"
              onClick={handleImportClick}
              style={{
                padding: '6px 9px',
                background: 'var(--chrome-control)',
                border: '1px solid var(--border-primary)',
                borderRadius: 5,
                color: 'var(--text-primary)',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
              }}
              title="Import .bsptemplate or JSON template file"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>Import</span>
            </button>
            <button
              type="button"
              onClick={handleExportAllTemplates}
              style={{
                padding: '6px 9px',
                background: 'var(--chrome-control)',
                border: '1px solid var(--border-primary)',
                borderRadius: 5,
                color: 'var(--text-primary)',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
              }}
              title="Export all templates (.bsptemplate)"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span>Export</span>
            </button>
          </div>

          <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Custom User Templates Section */}
            {customTemplates.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent, #FF5500)', textTransform: 'uppercase' }}>
                    My Custom Templates ({customTemplates.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      customTemplates.forEach((t) => exportCustomTemplate(t));
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      fontSize: 11,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                    title="Export all custom templates"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    <span>Export All</span>
                  </button>
                </div>

                {customTemplates.map((tpl) => (
                  <div
                    key={tpl.id}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setTemplateContextMenu({ x: e.clientX, y: e.clientY, template: tpl, isPrebuilt: false });
                    }}
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 85, 0, 0.25)',
                      borderRadius: 6,
                      overflow: 'hidden',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      position: 'relative',
                    }}
                  >
                    <div onClick={() => onApplyTemplate(tpl.id)}>
                      <CustomTemplateThumb template={tpl} />
                    </div>

                    <div
                      style={{
                        padding: '6px 10px',
                        background: 'rgba(22, 20, 20, 0.95)',
                        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span
                        onClick={() => onApplyTemplate(tpl.id)}
                        style={{ fontSize: 11, fontWeight: 700, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}
                      >
                        {tpl.name}
                      </span>

                      {/* Quick Action Controls */}
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <button
                          type="button"
                          onClick={() => onApplyTemplate(tpl.id)}
                          style={{ background: 'none', border: 'none', color: '#FF5500', cursor: 'pointer', fontSize: 10, fontWeight: 700 }}
                          title="Apply Template to Current Slide"
                        >
                          Apply
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            updateCustomTemplateFromSlide(tpl.id, slides[activeSlideIndex]);
                            alert(`Template "${tpl.name}" updated from Slide ${activeSlideIndex + 1}!`);
                          }}
                          style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 2 }}
                          title="Update Template layout from Active Slide"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="23 4 23 10 17 10" />
                            <polyline points="1 20 1 14 7 14" />
                            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => exportCustomTemplate(tpl)}
                          style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 2 }}
                          title="Export Template File (.bsptemplate)"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="17 8 12 3 7 8" />
                            <line x1="12" y1="3" x2="12" y2="15" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteCustomTemplate(tpl.id)}
                          style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 2 }}
                          title="Delete Custom Template"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Prebuilt System Templates */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255, 255, 255, 0.5)', textTransform: 'uppercase' }}>
                  Prebuilt Templates
                </span>
                <button
                  type="button"
                  onClick={() => {
                    PREBUILT_TEMPLATES.forEach((pt) => {
                      exportCustomTemplate(getPrebuiltTemplateObj(pt.id, pt.name));
                    });
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    fontSize: 11,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                  title="Export all prebuilt templates"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <span>Export All</span>
                </button>
              </div>

              {PREBUILT_TEMPLATES.map((tpl) => {
                const templateObj = getPrebuiltTemplateObj(tpl.id, tpl.name);
                return (
                  <div
                    key={tpl.id}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setTemplateContextMenu({ x: e.clientX, y: e.clientY, template: templateObj, isPrebuilt: true });
                    }}
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: 6,
                      overflow: 'hidden',
                      cursor: 'pointer',
                      padding: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(244, 98, 31, 0.5)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.5)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div onClick={() => onApplyTemplate(tpl.id)}>
                      <CustomTemplateThumb template={templateObj} />
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: 'rgba(255, 255, 255, 0.9)',
                        padding: '6px 10px',
                        background: 'rgba(0, 0, 0, 0.6)',
                        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span onClick={() => onApplyTemplate(tpl.id)} style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {tpl.name}
                      </span>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <button
                          type="button"
                          onClick={() => onApplyTemplate(tpl.id)}
                          style={{ background: 'none', border: 'none', color: '#FF5500', cursor: 'pointer', fontSize: 10, fontWeight: 700 }}
                          title="Apply Template to Current Slide"
                        >
                          Apply
                        </button>
                        <button
                          type="button"
                          onClick={() => exportCustomTemplate(templateObj)}
                          style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 2 }}
                          title="Export Template File (.bsptemplate)"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="17 8 12 3 7 8" />
                            <line x1="12" y1="3" x2="12" y2="15" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Slide Right-Click Context Menu Portal */}
      {slideContextMenu && createPortal(
        <div
          style={{
            position: 'fixed',
            top: slideContextMenu.y,
            left: slideContextMenu.x,
            zIndex: 100020,
            background: 'var(--bg-secondary, #1a1919)',
            border: '1px solid var(--border-primary, #333)',
            borderRadius: 6,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
            padding: 4,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            minWidth: 180,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => handleOpenSaveModal(slideContextMenu.slideIndex)}
            style={contextMenuItemStyle}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
            <span>Save as Template...</span>
          </button>
          <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '2px 0' }} />
          {!readOnlyDeck && (
            <button
              type="button"
              onClick={() => {
                onDuplicateSlide(slideContextMenu.slideIndex);
                setSlideContextMenu(null);
              }}
              style={contextMenuItemStyle}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              <span>Duplicate Slide</span>
            </button>
          )}
          {!readOnlyDeck && slideContextMenu.slideIndex > 0 && (
            <button
              type="button"
              onClick={() => {
                onMoveSlide(slideContextMenu.slideIndex, slideContextMenu.slideIndex - 1);
                setSlideContextMenu(null);
              }}
              style={contextMenuItemStyle}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <polyline points="18 15 12 9 6 15" />
              </svg>
              <span>Move Up</span>
            </button>
          )}
          {!readOnlyDeck && slideContextMenu.slideIndex < slides.length - 1 && (
            <button
              type="button"
              onClick={() => {
                onMoveSlide(slideContextMenu.slideIndex, slideContextMenu.slideIndex + 1);
                setSlideContextMenu(null);
              }}
              style={contextMenuItemStyle}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
              <span>Move Down</span>
            </button>
          )}
          {slides.length > 1 && (
            <>
              <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '2px 0' }} />
              <button
                type="button"
                onClick={() => {
                  onDeleteSlide(slideContextMenu.slideIndex);
                  setSlideContextMenu(null);
                }}
                style={{ ...contextMenuItemStyle, color: '#f87171' }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                <span>Delete Slide</span>
              </button>
            </>
          )}
        </div>,
        document.body
      )}

      {/* Template Right-Click Context Menu Portal */}
      {templateContextMenu && createPortal(
        <div
          style={{
            position: 'fixed',
            top: templateContextMenu.y,
            left: templateContextMenu.x,
            zIndex: 100020,
            background: 'var(--bg-secondary, #1a1919)',
            border: '1px solid var(--border-primary, #333)',
            borderRadius: 6,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
            padding: 4,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            minWidth: 200,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              onApplyTemplate(templateContextMenu.template.id.replace(/^tpl-/, ''));
              setTemplateContextMenu(null);
            }}
            style={contextMenuItemStyle}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            <span>Apply to Active Slide</span>
          </button>
          {!templateContextMenu.isPrebuilt && (
            <>
              <button
                type="button"
                onClick={() => {
                  updateCustomTemplateFromSlide(templateContextMenu.template.id, slides[activeSlideIndex]);
                  setTemplateContextMenu(null);
                  alert(`Updated "${templateContextMenu.template.name}" from active slide!`);
                }}
                style={contextMenuItemStyle}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <polyline points="23 4 23 10 17 10" />
                  <polyline points="1 20 1 14 7 14" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
                <span>Update from Active Slide</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setTemplateNameInput(templateContextMenu.template.name);
                  setRenameModal({ templateId: templateContextMenu.template.id, currentName: templateContextMenu.template.name });
                  setTemplateContextMenu(null);
                }}
                style={contextMenuItemStyle}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
                <span>Rename Template...</span>
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => {
              exportCustomTemplate(templateContextMenu.template);
              setTemplateContextMenu(null);
            }}
            style={contextMenuItemStyle}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span>Export Template (.bsptemplate)</span>
          </button>
          {!templateContextMenu.isPrebuilt && (
            <>
              <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '2px 0' }} />
              <button
                type="button"
                onClick={() => {
                  deleteCustomTemplate(templateContextMenu.template.id);
                  setTemplateContextMenu(null);
                }}
                style={{ ...contextMenuItemStyle, color: '#f87171' }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                <span>Delete Template</span>
              </button>
            </>
          )}
        </div>,
        document.body
      )}

      {/* Save Template Name Modal */}
      {saveModal && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100030,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => setSaveModal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 360,
              background: 'var(--bg-secondary, #1a1919)',
              border: '1px solid var(--border-primary, #333)',
              borderRadius: 8,
              boxShadow: '0 12px 32px rgba(0, 0, 0, 0.8)',
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#ffffff' }}>
              Save Slide as Template
            </h3>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
              Give your new custom template a descriptive name:
            </p>
            <input
              type="text"
              autoFocus
              value={templateNameInput}
              onChange={(e) => setTemplateNameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveModalSubmit();
                if (e.key === 'Escape') setSaveModal(null);
              }}
              placeholder="e.g. Sunday Worship Lower Third"
              style={{
                background: 'var(--bg-primary, #111)',
                border: '1px solid var(--border-primary, #444)',
                borderRadius: 5,
                padding: '8px 12px',
                color: '#fff',
                fontSize: 13,
                outline: 'none',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
              <button
                type="button"
                onClick={() => setSaveModal(null)}
                style={{
                  padding: '6px 14px',
                  background: 'transparent',
                  border: '1px solid var(--border-primary, #444)',
                  borderRadius: 5,
                  color: 'var(--text-secondary)',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveModalSubmit}
                style={{
                  padding: '6px 16px',
                  background: 'var(--accent, #FF5500)',
                  border: 'none',
                  borderRadius: 5,
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Save Template
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Rename Template Modal */}
      {renameModal && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100030,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => setRenameModal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 360,
              background: 'var(--bg-secondary, #1a1919)',
              border: '1px solid var(--border-primary, #333)',
              borderRadius: 8,
              boxShadow: '0 12px 32px rgba(0, 0, 0, 0.8)',
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#ffffff' }}>
              Rename Template
            </h3>
            <input
              type="text"
              autoFocus
              value={templateNameInput}
              onChange={(e) => setTemplateNameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameSubmit();
                if (e.key === 'Escape') setRenameModal(null);
              }}
              placeholder="Enter new name"
              style={{
                background: 'var(--bg-primary, #111)',
                border: '1px solid var(--border-primary, #444)',
                borderRadius: 5,
                padding: '8px 12px',
                color: '#fff',
                fontSize: 13,
                outline: 'none',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
              <button
                type="button"
                onClick={() => setRenameModal(null)}
                style={{
                  padding: '6px 14px',
                  background: 'transparent',
                  border: '1px solid var(--border-primary, #444)',
                  borderRadius: 5,
                  color: 'var(--text-secondary)',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRenameSubmit}
                style={{
                  padding: '6px 16px',
                  background: 'var(--accent, #FF5500)',
                  border: 'none',
                  borderRadius: 5,
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Rename
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </aside>
  );
}

const contextMenuItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 8px',
  background: 'transparent',
  border: 'none',
  borderRadius: 4,
  color: 'var(--text-primary)',
  fontSize: 12,
  cursor: 'pointer',
  textAlign: 'left',
  width: '100%',
  transition: 'background 0.12s ease',
};
