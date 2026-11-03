import { getDir, getFlag, type Locale } from 'quick-translate-sdk';
import {
  type KeyboardEvent,
  type FocusEvent as ReactFocusEvent,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { type LocaleContextValue, nativeNameOf, useLocaleContext } from './context';

/** Options shared by {@link useLanguageSelector} and `<LanguageSelector>`. */
export interface UseLanguageSelectorOptions<L extends string = Locale> {
  /** Accessible name of the trigger. Default `"Select language"`. */
  label?: string;
  /** Group locales from `navigator.languages` at the top. Default `true`. */
  suggested?: boolean;
  /** Show a search box: `true`, `false`, or a number = only when there are more locales than that. Default `8`. */
  searchable?: boolean | number;
  /** Render only visible rows above this many options. Default `500` (all options stay in the DOM). */
  virtualizeThreshold?: number;
  /** Row height in px used by virtualization. Must match your CSS (`--qt-row`). Default `36`. */
  itemHeight?: number;
  /** Rows visible at once in virtual mode. Default `10`. */
  visibleItems?: number;
  /** Called (once per locale) on hover/keyboard focus of an option. Overrides the provider's. */
  prefetchMessages?: (locale: L) => unknown;
  /** Called after the user picks a locale. */
  onSelect?: (locale: L) => void;
}

type Props = Record<string, unknown>;

/** @internal Trigger-side state. Kept small: this is all that ships before the panel is opened. */
export interface SelectorCore<L extends string = Locale> {
  ctx: LocaleContextValue;
  locale: L;
  open: boolean;
  /** Text typed on the closed trigger; seeds the search box. */
  initialQuery: string;
  searchable: boolean;
  id: string;
  label: string;
  opts: UseLanguageSelectorOptions<L>;
  openPanel: (query?: string) => void;
  close: (focusTrigger: boolean) => void;
  current: { locale: L; nativeName: string; flag: string; dir: 'ltr' | 'rtl' };
  getRootProps: () => Props;
  /** Pass the trigger's visible text if it isn't the native name (e.g. "FR"), so the accessible name contains it. */
  getTriggerProps: (visibleText?: string) => Props;
}

/** @internal */
export function useSelectorCore<L extends string>(
  opts: UseLanguageSelectorOptions<L>,
  onIntent?: () => void,
): SelectorCore<L> {
  const ctx = useLocaleContext();
  const { store } = ctx;
  const locale = useSyncExternalStore(store.subscribe, store.getLocale, store.getLocale) as L;
  const n = opts.searchable ?? 8;
  const searchable = typeof n === 'number' ? store.config.locales.length > n : n;
  const [open, setOpen] = useState(false);
  const [initialQuery, setInitialQuery] = useState('');
  const id = useId();
  const label = opts.label ?? 'Select language';
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const openPanel = (q = '') => {
    setInitialQuery(q);
    setOpen(true);
  };
  const close = (focusTrigger: boolean) => {
    setOpen(false);
    if (focusTrigger) triggerRef.current?.focus();
  };

  // Close on outside press.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  return {
    ctx,
    locale,
    open,
    initialQuery,
    searchable,
    id,
    label,
    opts,
    openPanel,
    close,
    current: {
      locale,
      nativeName: nativeNameOf(store.config, locale),
      flag: getFlag(locale),
      dir: getDir(locale),
    },
    getRootProps: () => ({
      ref: rootRef,
      'data-qt-selector': '',
      'data-qt-current': locale,
      'data-state': open ? 'open' : 'closed',
      onBlur: (e: ReactFocusEvent) => {
        if (open && !rootRef.current?.contains(e.relatedTarget as Node | null)) setOpen(false);
      },
    }),
    getTriggerProps: (visibleText: string = nativeNameOf(store.config, locale)) => ({
      ref: triggerRef,
      type: 'button',
      // "Select language: Français": contains the visible text (WCAG 2.5.3 label-in-name) and tells
      // agents the current value straight from the accessibility tree.
      'aria-label': `${label}: ${visibleText}`,
      'aria-haspopup': 'listbox',
      'aria-expanded': open,
      'aria-controls': open ? `${id}l` : undefined,
      'data-qt-trigger': '',
      onClick: () => (open ? close(true) : openPanel()),
      onPointerEnter: onIntent,
      onFocus: onIntent,
      onTouchStart: onIntent,
      onKeyDown: (e: KeyboardEvent) => {
        const k = e.key;
        const printable = k.length === 1 && k !== ' ' && !e.ctrlKey && !e.metaKey && !e.altKey;
        if (open) {
          // Panel still loading (focus hasn't moved yet): keep the keystrokes for the search box.
          if (searchable && printable) {
            e.preventDefault();
            setInitialQuery((q) => q + k);
          }
          return;
        }
        if (k === 'ArrowDown' || k === 'ArrowUp') {
          e.preventDefault();
          openPanel();
        } else if (searchable && printable) {
          e.preventDefault();
          openPanel(k);
        }
      },
    }),
  };
}
