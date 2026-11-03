import {
  type Dir,
  getDir,
  getFlag,
  getLanguageName,
  type Locale,
  matchLocale,
} from 'quick-translate-sdk';
import { type KeyboardEvent, type UIEvent, useEffect, useMemo, useRef, useState } from 'react';
import { nativeNameOf } from './context';
import { afterPaint } from './provider';
import {
  type SelectorCore,
  type UseLanguageSelectorOptions,
  useSelectorCore,
} from './selector-core';

export type { UseLanguageSelectorOptions } from './selector-core';

/** One entry of the selector. */
export interface LanguageOption<L extends string = Locale> {
  locale: L;
  /** Name in the language itself ("Français"). */
  nativeName: string;
  /** Name in the active locale ("French" when the UI is English). */
  name: string;
  /** Flag emoji of the most likely region ("" if unknown). */
  flag: string;
  dir: Dir;
  /** Comes from `navigator.languages` and is listed first. */
  suggested: boolean;
  /** Is the active locale. */
  selected: boolean;
}

/** Window of rendered rows when the list is virtualized. */
export interface VirtualWindow {
  start: number;
  end: number;
  paddingTop: number;
  paddingBottom: number;
}

/** Lowercases and strips diacritics so `"Français"`, `"francais"` and `"FRANÇAIS"` compare equal. */
export function normalizeText(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Pre-normalized search over a fixed list. Build once; each `search()` normalizes only the query and
 * writes matching indices into a reused buffer (no per-item allocation). Latin queries match word
 * starts (`"fr"` → "French", not "Afrikaans"); non-Latin queries match anywhere (`"本"` → "日本語").
 */
export interface SearchIndex {
  /** Indices of the matches from the last `search()`; read `matches[0 .. count-1]`. */
  readonly matches: Uint32Array;
  /** Runs a query and returns the number of matches. An empty query matches everything. */
  search(query: string): number;
}

/** Builds a {@link SearchIndex}. `items[i]` lists the searchable strings of item `i` (code, names…). */
export function createSearchIndex(items: readonly (readonly string[])[]): SearchIndex {
  const hay = items.map((parts) => ` ${normalizeText(parts.join(' ')).replace(/[-_()]/g, ' ')}`);
  const matches = new Uint32Array(hay.length);
  return {
    matches,
    search(query) {
      const q = normalizeText(query.trim()).replace(/[-_]/g, ' ');
      const needle = q.charCodeAt(0) > 127 ? q : ` ${q}`;
      let n = 0;
      for (let i = 0; i < hay.length; i++) if (!q || hay[i]!.includes(needle)) matches[n++] = i;
      return n;
    },
  };
}

type Props = Record<string, unknown>;

/** @internal Panel-side logic: options, search, keyboard, virtualization, prefetch. */
export function usePanel<L extends string>(core: SelectorCore<L>) {
  const { ctx, locale, open, initialQuery, id, close, opts, searchable } = core;
  const locales = ctx.store.config.locales as readonly L[];
  // Every option stays in the DOM like a regular <select>; only huge lists (500+) are windowed.
  const { suggested = true, virtualizeThreshold = 500, itemHeight = 36, visibleItems = 10 } = opts;

  const [query, setQuery] = useState(initialQuery);
  const [activeLocale, setActiveLocale] = useState<string | null>(initialQuery ? null : locale);
  const [scrollTop, setScrollTop] = useState(0);
  // Reset when re-opened (headless usage keeps this hook mounted while closed).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setQuery(initialQuery);
      setActiveLocale(initialQuery ? null : locale);
      setScrollTop(0);
    }
  }
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const typed = useRef({ s: '', t: 0 });

  // Names come from config.labels, else Intl.DisplayNames (cached per locale); no language data ships.
  const { config } = ctx.store;
  const all = useMemo<LanguageOption<L>[]>(() => {
    const sug = new Set<L>();
    if (open && suggested && typeof navigator !== 'undefined')
      for (const t of navigator.languages ?? []) {
        const m = matchLocale(t, locales);
        if (m) sug.add(m);
      }
    const some = sug.size < locales.length;
    return (some ? [...sug, ...locales.filter((l) => !sug.has(l))] : locales).map((l) => ({
      locale: l,
      nativeName: nativeNameOf(config, l),
      name: getLanguageName(l, locale),
      flag: getFlag(l),
      dir: getDir(l),
      suggested: some && sug.has(l),
      selected: l === locale,
    }));
  }, [open, suggested, locales, locale, config]);

  // Labels are normalized once; a keystroke only normalizes the query.
  const index = useMemo(
    () =>
      createSearchIndex(
        all.map((o) => [o.locale, o.nativeName, o.name, getLanguageName(o.locale, 'en')]),
      ),
    [all],
  );
  const options = useMemo(() => {
    if (!query) return all;
    const n = index.search(query);
    const out: LanguageOption<L>[] = new Array(n);
    for (let i = 0; i < n; i++) out[i] = all[index.matches[i]!]!;
    return out;
  }, [all, index, query]);

  const found = options.findIndex((o) => o.locale === activeLocale);
  const activeIndex = found >= 0 ? found : options.length ? 0 : -1;
  const active = options[activeIndex];
  const optionId = (l: string) => `${id}o${l}`;
  const isVirtual = options.length > virtualizeThreshold;

  let virtual: VirtualWindow | null = null;
  if (isVirtual) {
    const size = visibleItems + 6;
    let start = Math.max(0, Math.floor(scrollTop / itemHeight) - 3);
    // Always render the active option, even before the scroll event lands (keyboard End/PageDown).
    if (activeIndex >= start + size) start = activeIndex - size + 1;
    else if (activeIndex >= 0 && activeIndex < start) start = activeIndex;
    const end = Math.min(options.length, start + size);
    virtual = {
      start,
      end,
      paddingTop: start * itemHeight,
      paddingBottom: (options.length - end) * itemHeight,
    };
  }

  const prefetch = (l: string) =>
    ctx.prefetch(l, opts.prefetchMessages as ((l: string) => unknown) | undefined);
  // Close (and paint) first, then switch the whole page in the next frame: the click responds in one
  // frame even when the new language's layout is expensive (first time a script like CJK is shown).
  const select = (l: L) => {
    close(true);
    afterPaint(() => {
      ctx.setLocale(l);
      opts.onSelect?.(l);
    });
  };

  // Move focus into the panel: the search box, or the listbox itself (aria-activedescendant).
  useEffect(() => {
    if (open) (inputRef.current ?? listRef.current)?.focus();
  }, [open]);

  // Keep the active option visible, and prefetch its messages.
  const activeCode = open ? active?.locale : undefined;
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs only when the active option changes; the other values are read fresh.
  useEffect(() => {
    if (!activeCode) return;
    prefetch(activeCode);
    const list = listRef.current;
    if (!list) return;
    if (isVirtual) {
      const top = activeIndex * itemHeight;
      if (top < list.scrollTop) list.scrollTop = top;
      else if (top + itemHeight > list.scrollTop + list.clientHeight)
        list.scrollTop = top + itemHeight - list.clientHeight;
    } else document.getElementById(optionId(activeCode))?.scrollIntoView?.({ block: 'nearest' });
  }, [activeCode]);

  const move = (i: number) => {
    const o = options[Math.max(0, Math.min(options.length - 1, i))];
    if (o) setActiveLocale(o.locale);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const i = activeIndex;
    const k = e.key;
    if (k === 'ArrowDown') move(i + 1);
    else if (k === 'ArrowUp') move(i - 1);
    else if (k === 'Home') move(0);
    else if (k === 'End') move(options.length - 1);
    else if (k === 'PageDown') move(i + 10);
    else if (k === 'PageUp') move(i - 10);
    else if (k === 'Enter' || (k === ' ' && !searchable && Date.now() - typed.current.t > 500))
      active && select(active.locale);
    else if (k === 'Escape') close(true);
    else if (k === 'Tab') return close(false);
    else if (!searchable && k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) typeahead(k);
    else return;
    e.preventDefault();
  };

  // Typeahead (no search box): jump to the next option whose name or code starts with the typed text.
  const typeahead = (key: string) => {
    const t = typed.current;
    const now = Date.now();
    t.s = (now - t.t > 500 ? '' : t.s) + key;
    t.t = now;
    const q = normalizeText(t.s);
    const n = options.length;
    const from = t.s.length === 1 ? activeIndex + 1 : activeIndex;
    for (let k = 0; k < n; k++) {
      const o = options[(from + k) % n]!;
      if ([o.nativeName, o.name, o.locale].some((x) => normalizeText(x).startsWith(q)))
        return setActiveLocale(o.locale);
    }
  };

  const activeDescendant = open && active ? optionId(active.locale) : undefined;

  return {
    /** Current search text. */
    query,
    /** Options to render, in order (suggested first). */
    options,
    /** Index of the keyboard-active option in `options`, or -1. */
    activeIndex,
    /** Non-null when only `options.slice(start, end)` should be rendered. */
    virtual,
    /** Picks a locale and closes. */
    select,
    getInputProps: (): Props => ({
      ref: inputRef,
      type: 'text',
      role: 'combobox',
      'aria-label': 'Search languages',
      'aria-autocomplete': 'list',
      'aria-expanded': true,
      'aria-controls': `${id}l`,
      'aria-activedescendant': activeDescendant,
      autoComplete: 'off',
      spellCheck: false,
      enterKeyHint: 'go',
      value: query,
      'data-qt-search': '',
      onChange: (e: { target: { value: string } }) => {
        setQuery(e.target.value);
        setActiveLocale(null);
      },
      onKeyDown,
    }),
    getListboxProps: (): Props => ({
      ref: listRef,
      id: `${id}l`,
      role: 'listbox',
      'aria-label': 'Languages',
      tabIndex: -1,
      'aria-activedescendant': searchable ? undefined : activeDescendant,
      onKeyDown: searchable ? undefined : onKeyDown,
      onScroll: virtual
        ? (e: UIEvent<HTMLElement>) => setScrollTop(e.currentTarget.scrollTop)
        : undefined,
      style: virtual
        ? {
            maxHeight: itemHeight * visibleItems,
            overflowY: 'auto',
            paddingTop: virtual.paddingTop,
            paddingBottom: virtual.paddingBottom,
          }
        : undefined,
    }),
    /** `index` is the position in `options` (not in the virtual slice). */
    getOptionProps: (o: LanguageOption<L>, index: number): Props => ({
      id: optionId(o.locale),
      role: 'option',
      'aria-selected': o.selected,
      'aria-posinset': virtual ? index + 1 : undefined,
      'aria-setsize': virtual ? options.length : undefined,
      'data-qt-locale': o.locale,
      'data-active': index === activeIndex ? '' : undefined,
      onPointerDown: (e: { preventDefault(): void }) => e.preventDefault(),
      onPointerEnter: () => prefetch(o.locale),
      onPointerMove: () => o.locale !== active?.locale && setActiveLocale(o.locale),
      onClick: () => select(o.locale),
    }),
  };
}

/**
 * Headless language selector: state, keyboard handling (WAI-ARIA button + listbox, with an editable
 * combobox for search), typeahead, virtualization and prefetch, as prop getters. Bring your own markup.
 *
 * @example
 * ```tsx
 * const s = useLanguageSelector();
 * <div {...s.getRootProps()}>
 *   <button {...s.getTriggerProps()}>{s.current.nativeName}</button>
 *   {s.open && <div {...s.getListboxProps()}>{s.options.map((o, i) =>
 *     <div key={o.locale} {...s.getOptionProps(o, i)}>{o.nativeName}</div>)}</div>}
 * </div>
 * ```
 */
export function useLanguageSelector<L extends string = Locale>(
  opts: UseLanguageSelectorOptions<L> = {},
) {
  const core = useSelectorCore(opts);
  const { ctx: _ctx, opts: _opts, initialQuery: _q, ...rest } = core;
  return { ...rest, ...usePanel(core) };
}

/** Return type of {@link useLanguageSelector}. */
export type LanguageSelectorState<L extends string = Locale> = ReturnType<
  typeof useLanguageSelector<L>
>;
