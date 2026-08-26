import type { MessageCatalog, MessageKey, UiLocale } from './types';
import { en } from './locales/en';
import { fr } from './locales/fr';
import { es } from './locales/es';
import { pt } from './locales/pt';

export type { MessageKey, UiLocale, MessageCatalog } from './types';
export { UI_LOCALES } from './types';

const catalogs: Record<UiLocale, MessageCatalog> = { en, fr, es, pt };

let currentLocale: UiLocale = 'en';
const listeners = new Set<() => void>();

export function isUiLocale(value: unknown): value is UiLocale {
  return value === 'en' || value === 'fr' || value === 'es' || value === 'pt';
}

/** Best guess from the OS / browser before the operator picks one. */
export function detectUiLocale(navLang?: string): UiLocale {
  const raw = (navLang || (typeof navigator !== 'undefined' ? navigator.language : 'en') || 'en').toLowerCase();
  if (raw.startsWith('fr')) return 'fr';
  if (raw.startsWith('es')) return 'es';
  if (raw.startsWith('pt')) return 'pt';
  return 'en';
}

export function getUiLocale(): UiLocale {
  return currentLocale;
}

export function setUiLocale(locale: UiLocale) {
  if (locale === currentLocale) return;
  currentLocale = locale;
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale;
  }
  listeners.forEach((fn) => fn());
}

export function subscribeUiLocale(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

type Vars = Record<string, string | number>;

/**
 * Translate a UI string. Missing keys fall back to English, then to the key.
 * Placeholders use `{name}` syntax.
 */
export function t(key: MessageKey, vars?: Vars): string {
  const catalog = catalogs[currentLocale] || en;
  let text = catalog[key] ?? en[key] ?? key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replace(new RegExp(`\\{${name}\\}`, 'g'), String(value));
    }
  }
  return text;
}

export function dockMessageKey(dockId: string): MessageKey | null {
  const key = `dock.${dockId}` as MessageKey;
  return key in en ? key : null;
}
