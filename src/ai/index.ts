/**
 * `quick-translate-sdk/ai`: make your AI assistant answer in the language the user picked in the selector.
 * Provider-agnostic (Claude, OpenAI, Vercel AI SDK, local models) and server-safe; no dependencies.
 *
 * Flow: the client sends the active locale with each AI request (`useAiLanguage().headers`, or just the
 * cookie the selector already writes) → the server reads it with `localeFromRequest()` → the system
 * prompt gets `getLanguageInstruction(locale)`. Switching language mid-conversation changes the very
 * next reply.
 *
 * @packageDocumentation
 */
import {
  findLocale,
  getDir,
  getLanguageName,
  type LocaleConfig,
  readCookie,
  resolveLocale,
} from 'quick-translate-sdk';

/** Request header carrying the user's chosen locale to your AI endpoint. */
export const AI_LOCALE_HEADER = 'x-qt-locale';

/** Options of {@link getLanguageInstruction}. */
export interface LanguageInstructionOptions {
  /**
   * `"unless-asked"` (default): answer in the chosen language even if the user writes in another one,
   * but honor an explicit request for another language in a message.
   * `"always"`: never switch away from the chosen language.
   */
  mode?: 'always' | 'unless-asked';
}

/**
 * A precise, model-agnostic instruction naming the language in English and natively
 * (e.g. `French (français, fr)`), so the model doesn't drift back to English or to the user's input
 * language. Put it in the system prompt.
 *
 * @example getLanguageInstruction('pt-BR')
 * // 'Write every reply in Brazilian Portuguese (Português (Brasil), locale code pt-BR), …'
 */
export function getLanguageInstruction(
  locale: string,
  { mode = 'unless-asked' }: LanguageInstructionOptions = {},
): string {
  const english = getLanguageName(locale, 'en');
  const native = getLanguageName(locale);
  const label =
    english === native
      ? `${english} (locale code ${locale})`
      : `${english} (${native}, locale code ${locale})`;
  return [
    `Write every reply in ${label}, the language the user selected in the interface.`,
    mode === 'always'
      ? 'Do this even if the user writes in another language or asks you to switch.'
      : 'Do this even if the user writes in another language; only switch if they explicitly ask you to.',
    'Keep code, commands, identifiers, URLs, product names and quoted text unchanged.',
    `Use this locale's conventions for numbers, dates and punctuation${getDir(locale) === 'rtl' ? ', and write right-to-left text naturally' : ''}.`,
  ].join(' ');
}

/** Appends the language instruction to an existing system prompt (string form). */
export function withLanguage(
  systemPrompt: string | undefined,
  locale: string,
  options?: LanguageInstructionOptions,
): string {
  const instruction = getLanguageInstruction(locale, options);
  return systemPrompt ? `${systemPrompt}\n\n${instruction}` : instruction;
}

/**
 * Reads the user's chosen locale from an incoming request (`Request` / Next.js route handler / Hono /
 * Remix / any Fetch-API server): `x-qt-locale` header → cookie → `Accept-Language` → default.
 * Unsupported values are ignored, so the header can't inject arbitrary text into your prompt.
 */
export function localeFromRequest<L extends string>(config: LocaleConfig<L>, request: Request): L {
  const h = request.headers;
  return (
    findLocale(config.locales, h.get(AI_LOCALE_HEADER)) ??
    resolveLocale(config, {
      cookie: readCookie(h.get('cookie'), config.cookieName),
      acceptLanguage: h.get('accept-language'),
    })
  );
}
