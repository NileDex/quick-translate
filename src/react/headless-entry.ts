/**
 * `quick-translate-sdk/react/headless`: kept for compatibility. Everything here is also exported from
 * `quick-translate-sdk/react`, which is the recommended import.
 *
 * @packageDocumentation
 */
export {
  default as LanguageSelectorHeadless,
  type LanguageSelectorHeadlessProps,
} from './headless';
export type { UseLanguageSelectorOptions } from './selector-core';
export {
  createSearchIndex,
  type LanguageOption,
  type LanguageSelectorState,
  normalizeText,
  type SearchIndex,
  useLanguageSelector,
  type VirtualWindow,
} from './use-language-selector';
