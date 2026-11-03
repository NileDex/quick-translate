/** Text direction for a locale. */
export type Dir = 'ltr' | 'rtl';

// Right-to-left languages, plus RTL script subtags (e.g. `az-Arab`, `pa-Arab`).
const RTL =
  /^(ar|arc|ckb|dv|fa|he|iw|khw|ks|ku-arab|mzn|nqo|ps|sd|syr|ug|ur|yi)\b|-(arab|hebr|nkoo|syrc|thaa)\b/i;

/** `"rtl"` for Arabic, Hebrew, Persian, Urdu, … otherwise `"ltr"`. Use it on `<html dir>`. */
export function getDir(locale: string): Dir {
  return RTL.test(locale) ? 'rtl' : 'ltr';
}

// Only used when Intl.DisplayNames is missing (pre-2021 runtimes). Native names of the most-used
// languages; anything else falls back to its code. Kept deliberately tiny (core budget: 1.5 kB).
const FALLBACK: Record<string, string> = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  pt: 'Português',
};

const cache = new Map<string, Intl.DisplayNames | null>();

/**
 * Human-readable name of `code` written in `inLocale` (defaults to the language's own name), with the
 * first letter capitalized. Uses `Intl.DisplayNames`, so no language data ships in the bundle.
 *
 * @example getLanguageName('fr')        // 'Français'
 * @example getLanguageName('fr', 'en')  // 'French'
 * @example getLanguageName('pt-BR','en')// 'Brazilian Portuguese'
 */
export function getLanguageName(code: string, inLocale: string = code): string {
  let dn = cache.get(inLocale);
  if (dn === undefined) {
    try {
      dn = new Intl.DisplayNames([inLocale], { type: 'language', fallback: 'none' });
    } catch {
      dn = null;
    }
    cache.set(inLocale, dn);
  }
  let name: string | undefined;
  try {
    name = dn?.of(code);
  } catch {}
  name ||= FALLBACK[code.split('-')[0]!] || code;
  return name.charAt(0).toLocaleUpperCase(inLocale) + name.slice(1);
}

/**
 * Flag emoji for a locale's most likely region (`fr` → 🇫🇷, `pt-BR` → 🇧🇷, `en` → 🇺🇸), derived with
 * `Intl.Locale#maximize()`, so no flag data ships. Returns `""` when unknown.
 * Note: Windows does not render flag emoji (shows letters instead), and flags ≠ languages, so flags are opt-in.
 */
export function getFlag(locale: string): string {
  let region: string | undefined;
  try {
    region = new Intl.Locale(locale).maximize().region;
  } catch {}
  return region && /^[A-Z]{2}$/.test(region)
    ? String.fromCodePoint(region.charCodeAt(0) + 127397, region.charCodeAt(1) + 127397)
    : '';
}
