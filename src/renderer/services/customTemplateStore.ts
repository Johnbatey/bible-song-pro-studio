import type { PresentationSlide, SlideElement } from '../types';

export interface CustomSlideTemplate {
  id: string;
  name: string;
  category?: string;
  createdAt: number;
  updatedAt: number;
  background?: {
    type: 'color' | 'gradient' | 'image' | 'video';
    value: string;
    loop?: boolean;
    fit?: 'cover' | 'contain';
  };
  elements: SlideElement[];
}

const STORAGE_KEY = 'bsp_custom_templates_v1';
const LISTENERS = new Set<() => void>();

export function subscribeCustomTemplates(listener: () => void): () => void {
  LISTENERS.add(listener);
  return () => {
    LISTENERS.delete(listener);
  };
}

function notifyListeners() {
  LISTENERS.forEach((l) => l());
  try {
    window.dispatchEvent(new CustomEvent('bsp-custom-templates-changed'));
  } catch (e) {
    // Ignore in non-browser env
  }
}

export function getCustomTemplates(): CustomSlideTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Failed to load custom templates:', err);
    return [];
  }
}

export function saveCustomTemplate(name: string, slide: PresentationSlide): CustomSlideTemplate {
  const templates = getCustomTemplates();
  const now = Date.now();

  const elements = (slide.elements || []).map((el, i) => ({
    ...el,
    id: `tpl-el-${now}-${i}`,
  }));

  const newTemplate: CustomSlideTemplate = {
    id: `custom-tpl-${now}`,
    name: name.trim() || 'Custom Template',
    createdAt: now,
    updatedAt: now,
    background: slide.background ? { ...slide.background } : { type: 'color', value: '#18181b' },
    elements,
  };

  templates.unshift(newTemplate);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  notifyListeners();
  return newTemplate;
}

export function updateCustomTemplateFromSlide(id: string, slide: PresentationSlide): CustomSlideTemplate | null {
  const templates = getCustomTemplates();
  const idx = templates.findIndex((t) => t.id === id);
  if (idx === -1) return null;

  const now = Date.now();
  const elements = (slide.elements || []).map((el, i) => ({
    ...el,
    id: `tpl-el-${now}-${i}`,
  }));

  templates[idx] = {
    ...templates[idx],
    updatedAt: now,
    background: slide.background ? { ...slide.background } : { type: 'color', value: '#18181b' },
    elements,
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  notifyListeners();
  return templates[idx];
}

export function renameCustomTemplate(id: string, newName: string): boolean {
  const templates = getCustomTemplates();
  const idx = templates.findIndex((t) => t.id === id);
  if (idx === -1) return false;

  templates[idx].name = newName.trim() || templates[idx].name;
  templates[idx].updatedAt = Date.now();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  notifyListeners();
  return true;
}

export function deleteCustomTemplate(id: string): void {
  const templates = getCustomTemplates();
  const filtered = templates.filter((t) => t.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  notifyListeners();
}

export function exportCustomTemplate(template: CustomSlideTemplate): void {
  const jsonStr = JSON.stringify(template, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeName = template.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'template';
  a.download = `${safeName}.bsptemplate`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function importCustomTemplateFile(file: File): Promise<CustomSlideTemplate> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text);

        if (!parsed || typeof parsed !== 'object') {
          throw new Error('Invalid template format');
        }

        const now = Date.now();
        const template: CustomSlideTemplate = {
          id: `custom-tpl-imported-${now}`,
          name: parsed.name || file.name.replace(/\.(bsptemplate|json)$/i, '') || 'Imported Template',
          createdAt: now,
          updatedAt: now,
          background: parsed.background || { type: 'color', value: '#18181b' },
          elements: Array.isArray(parsed.elements) ? parsed.elements : [],
        };

        const templates = getCustomTemplates();
        templates.unshift(template);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
        notifyListeners();
        resolve(template);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read template file'));
    reader.readAsText(file);
  });
}
