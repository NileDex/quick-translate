import { createTranslator, type Messages, type Translate } from 'quick-translate-sdk/messages';
import { useMemo, useSyncExternalStore } from 'react';
import { useLocaleContext } from './context';

/**
 * Returns `t(key, values?)` for the active locale. Every component using it re-renders together, in a
 * single commit, when the locale changes, so the whole app switches language at once without a reload.
 * Requires `messages` / `loadMessages` on `<LocaleProvider>`.
 *
 * @example
 * ```tsx
 * const t = useT();
 * <h1>{t('home.title')}</h1>
 * <p>{t('cart.items', { count: 3 })}</p>
 * ```
 */
export function useT(): Translate {
  const { store, dicts } = useLocaleContext();
  const locale = useSyncExternalStore(store.subscribe, store.getLocale, store.getLocale);
  const dict = dicts.get(locale);
  return useMemo(() => createTranslator(dict, locale), [dict, locale]);
}

/** The active locale's raw dictionary (or `undefined` if none is loaded). */
export function useMessages<M extends Messages = Messages>(): M | undefined {
  const { store, dicts } = useLocaleContext();
  const locale = useSyncExternalStore(store.subscribe, store.getLocale, store.getLocale);
  return dicts.get(locale) as M | undefined;
}
