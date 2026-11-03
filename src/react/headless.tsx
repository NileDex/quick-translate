import type { Locale } from 'quick-translate-sdk';
import type { ReactNode } from 'react';
import type { UseLanguageSelectorOptions } from './selector-core';
import { type LanguageSelectorState, useLanguageSelector } from './use-language-selector';

/** Props of {@link LanguageSelectorHeadless}. */
export interface LanguageSelectorHeadlessProps<L extends string = Locale>
  extends UseLanguageSelectorOptions<L> {
  children: (state: LanguageSelectorState<L>) => ReactNode;
}

/**
 * Render-prop version of {@link useLanguageSelector} for fully custom designs (Client Components only).
 *
 * @example
 * <LanguageSelectorHeadless>{(s) => <div {...s.getRootProps()}>…</div>}</LanguageSelectorHeadless>
 */
export default function LanguageSelectorHeadless<L extends string = Locale>({
  children,
  ...opts
}: LanguageSelectorHeadlessProps<L>): ReactNode {
  return children(useLanguageSelector<L>(opts));
}
