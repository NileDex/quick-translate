import {
  createLocaleStore,
  findLocale,
  getDir,
  getLanguageName,
  type LocaleConfig,
  type LocaleStore,
  writeLocaleCookie,
} from 'quick-translate-sdk';
import type { Messages } from 'quick-translate-sdk/messages';
import {
  type ReactNode,
  startTransition,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { LocaleContext, type LocaleContextValue, nativeNameOf } from './context';

const useIsoLayoutEffect = typeof document !== 'undefined' ? useLayoutEffect : useEffect;

const noop = () => {};

/** Lays out a dictionary's text once, offscreen and hidden, so its fonts and glyphs are ready. */
function warmText(dict: Messages, locale: string) {
  const parts: string[] = [];
  const collect = (m: Messages) => {
    for (const v of Object.values(m)) typeof v === 'string' ? parts.push(v) : collect(v);
  };
  collect(dict);
  const box = document.createElement('div');
  box.lang = locale;
  box.dir = getDir(locale);
  box.setAttribute('aria-hidden', 'true');
  box.style.cssText =
    'position:absolute;top:0;left:-10000px;width:40rem;visibility:hidden;pointer-events:none';
  box.textContent = parts.join(' ');
  document.body.append(box);
  box.getBoundingClientRect(); // forces layout → font fallback + shaping done now, in idle time
  box.remove();
}

/**
 * @internal Runs `fn` right after the next paint (rAF → task). Used so a click first paints its own
 * feedback (menu closed) and the expensive part (re-rendering + laying out the whole page in another
 * language) lands in the next frame: the interaction responds in one frame, like a native <select>.
 */
export function afterPaint(fn: () => void): void {
  if (typeof requestAnimationFrame === 'undefined') return void setTimeout(fn, 0);
  requestAnimationFrame(() => setTimeout(fn, 0));
}

/** @internal Runs `fn` when the browser is idle (after the page has settled). Returns a canceller. */
export function onIdle(fn: () => void): () => void {
  const w = window as Window & {
    requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  };
  if (w.requestIdleCallback) {
    const id = w.requestIdleCallback(fn, { timeout: 2000 });
    return () => w.cancelIdleCallback?.(id);
  }
  const id = setTimeout(fn, 200);
  return () => clearTimeout(id);
}

/** Props of {@link LocaleProvider}. */
export interface LocaleProviderProps<L extends string = string> {
  /** Result of `defineLocales()`. */
  config: LocaleConfig<L>;
  /**
   * The locale to start with. With SSR pass the server-resolved value (`await getLocale(config)` in
   * Next.js) so server and client agree. In a client-only app (Vite) pass `detectLocale(config)` from
   * `quick-translate-sdk` (`?lang=` → cookie → `navigator.languages`). Defaults to `config.defaultLocale`.
   * When this prop changes (e.g. after `router.refresh()` or a route change) the store follows it.
   */
  initialLocale?: string;
  children?: ReactNode;
  /**
   * Dictionary for `initialLocale` (pass it from the server to render the first paint without a
   * request). Read it with `useT()`. Plain JSON, serializable from Server to Client Components.
   */
  messages?: Messages;
  /**
   * Loads a locale's dictionary, e.g. `(l) => import(\`./messages/${l}.json\`)` (module objects with a
   * `default` export are accepted). With it, a switch waits for the dictionary (prefetched on hover/focus
   * of an option, so usually already there) and then flips every `useT()` in the app in **one** render:
   * no reload, no flash of mixed languages.
   */
  loadMessages?: (locale: L) => Promise<Messages | { default: Messages }> | Messages;
  /** Called after every switch is committed. Plug another i18n library in here. */
  onLocaleChange?: (locale: L, previous: L) => void;
  /** Called (once per locale) when an option is hovered or focused, so messages load before the click. */
  prefetchMessages?: (locale: L) => unknown;
  /**
   * When to download the other languages' dictionaries (with `loadMessages`):
   * `"all"` (default): every language, in idle time right after the page loads, so every switch is
   * synchronous. `"intent"`: only when an option is hovered/focused (for very large dictionaries).
   */
  prefetch?: 'all' | 'intent';
  /**
   * Called inside `startTransition` after a switch, e.g. `router.refresh()` or a route change. The Next.js
   * provider from `quick-translate-sdk/next/client` supplies this for you.
   */
  navigate?: (locale: L, previous: L) => void;
  /** Write the cookie on switch. Default `true`. */
  persist?: boolean;
  /** Keep `<html lang dir>` in sync on the client. Default `true`. */
  syncDocument?: boolean;
  /** Expose `window.quickTranslate` (`getLocale`, `setLocale`, `listLocales`) for browser agents. Default `false`. */
  exposeAgentApi?: boolean;
  /** Bring your own store (e.g. one shared with non-React code). */
  store?: LocaleStore<L>;
}

/** Shape of `window.quickTranslate` when `exposeAgentApi` is on. */
export interface QuickTranslateAgentApi {
  version: 1;
  /** Current locale code. */
  getLocale(): string;
  /** Switches locale like a user would. Returns `false` if the code is not supported. */
  setLocale(locale: string): boolean;
  /** Every supported locale with its names and direction. */
  listLocales(): {
    code: string;
    name: string;
    nativeName: string;
    dir: 'ltr' | 'rtl';
    current: boolean;
  }[];
}

declare global {
  interface Window {
    quickTranslate?: QuickTranslateAgentApi;
  }
  interface WindowEventMap {
    'qt:localechange': CustomEvent<{ locale: string; previous: string }>;
  }
}

/**
 * Holds the active locale for its subtree. The context value never changes, so a locale switch only
 * re-renders components that read the locale (via `useLocale()` / `useLocaleSelector()`).
 */
export function LocaleProvider<L extends string>(props: LocaleProviderProps<L>): ReactNode {
  const latest = useRef(props);
  useIsoLayoutEffect(() => {
    latest.current = props;
  });

  const [value] = useState<LocaleContextValue>(() => {
    const store: LocaleStore = props.store ?? createLocaleStore(props.config, props.initialLocale);
    const dicts = new Map<string, Messages>();
    if (props.messages) dicts.set(store.getLocale(), props.messages);
    const loading = new Map<string, Promise<void>>();
    const done = new Set<string>();
    let requested = '';

    // Loads (once) a locale's dictionary into `dicts`. Returns undefined when nothing needs loading.
    const load = (l: string): Promise<void> | undefined => {
      const fn = latest.current.loadMessages as ((l: string) => unknown) | undefined;
      if (!fn || dicts.has(l)) return;
      let p = loading.get(l);
      if (!p) {
        p = Promise.resolve(fn(l)).then(
          (m) => {
            const mod = m as { default?: Messages };
            dicts.set(l, (mod && typeof mod.default === 'object' ? mod.default : m) as Messages);
          },
          (e) => {
            loading.delete(l);
            throw e;
          },
        );
        loading.set(l, p);
      }
      return p;
    };

    return {
      store,
      dicts,
      setLocale(v) {
        const next = findLocale(store.config.locales, v);
        if (!next) return store.setLocale(v); // warns in dev, returns false
        requested = next;
        const commit = () => {
          const prev = store.getLocale();
          if (requested !== next || next === prev) return; // superseded by a later click
          store.setLocale(next); // every subscriber re-renders in one batch
          const p = latest.current;
          if (p.persist !== false) writeLocaleCookie(store.config, next);
          p.onLocaleChange?.(next as L, prev as L);
          const nav = p.navigate;
          if (nav) startTransition(() => nav(next as L, prev as L));
        };
        const pending = load(next);
        if (pending)
          pending.then(commit, (e) =>
            console.error('[quick-translate-sdk] loadMessages failed', e),
          );
        else commit();
        return true;
      },
      prefetch(l, fn = latest.current.prefetchMessages as (l: string) => unknown) {
        const pending = load(l);
        pending?.catch(() => {});
        if (fn && !done.has(l)) {
          done.add(l);
          fn(l);
        }
        return pending;
      },
    };
  });
  const { store } = value;
  // A new server-rendered dictionary (router.refresh / route change) for the incoming locale.
  const initial = findLocale(store.config.locales, props.initialLocale);
  if (props.messages && initial && !value.dicts.has(initial))
    value.dicts.set(initial, props.messages);

  // Follow server-provided locale (router.refresh / route change), without re-triggering navigation.
  const { initialLocale } = props;
  useEffect(() => {
    if (initialLocale) store.setLocale(initialLocale);
  }, [initialLocale, store]);

  // <html lang dir> (now, before paint, and on every change) + DOM event for agents/analytics.
  useIsoLayoutEffect(() => {
    const sync = (locale: string) => {
      if (latest.current.syncDocument === false) return;
      const html = document.documentElement;
      if (html.lang !== locale) html.lang = locale;
      const dir = getDir(locale);
      if (html.dir !== dir) html.dir = dir;
    };
    sync(store.getLocale());
    return store.subscribe((locale, previous) => {
      sync(locale);
      window.dispatchEvent(new CustomEvent('qt:localechange', { detail: { locale, previous } }));
    });
  }, [store]);

  // Preload every other language in idle time, so a switch never waits for the network. Then lay out
  // each one's text offscreen once (one language per idle slot): the browser's first layout of a new
  // script (font fallback for every new character, e.g. ~100 ms for a Japanese page on Windows) happens
  // now instead of on the click.
  const prefetchAll = props.prefetch !== 'intent' && !!props.loadMessages;
  useEffect(() => {
    if (!prefetchAll) return;
    const cancels: (() => void)[] = [];
    cancels.push(
      onIdle(() => {
        for (const l of store.config.locales)
          value.prefetch(l)?.then(() => {
            const dict = value.dicts.get(l);
            if (dict && l !== store.getLocale()) cancels.push(onIdle(() => warmText(dict, l)));
          }, noop);
      }),
    );
    return () => {
      for (const c of cancels) c();
    };
  }, [prefetchAll, store, value]);

  const { exposeAgentApi } = props;
  // Layout effect: registered before any child's useEffect runs, so it's there as soon as the app hydrates.
  useIsoLayoutEffect(() => {
    if (!exposeAgentApi) return;
    const api: QuickTranslateAgentApi = {
      version: 1,
      getLocale: store.getLocale,
      setLocale: value.setLocale,
      listLocales: () =>
        store.config.locales.map((code) => ({
          code,
          name: getLanguageName(code, 'en'),
          nativeName: nativeNameOf(store.config, code),
          dir: getDir(code),
          current: code === store.getLocale(),
        })),
    };
    const prev = window.quickTranslate;
    window.quickTranslate = api;
    return () => {
      if (window.quickTranslate === api) window.quickTranslate = prev;
    };
  }, [exposeAgentApi, store, value]);

  return <LocaleContext.Provider value={value}>{props.children}</LocaleContext.Provider>;
}
