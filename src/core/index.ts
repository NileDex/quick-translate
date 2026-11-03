/**
 * `quick-translate-sdk` core: framework-agnostic locale config, negotiation, store and `Intl` helpers.
 * No React import, safe in Server Components, middleware (edge), workers and Node.
 *
 * @packageDocumentation
 */
export {
  defineLocales,
  findLocale,
  isLocale,
  type Locale,
  type LocaleConfig,
  type LocaleConfigInput,
  type LocaleOf,
  type Register,
  type Strategy,
} from './config';
export { readCookie, serializeLocaleCookie, writeLocaleCookie } from './cookie';
export { type Dir, getDir, getFlag, getLanguageName } from './intl';
export {
  detectLocale,
  type LocaleSignals,
  localeFromPath,
  localizePath,
  matchLocale,
  parseAcceptLanguage,
  resolveLocale,
} from './negotiate';
export { createLocaleStore, type LocaleListener, type LocaleStore } from './store';
