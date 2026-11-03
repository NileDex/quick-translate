/**
 * `quick-translate-sdk/next`: server-side helpers for Next.js 14/15 (Server Components, middleware,
 * route handlers, server actions). Never imports client code.
 *
 * @packageDocumentation
 */
import { cookies, headers } from 'next/headers';
import { findLocale, type LocaleConfig, resolveLocale } from 'quick-translate-sdk';
import { LOCALE_HEADER } from './middleware';

export { getDir, isLocale } from 'quick-translate-sdk';
export {
  createLocaleMiddleware,
  LOCALE_HEADER,
  type LocaleMiddlewareOptions,
} from './middleware';

/**
 * Resolves the request's locale in a Server Component / route handler / server action:
 * middleware header → cookie → `Accept-Language` → `defaultLocale`. Works in Next 14 (sync APIs)
 * and 15 (async APIs).
 *
 * @example
 * ```tsx
 * // app/layout.tsx
 * const locale = await getLocale(locales);
 * return <html lang={locale} dir={getDir(locale)}>…</html>;
 * ```
 */
export async function getLocale<L extends string>(config: LocaleConfig<L>): Promise<L> {
  const h = await headers();
  return (
    findLocale(config.locales, h.get(LOCALE_HEADER)) ??
    resolveLocale(config, {
      cookie: (await cookies()).get(config.cookieName)?.value,
      acceptLanguage: h.get('accept-language'),
      host: h.get('host'),
    })
  );
}

/**
 * Persists `locale` in the cookie from a server action or route handler. Returns `false` if unsupported.
 *
 * @example
 * ```ts
 * 'use server';
 * export async function changeLocale(locale: string) {
 *   await setLocale(locales, locale);
 *   revalidatePath('/');
 * }
 * ```
 */
export async function setLocale(config: LocaleConfig, locale: string): Promise<boolean> {
  const l = findLocale(config.locales, locale);
  if (!l) return false;
  (await cookies()).set(config.cookieName, l, {
    path: '/',
    maxAge: config.cookieMaxAge,
    sameSite: 'lax',
  });
  return true;
}

/**
 * `generateStaticParams` helper for `app/[locale]/…` routes.
 *
 * @example export const generateStaticParams = () => generateLocaleParams(locales);
 */
export function generateLocaleParams<L extends string, K extends string = 'locale'>(
  config: LocaleConfig<L>,
  key: K = 'locale' as K,
): Record<K, L>[] {
  return config.locales.map((l) => ({ [key]: l }) as Record<K, L>);
}

/**
 * Validates a `[locale]` route param; returns the canonical locale or `undefined` (call `notFound()` then).
 */
export function parseLocaleParam<L extends string>(
  config: LocaleConfig<L>,
  value: string | string[] | undefined,
): L | undefined {
  return findLocale(config.locales, Array.isArray(value) ? value[0] : value);
}
