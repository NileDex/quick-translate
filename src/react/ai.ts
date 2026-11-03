import { AI_LOCALE_HEADER, getLanguageInstruction } from 'quick-translate-sdk/ai';
import { useMemo, useSyncExternalStore } from 'react';
import { nativeNameOf, useLocaleContext } from './context';

/** What {@link useAiLanguage} returns. */
export interface AiLanguage {
  /** The locale the user picked, e.g. `"fr"`. */
  locale: string;
  /** Its native name, e.g. `"Français"` (for a "replies in …" hint in your chat UI). */
  name: string;
  /** Headers to send with every AI request: `{ 'x-qt-locale': 'fr' }`. Read them with `localeFromRequest()`. */
  headers: Record<string, string>;
  /**
   * The instruction itself, for client-side calls (e.g. a browser-only model or a prompt you build on
   * the client). Prefer building it on the server from `headers`.
   */
  instruction: string;
}

/**
 * Connects your AI chat to the language selector: send `headers` with each request and the assistant
 * answers in the chosen language. Re-renders when the language changes, so the next message uses it.
 *
 * @example
 * ```tsx
 * const ai = useAiLanguage();
 * await fetch('/api/chat', { method: 'POST', headers: { ...ai.headers, 'content-type': 'application/json' }, body });
 * ```
 */
export function useAiLanguage(): AiLanguage {
  const { store } = useLocaleContext();
  const locale = useSyncExternalStore(store.subscribe, store.getLocale, store.getLocale);
  return useMemo(
    () => ({
      locale,
      name: nativeNameOf(store.config, locale),
      headers: { [AI_LOCALE_HEADER]: locale },
      instruction: getLanguageInstruction(locale),
    }),
    [locale, store],
  );
}
