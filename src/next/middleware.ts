import { type NextRequest, NextResponse } from 'next/server';
import {
  findLocale,
  type LocaleConfig,
  localeFromPath,
  localizePath,
  matchLocale,
  parseAcceptLanguage,
  resolveLocale,
} from 'quick-translate-sdk';

/** Request header the middleware sets so `getLocale()` in Server Components reads the same value. */
export const LOCALE_HEADER = 'x-qt-locale';

/** Options of {@link createLocaleMiddleware}. */
export interface LocaleMiddlewareOptions {
  /**
   * Path prefixes that use the `path-prefix` strategy even when `config.strategy` is `"cookie"`,
   * e.g. `['/docs']` redirects `/docs` → `/fr/docs`. With `strategy: "path-prefix"` every path is prefixed.
   */
  prefixedPaths?: readonly string[];
  /** Runs after locale resolution; return a response to override (e.g. to chain another middleware). */
  then?: (req: NextRequest, res: NextResponse, locale: string) => NextResponse | undefined;
}

/**
 * Next.js middleware that resolves the locale on every request (`?lang=` → path prefix → domain → cookie →
 * `Accept-Language` → default), redirects to the prefixed URL when needed, persists explicit choices in the
 * cookie, and forwards the result to Server Components via a request header (no flash, no mismatch).
 *
 * @example
 * ```ts
 * // middleware.ts
 * import { createLocaleMiddleware } from 'quick-translate-sdk/next';
 * import { locales } from './i18n';
 * export default createLocaleMiddleware(locales);
 * export const config = { matcher: ['/((?!api|_next|.*\\..*).*)'] };
 * ```
 */
export function createLocaleMiddleware<L extends string>(
  config: LocaleConfig<L>,
  options: LocaleMiddlewareOptions = {},
) {
  const { locales, queryParam, cookieName } = config;
  const prefixed = options.prefixedPaths ?? [];

  return function localeMiddleware(req: NextRequest): NextResponse {
    const url = req.nextUrl;
    const { pathname } = url;
    const forced = queryParam ? matchLocale(url.searchParams.get(queryParam), locales) : undefined;
    const cookieValue = req.cookies.get(cookieName)?.value;
    const prefixLocale = localeFromPath(pathname, locales);
    const wantsPrefix =
      config.strategy === 'path-prefix' ||
      prefixed.some((p) => pathname === p || pathname.startsWith(`${p}/`));

    let locale: L;
    let res: NextResponse;

    if (prefixLocale || wantsPrefix) {
      locale =
        forced ??
        prefixLocale ??
        findLocale(locales, cookieValue) ??
        matchLocale(parseAcceptLanguage(req.headers.get('accept-language')), locales) ??
        config.defaultLocale;
      const target = localizePath(pathname, locale, locales);
      if (target !== pathname || forced) {
        const to = url.clone();
        to.pathname = target;
        if (queryParam) to.searchParams.delete(queryParam);
        res = NextResponse.redirect(to);
      } else res = next(req, locale);
    } else {
      locale = resolveLocale(config, {
        search: url.search,
        host: req.headers.get('host'),
        cookie: cookieValue,
        acceptLanguage: req.headers.get('accept-language'),
      });
      res = next(req, locale);
    }

    // Persist explicit choices (?lang= or visiting a prefixed URL); detected values stay detected.
    const explicit = forced ?? prefixLocale;
    if (explicit && explicit !== cookieValue)
      res.cookies.set(cookieName, explicit, {
        path: '/',
        maxAge: config.cookieMaxAge,
        sameSite: 'lax',
      });
    res.headers.set('content-language', locale);
    return options.then?.(req, res, locale) ?? res;
  };
}

function next(req: NextRequest, locale: string) {
  const headers = new Headers(req.headers);
  headers.set(LOCALE_HEADER, locale);
  return NextResponse.next({ request: { headers } });
}
