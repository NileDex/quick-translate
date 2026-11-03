/**
 * How the active locale is carried between requests.
 *
 * - `"cookie"`: the URL never changes; the locale lives in a cookie and the page is re-rendered.
 * - `"path-prefix"`: the locale is the first path segment (`/fr/docs`).
 * - `"domain"`: each locale has its own host (`example.fr`), see {@link LocaleConfigInput.domains}.
 */
export type Strategy = 'cookie' | 'path-prefix' | 'domain';

/** Input accepted by {@link defineLocales}. */
export interface LocaleConfigInput<L extends string> {
  /** Supported BCP 47 locale tags, e.g. `['en', 'fr', 'pt-BR']`. The first one is the default unless `defaultLocale` is set. */
  locales: readonly L[];
  /** Locale used when nothing else matches. Must be one of `locales`. Defaults to `locales[0]`. */
  defaultLocale?: NoInfer<L>;
  /** Defaults to `"cookie"`. */
  strategy?: Strategy;
  /** Cookie that stores the choice. Defaults to `"NEXT_LOCALE"` (compatible with Next.js' built-in i18n). */
  cookieName?: string;
  /** Cookie lifetime in seconds. Defaults to one year. */
  cookieMaxAge?: number;
  /**
   * Opt-in URL override, e.g. `"lang"` lets `?lang=fr` force French (handy for agents and QA deep links).
   * Defaults to `false` (disabled).
   */
  queryParam?: string | false;
  /** For `strategy: "domain"`: host → locale, e.g. `{ 'example.fr': 'fr' }`. */
  domains?: Readonly<Record<string, NoInfer<L>>>;
  /**
   * Exact names to show for some (or all) languages, e.g. `{ yo: 'Yorùbá', 'zh-Hans': '简体中文' }`.
   * Without it, names come from the browser's `Intl.DisplayNames`. Use it to control wording, or to get
   * identical names on server and client (Node and browsers ship different ICU data).
   */
  labels?: Readonly<Partial<Record<NoInfer<L>, string>>>;
}

/** Normalized, frozen configuration returned by {@link defineLocales}. Safe to pass from Server to Client Components. */
export interface LocaleConfig<L extends string = string> {
  readonly locales: readonly L[];
  readonly defaultLocale: L;
  readonly strategy: Strategy;
  readonly cookieName: string;
  readonly cookieMaxAge: number;
  readonly queryParam: string | false;
  readonly domains: Readonly<Record<string, L>> | undefined;
  readonly labels: Readonly<Partial<Record<L, string>>> | undefined;
}

/** Extracts the locale union from a config: `type Locale = LocaleOf<typeof config>`. */
export type LocaleOf<C> = C extends LocaleConfig<infer L> ? L : never;

/**
 * Register your config once to get typed locale unions from every hook:
 *
 * ```ts
 * declare module 'quick-translate-sdk' {
 *   interface Register { config: typeof locales }
 * }
 * ```
 */
// biome-ignore lint/suspicious/noEmptyInterface: augmented by users via declaration merging
export interface Register {}

/** The registered locale union (see {@link Register}), or `string` if none is registered. */
export type Locale = Register extends { config: LocaleConfig<infer L> } ? L : string;

/**
 * Declares the supported locales. Call it once (e.g. in `i18n.ts`) and import the result everywhere.
 *
 * @example
 * ```ts
 * export const locales = defineLocales({ locales: ['en', 'fr', 'ar'], defaultLocale: 'en' });
 * // shorthand, first entry is the default:
 * export const locales = defineLocales(['en', 'fr', 'ar'] as const);
 * ```
 */
export function defineLocales<const L extends string>(
  input: LocaleConfigInput<L> | readonly L[],
): LocaleConfig<L> {
  const o = (Array.isArray(input) ? { locales: input } : input) as LocaleConfigInput<L>;
  const locales = o.locales;
  const defaultLocale = (o.defaultLocale ?? locales[0]) as L;
  if (process.env.NODE_ENV !== 'production') {
    if (!locales.length)
      throw new Error('[quick-translate-sdk] defineLocales(): `locales` is empty.');
    if (!locales.includes(defaultLocale))
      throw new Error(
        `[quick-translate-sdk] defineLocales(): defaultLocale "${defaultLocale}" is not in locales [${locales.join(', ')}].`,
      );
    for (const l of locales) {
      try {
        Intl.getCanonicalLocales(l);
      } catch {
        throw new Error(`[quick-translate-sdk] defineLocales(): "${l}" is not a valid BCP 47 tag.`);
      }
    }
  }
  return Object.freeze({
    locales,
    defaultLocale,
    strategy: o.strategy ?? 'cookie',
    cookieName: o.cookieName ?? 'NEXT_LOCALE',
    cookieMaxAge: o.cookieMaxAge ?? 31536000,
    queryParam: o.queryParam ?? false,
    domains: o.domains,
    labels: o.labels,
  });
}

/** Returns the supported locale equal to `value` (case-insensitive), or `undefined`. */
export function findLocale<L extends string>(
  locales: readonly L[],
  value: string | null | undefined,
): L | undefined {
  if (!value) return;
  const v = value.toLowerCase();
  for (const l of locales) if (l.toLowerCase() === v) return l;
}

/** Type guard: is `value` one of the configured locales (exact, case-insensitive)? */
export function isLocale<L extends string>(config: LocaleConfig<L>, value: unknown): value is L {
  return typeof value === 'string' && findLocale(config.locales, value) === value;
}
