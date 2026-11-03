/**
 * `quick-translate-sdk/react`: provider, hooks, the `<LanguageSelector>` component and the headless
 * `useLanguageSelector()` hook (Client Components).
 *
 * @packageDocumentation
 */

export { type AiLanguage, useAiLanguage } from './ai';
export {
  type UseLocaleResult,
  useLocale,
  useLocaleSelector,
  useSetLocale,
} from './context';
export {
  default as LanguageSelectorHeadless,
  type LanguageSelectorHeadlessProps,
} from './headless';
export {
  LocaleProvider,
  type LocaleProviderProps,
  type QuickTranslateAgentApi,
} from './provider';
export { QuickTranslate, type QuickTranslateProps } from './quick-translate';
export { LanguageSelector, type LanguageSelectorProps } from './selector';
export type { UseLanguageSelectorOptions } from './selector-core';
export { useMessages, useT } from './t';
export {
  createSearchIndex,
  type LanguageOption,
  type LanguageSelectorState,
  normalizeText,
  type SearchIndex,
  useLanguageSelector,
  type VirtualWindow,
} from './use-language-selector';
