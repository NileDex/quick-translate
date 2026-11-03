/**
 * `quick-translate-sdk/messages`: a tiny, framework-agnostic translator for plain JSON dictionaries.
 * Server-safe (use it in Server Components, route handlers, Node, workers). React apps normally use
 * `useT()` from `quick-translate-sdk/react`, which is built on this.
 *
 * @packageDocumentation
 */

/** A dictionary: nested objects of strings. A `{ one, other, … }` object is a plural form. */
export interface Messages {
  [key: string]: string | Messages;
}

/** Interpolation values. `count` (a number) also selects the plural form. */
export type TranslateValues = Record<string, string | number>;

/**
 * Register your dictionary's type once to get autocompleted, type-checked keys everywhere:
 *
 * ```ts
 * import type en from './messages/en.json';
 * declare module 'quick-translate-sdk/messages' {
 *   interface MessagesRegister { messages: typeof en }
 * }
 * ```
 */
// biome-ignore lint/suspicious/noEmptyInterface: augmented by users via declaration merging
export interface MessagesRegister {}

type Join<P extends string, K extends string> = P extends '' ? K : `${P}.${K}`;
/** All dot-separated keys of a dictionary type (plural objects are keys too). */
export type MessageKeys<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string
    ? Join<P, K>
    : Join<P, K> | MessageKeys<T[K], Join<P, K>>;
}[keyof T & string];

/** The registered key union (see {@link MessagesRegister}), or `string`. */
export type MessageKey = MessagesRegister extends { messages: infer M } ? MessageKeys<M> : string;

/** A translate function: `t('home.title')`, `t('cart.items', { count: 3 })`. */
export type Translate = (key: MessageKey, values?: TranslateValues) => string;

/**
 * Creates a translate function for one dictionary. Missing keys return the key itself (and warn once
 * in development), so the UI never shows `undefined`.
 *
 * @example
 * ```ts
 * const t = createTranslator({ hi: 'Hello {name}', items: { one: '# item', other: '# items' } }, 'en');
 * t('hi', { name: 'Ada' })   // "Hello Ada"
 * t('items', { count: 2 })   // "2 items"   (# is replaced by the formatted count)
 * ```
 */
export function createTranslator(messages: Messages | undefined, locale: string): Translate {
  let plural: Intl.PluralRules | undefined;
  let num: Intl.NumberFormat | undefined;
  return (key, values) => {
    let v: string | Messages | undefined = messages;
    for (const part of (key as string).split('.')) v = typeof v === 'object' ? v[part] : undefined;
    const count = values?.count;
    if (v && typeof v === 'object' && typeof count === 'number') {
      plural ??= new Intl.PluralRules(locale);
      v = v[count === 0 && v.zero ? 'zero' : plural.select(count)] ?? v.other;
    }
    if (typeof v !== 'string') {
      if (process.env.NODE_ENV !== 'production')
        console.warn(`[quick-translate-sdk] Missing message "${key}" for locale "${locale}".`);
      return key as string;
    }
    if (typeof count === 'number') {
      num ??= new Intl.NumberFormat(locale);
      v = v.replace(/#/g, num.format(count));
    }
    return values
      ? v.replace(/\{(\w+)\}/g, (m, k: string) => (k in values ? String(values[k]) : m))
      : v;
  };
}
