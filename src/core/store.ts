import { findLocale, type LocaleConfig } from './config';

/** Called after the locale changes. */
export type LocaleListener<L extends string = string> = (locale: L, previous: L) => void;

/**
 * Minimal external store holding the active locale. Framework-agnostic; React reads it with
 * `useSyncExternalStore`, so only components that read the locale re-render.
 */
export interface LocaleStore<L extends string = string> {
  readonly config: LocaleConfig<L>;
  /** Current locale. Stable reference (a string), safe as a `useSyncExternalStore` snapshot. */
  getLocale(): L;
  /**
   * Sets the locale. Accepts any casing (`"pt-br"`). Returns `false` (and warns in development) if the
   * locale is not supported; returns `true` otherwise, including when it is already active.
   */
  setLocale(locale: string): boolean;
  /** Subscribes to changes; returns an unsubscribe function. */
  subscribe(listener: LocaleListener<L>): () => void;
}

/** Creates a {@link LocaleStore}. `initial` defaults to `config.defaultLocale`. */
export function createLocaleStore<L extends string>(
  config: LocaleConfig<L>,
  initial?: string | null,
): LocaleStore<L> {
  let current = findLocale(config.locales, initial) ?? config.defaultLocale;
  const listeners = new Set<LocaleListener<L>>();
  return {
    config,
    getLocale: () => current,
    setLocale(value) {
      const next = findLocale(config.locales, value);
      if (!next) {
        if (process.env.NODE_ENV !== 'production')
          console.warn(
            `[quick-translate-sdk] setLocale("${value}") ignored: not one of [${config.locales.join(', ')}].`,
          );
        return false;
      }
      if (next !== current) {
        const prev = current;
        current = next;
        for (const l of listeners) l(next, prev);
      }
      return true;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
