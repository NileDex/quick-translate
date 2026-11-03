/**
 * `quick-translate-sdk/next/client`: Next.js-aware `<LocaleProvider>` (Client Component). It wires the switch
 * to the router: `router.refresh()` for `cookie`, a route change for `path-prefix`, a host change for `domain`.
 *
 * @packageDocumentation
 */
import { usePathname, useRouter } from 'next/navigation';
import { localizePath } from 'quick-translate-sdk';
import {
  LocaleProvider as BaseProvider,
  type LocaleProviderProps,
} from 'quick-translate-sdk/react';
import type { ReactNode } from 'react';

// Named re-exports (Next.js does not allow `export *` in a client boundary).
export {
  type AiLanguage,
  LanguageSelector,
  LanguageSelectorHeadless,
  type LanguageSelectorProps,
  type LocaleProviderProps,
  type QuickTranslateAgentApi,
  type UseLocaleResult,
  useAiLanguage,
  useLanguageSelector,
  useLocale,
  useLocaleSelector,
  useMessages,
  useSetLocale,
  useT,
} from 'quick-translate-sdk/react';

/** Props of the Next.js {@link LocaleProvider}. */
export interface NextLocaleProviderProps<L extends string> extends LocaleProviderProps<L> {
  /**
   * Re-render Server Components after a switch (`router.refresh()`, cookie/domain strategy). Default
   * `true`. Set `false` when all translated text is in Client Components (`useT()`): the switch is then
   * fully client-side, with zero network round-trips. The cookie is still written for the next request.
   */
  serverRefresh?: boolean;
}

/**
 * Drop this in `app/layout.tsx` (it is a Client Component; you can render it from a Server Component).
 * Config must be the plain object from `defineLocales()`; functions such as `onLocaleChange` can only be
 * passed from another Client Component.
 */
export function LocaleProvider<L extends string>({
  serverRefresh = true,
  ...props
}: NextLocaleProviderProps<L>): ReactNode {
  const router = useRouter();
  const pathname = usePathname();
  const { config } = props;
  const refresh = () => serverRefresh && router.refresh();
  return (
    <BaseProvider
      navigate={(locale) => {
        if (config.strategy === 'path-prefix') {
          router.push(localizePath(pathname, locale, config.locales) + location.search);
        } else if (config.strategy === 'domain') {
          const host = Object.keys(config.domains ?? {}).find(
            (h) => config.domains?.[h] === locale,
          );
          if (host)
            location.assign(`${location.protocol}//${host}${location.pathname}${location.search}`);
          else refresh();
        } else refresh();
      }}
      {...props}
    />
  );
}
