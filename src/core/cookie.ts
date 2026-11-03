import type { LocaleConfig } from './config';

/** Reads one cookie from a `Cookie` header / `document.cookie` string. */
export function readCookie(header: string | null | undefined, name: string): string | undefined {
  if (!header) return;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) {
      try {
        return decodeURIComponent(part.slice(i + 1).trim());
      } catch {
        return;
      }
    }
  }
}

/** Builds the `Set-Cookie` / `document.cookie` string that persists `locale`. */
export function serializeLocaleCookie(config: LocaleConfig, locale: string): string {
  return `${config.cookieName}=${encodeURIComponent(locale)};path=/;max-age=${config.cookieMaxAge};samesite=lax`;
}

/** Persists `locale` in `document.cookie` (no-op on the server). */
export function writeLocaleCookie(config: LocaleConfig, locale: string): void {
  // biome-ignore lint/suspicious/noDocumentCookie: the Cookie Store API isn't available in Safari/Firefox; this is a single sync write.
  if (typeof document !== 'undefined') document.cookie = serializeLocaleCookie(config, locale);
}
