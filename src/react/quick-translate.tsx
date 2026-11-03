import { defineLocales, detectLocale, type LocaleConfig } from 'quick-translate-sdk';
import type { Messages } from 'quick-translate-sdk/messages';
import { type ReactNode, useEffect, useState } from 'react';
import { LocaleProvider, type LocaleProviderProps } from './provider';

type Dictionary = Messages | { default: Messages };

/** Props of {@link QuickTranslate}. */
export interface QuickTranslateProps
  extends Omit<LocaleProviderProps, 'config' | 'messages' | 'loadMessages' | 'initialLocale'> {
  /** Supported locales, first one is the default: `['en', 'fr', 'ar']`. (A `defineLocales()` config also works.) */
  locales: readonly string[] | LocaleConfig;
  /** Default locale if it isn't the first of `locales`. */
  defaultLocale?: string;
  /**
   * Your translations. Either a loader, `(locale) => import(\`./messages/${locale}.json\`)` (one chunk per
   * language, prefetched on hover), or all dictionaries at once: `{ en, fr, ar }`.
   */
  messages?: ((locale: string) => Promise<Dictionary> | Dictionary) | Record<string, Messages>;
  /** Start in this locale instead of detecting it (`?lang=` → cookie → browser languages → default). */
  locale?: string;
  /** Shown until the first dictionary has loaded (a few ms for a local JSON chunk). Default: nothing. */
  fallback?: ReactNode;
  children?: ReactNode;
}

const unwrap = (m: Dictionary): Messages =>
  (m && typeof (m as { default?: unknown }).default === 'object'
    ? (m as { default: Messages }).default
    : m) as Messages;

/**
 * The one-component setup for React apps (Vite, CRA, Remix SPA…). Detects the user's language, loads
 * its dictionary before rendering (no flash of the wrong language), sets `<html lang dir>`, and switches
 * the whole app instantly when the user picks another language. For Next.js use
 * `quick-translate-sdk/next/client` instead (server-side detection).
 *
 * @example
 * ```tsx
 * <QuickTranslate locales={['en', 'fr', 'ar']} messages={(l) => import(`./messages/${l}.json`)}>
 *   <App />   // anywhere inside: const t = useT(); <LanguageSelector />
 * </QuickTranslate>
 * ```
 */
export function QuickTranslate({
  locales,
  defaultLocale,
  messages,
  locale,
  fallback = null,
  children,
  ...rest
}: QuickTranslateProps): ReactNode {
  const [config] = useState<LocaleConfig>(() =>
    Array.isArray(locales)
      ? defineLocales({ locales, defaultLocale, queryParam: 'lang' })
      : (locales as LocaleConfig),
  );
  const [initial] = useState(() => locale ?? detectLocale(config));
  const load =
    typeof messages === 'function'
      ? (l: string) => Promise.resolve(messages(l)).then(unwrap)
      : messages
        ? (l: string) => messages[l] ?? {}
        : undefined;
  const [first, setFirst] = useState<Messages | undefined>(() =>
    messages && typeof messages === 'object' ? (messages[initial] ?? {}) : undefined,
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: loads the first dictionary once, on mount.
  useEffect(() => {
    if (first || !load) return;
    let live = true;
    Promise.resolve(load(initial)).then(
      (m) => live && setFirst(m),
      (e) => {
        console.error(`[quick-translate-sdk] could not load messages for "${initial}"`, e);
        if (live) setFirst({});
      },
    );
    return () => {
      live = false;
    };
  }, []);

  if (load && !first) return fallback;
  return (
    <LocaleProvider
      config={config}
      initialLocale={initial}
      messages={first}
      loadMessages={load}
      {...rest}
    >
      {children}
    </LocaleProvider>
  );
}
