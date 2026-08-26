import { useSyncExternalStore } from 'react';
import {
  getUiLocale,
  setUiLocale,
  subscribeUiLocale,
  t,
  type MessageKey,
  type UiLocale,
} from './index';

/**
 * Subscribe the component to locale changes so `t(...)` re-renders.
 * Prefer calling `t` inside render (not outside) so the subscription matters.
 */
export function useI18n() {
  const locale = useSyncExternalStore(subscribeUiLocale, getUiLocale, () => 'en' as UiLocale);
  return {
    locale,
    setLocale: setUiLocale,
    t: (key: MessageKey, vars?: Record<string, string | number>) => t(key, vars),
  };
}
