import { findLocale, type LocaleConfig } from './config';
import { readCookie } from './cookie';

/**
 * Parses an `Accept-Language` header into tags ordered by quality (highest first).
 * Entries with `q=0` and the `*` wildcard are dropped. Equal qualities keep header order.
 *
 * @example parseAcceptLanguage('fr-CH, fr;q=0.9, en;q=0.8') // ['fr-CH', 'fr', 'en']
 */
export function parseAcceptLanguage(header: string | null | undefined): string[] {
  return (header ?? '')
    .split(',')
    .map((part, i): [string, number, number] => {
      const q = /;\s*q\s*=\s*([\d.]+)/.exec(part);
      return [part.split(';')[0]!.trim(), q ? +q[1]! : 1, i];
    })
    .filter((e) => e[0] && e[0] !== '*' && e[1] > 0)
    .sort((a, b) => b[1] - a[1] || a[2] - b[2])
    .map((e) => e[0]);
}

/**
 * Picks the best supported locale for a list of requested tags (in preference order).
 *
 * For each requested tag, in order: exact match → truncated match (`pt-BR` → `pt`) →
 * same language and same script with another region (`pt` → `pt-BR`, `en-AU` → `en-GB`,
 * `zh-TW` → `zh-Hant`). A same-language match in a *different* script (`zh-TW` → `zh-Hans`) is only
 * used if no requested tag matches better. Returns `undefined` if nothing matches.
 */
export function matchLocale<L extends string>(
  requested: readonly string[] | string | null | undefined,
  locales: readonly L[],
): L | undefined {
  if (!requested) return;
  const list = typeof requested === 'string' ? [requested] : requested;
  let otherScript: L | undefined;
  for (const tag of list) {
    let t = tag;
    for (;;) {
      const hit = findLocale(locales, t);
      if (hit) return hit;
      const i = t.lastIndexOf('-');
      if (i < 1) break;
      t = t.slice(0, i);
    }
    const lang = t.toLowerCase();
    const script = scriptOf(tag);
    for (const l of locales) {
      if (l.toLowerCase().split('-')[0] !== lang) continue;
      if (!script || scriptOf(l) === script) return l;
      otherScript ??= l;
    }
  }
  return otherScript;
}

/** Likely script of a tag (`zh-TW` → `Hant`, `zh` → `Hans`, `sr-Latn` → `Latn`), if the runtime knows. */
function scriptOf(tag: string): string | undefined {
  try {
    return new Intl.Locale(tag).maximize().script;
  } catch {}
}

/** Signals used by {@link resolveLocale}. All optional. */
export interface LocaleSignals {
  /** Raw `Cookie` header or `document.cookie`. */
  cookieHeader?: string | null;
  /** Cookie value if you already parsed it (wins over `cookieHeader`). */
  cookie?: string | null;
  /** `Accept-Language` header value. */
  acceptLanguage?: string | null;
  /** `navigator.languages` (client-side detection). */
  languages?: readonly string[];
  /** URL pathname, used for `path-prefix`. */
  pathname?: string | null;
  /** URL search string (`?lang=fr`), used when `config.queryParam` is set. */
  search?: string | null;
  /** Request host, used for `domain`. */
  host?: string | null;
}

/**
 * Resolves the active locale. Order: `?lang=` override (if enabled) → path prefix → domain →
 * cookie → `Accept-Language` / `navigator.languages` → `defaultLocale`.
 */
export function resolveLocale<L extends string>(config: LocaleConfig<L>, s: LocaleSignals = {}): L {
  const { locales } = config;
  return (
    (config.queryParam && s.search
      ? matchLocale(new URLSearchParams(s.search).get(config.queryParam), locales)
      : undefined) ??
    localeFromPath(s.pathname, locales) ??
    (config.domains && s.host ? config.domains[s.host.split(':')[0]!] : undefined) ??
    findLocale(locales, s.cookie ?? readCookie(s.cookieHeader, config.cookieName)) ??
    matchLocale(s.acceptLanguage ? parseAcceptLanguage(s.acceptLanguage) : s.languages, locales) ??
    config.defaultLocale
  );
}

/** Returns the locale in the first path segment (`/fr/docs` → `fr`), or `undefined`. */
export function localeFromPath<L extends string>(
  pathname: string | null | undefined,
  locales: readonly L[],
): L | undefined {
  return pathname ? findLocale(locales, pathname.split('/')[1]) : undefined;
}

/**
 * Puts `locale` as the first path segment, replacing an existing locale prefix.
 *
 * @example localizePath('/fr/docs', 'de', locales) // '/de/docs'
 * @example localizePath('/docs', 'de', locales)    // '/de/docs'
 */
export function localizePath(pathname: string, locale: string, locales: readonly string[]): string {
  const i = pathname.indexOf('/', 1);
  const rest = localeFromPath(pathname, locales) ? (i < 0 ? '' : pathname.slice(i)) : pathname;
  return `/${locale}${rest === '/' ? '' : rest}`;
}

/**
 * Client-side detection for apps without a server (Vite/SPA): reads `location`, `document.cookie`
 * and `navigator.languages`. Returns `defaultLocale` when called on the server.
 */
export function detectLocale<L extends string>(config: LocaleConfig<L>): L {
  if (typeof document === 'undefined') return config.defaultLocale;
  return resolveLocale(config, {
    search: location.search,
    pathname: config.strategy === 'path-prefix' ? location.pathname : null,
    host: location.host,
    cookieHeader: document.cookie,
    languages: navigator.languages,
  });
}
