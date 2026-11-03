import {
  getDir,
  getLanguageName,
  type Locale,
  type LocaleConfig,
  type LocaleStore,
} from 'quick-translate-sdk';
import type { Messages } from 'quick-translate-sdk/messages';
import { createContext, useContext, useSyncExternalStore } from 'react';

/** @internal Stable for the provider's lifetime, so consumers never re-render because of the context itself. */
export interface LocaleContextValue {
  store: LocaleStore;
  /** Loaded dictionaries by locale. A locale is only committed once its dictionary is here. */
  dicts: Map<string, Messages>;
  setLocale: (locale: string) => boolean;
  /** Starts loading a locale's dictionary (once). Resolves when it's in `dicts`. */
  prefetch: (locale: string, fn?: (locale: string) => unknown) => Promise<void> | undefined;
}

export const LocaleContext = createContext<LocaleContextValue | null>(null);

/** @internal A language's own name: `config.labels` if set, otherwise `Intl.DisplayNames`. */
export const nativeNameOf = (config: LocaleConfig, locale: string): string =>
  (config.labels as Record<string, string> | undefined)?.[locale] ?? getLanguageName(locale);

/** @internal */
export function useLocaleContext(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx)
    throw new Error(
      process.env.NODE_ENV !== 'production'
        ? '[quick-translate-sdk] No <LocaleProvider> found. Wrap your app (e.g. app/layout.tsx body) in <LocaleProvider config={locales} initialLocale={locale}>. ' +
            'In Next.js import it from "quick-translate-sdk/next/client". Hooks and <LanguageSelector> only work in Client Components.'
        : '[quick-translate-sdk] missing LocaleProvider',
    );
  return ctx;
}

/** What {@link useLocale} returns. */
export interface UseLocaleResult<L extends string = Locale> {
  /** Active locale. */
  locale: L;
  /** Text direction of the active locale. */
  dir: 'ltr' | 'rtl';
  /**
   * Switches locale: (dictionary, if `loadMessages` is set and it isn't loaded yet) → one-render swap of
   * the whole app → cookie → `onLocaleChange` → navigation (in a transition). Returns `false` if unsupported.
   */
  setLocale: (locale: L) => boolean;
  /** All configured locales. */
  locales: readonly L[];
  /** The full config passed to the provider. */
  config: LocaleConfig<L>;
}

/**
 * Reads the active locale and the setter. Re-renders only when the locale changes.
 * Must be used inside `<LocaleProvider>`, in a Client Component.
 */
export function useLocale<L extends string = Locale>(): UseLocaleResult<L> {
  const { store, setLocale } = useLocaleContext();
  const locale = useSyncExternalStore(store.subscribe, store.getLocale, store.getLocale) as L;
  const config = store.config as unknown as LocaleConfig<L>;
  return { locale, dir: getDir(locale), setLocale, locales: config.locales, config };
}

/**
 * Subscribes to a derived value of the locale; the component re-renders only when the selected value
 * changes. The selector must return a primitive or a stable reference.
 *
 * @example const isRtl = useLocaleSelector((l) => getDir(l) === 'rtl');
 */
export function useLocaleSelector<T, L extends string = Locale>(selector: (locale: L) => T): T {
  const { store } = useLocaleContext();
  const get = () => selector(store.getLocale() as L);
  return useSyncExternalStore(store.subscribe, get, get);
}

/** Returns only the setter. Components using it never re-render on locale change. */
export function useSetLocale<L extends string = Locale>(): (locale: L) => boolean {
  return useLocaleContext().setLocale;
}
