import { getFlag, getLanguageName, type Locale, type LocaleConfig } from 'quick-translate-sdk';
import { type CSSProperties, type ReactNode, useEffect } from 'react';
import { nativeNameOf, useLocale, useLocaleContext } from './context';
import LanguageSelectorHeadless from './headless';
import Panel from './panel';
import { onIdle } from './provider';
import { type UseLanguageSelectorOptions, useSelectorCore } from './selector-core';

/** Props of {@link LanguageSelector}. */
export interface LanguageSelectorProps<L extends string = Locale>
  extends UseLanguageSelectorOptions<L> {
  /**
   * `"popover"` (default): styled button + listbox with search. `"native"`: a real `<select>`, the fastest
   * and most robust option (and, with `formAction`, the one that works with JavaScript disabled).
   */
  variant?: 'popover' | 'native';
  /** Show flag emoji. Default `false` (flags are regions, not languages; Windows shows letters). */
  showFlags?: boolean;
  /** Also show each language's name in the current UI language. Default `true`. */
  showTranslatedName?: boolean;
  /** What the trigger shows: the native name ("Français", default) or the code ("FR"). */
  display?: 'name' | 'code';
  /** Small labels next to options, e.g. `{ es: 'Preview', ja: 'Beta' }`. */
  badges?: Partial<Record<L, string>>;
  /** Show a ✓ before the current option. Default `true`. */
  showCheck?: boolean;
  className?: string;
  style?: CSSProperties;
  /** Group headings / empty state / search placeholder. */
  texts?: { suggested?: string; all?: string; noResults?: string; searchPlaceholder?: string };
  /**
   * Native variant only: form action for the no-JS fallback, e.g. `setLocaleAction` from
   * `quick-translate-sdk/next/action` (React 19 / Next.js) or a URL that handles a POST.
   */
  formAction?: string | ((formData: FormData) => void | Promise<void>);
}

/*
 * Idle warm-up, once per (page, UI language): build every Intl.DisplayNames instance the menu needs and
 * lay out an offscreen copy of the real menu (same classes and CSS, so app theming applies too). The
 * browser's first layout of the menu, resolving fonts for every script and shaping each name at each
 * size and weight, then happens in idle time instead of on the first click. Re-run after a language
 * switch, because the translated names change.
 */
const warmed = new WeakMap<LocaleConfig, Set<string>>();
function warmUp(config: LocaleConfig, ui: string) {
  const done = warmed.get(config) ?? new Set<string>();
  warmed.set(config, done);
  if (done.has(ui)) return;
  done.add(ui);
  for (const l of [...config.locales, 'en']) getLanguageName('en', l); // 'en': English names for search
  const el = (tag: string, cls: string, text?: string) => {
    const e = document.createElement(tag);
    e.className = cls;
    if (text) e.textContent = text;
    return e;
  };
  const root = el('div', 'qt-root');
  root.setAttribute('aria-hidden', 'true');
  root.style.cssText =
    'position:absolute;top:0;left:-10000px;visibility:hidden;pointer-events:none';
  const panel = el('div', 'qt-panel');
  panel.style.animation = 'none';
  const list = el('div', 'qt-list');
  for (const selected of [false, true])
    for (const l of config.locales) {
      const row = el('div', 'qt-option');
      if (selected) row.setAttribute('aria-selected', 'true');
      const native = el('span', 'qt-native', nativeNameOf(config, l));
      native.lang = l;
      row.append(
        el('span', 'qt-check', '✓'),
        native,
        el('span', 'qt-name', getLanguageName(l, ui)),
      );
      row.append(el('span', 'qt-badge', 'Preview'));
      list.append(row);
    }
  panel.append(el('input', 'qt-search'), list);
  root.append(panel);
  document.body.append(root);
  root.getBoundingClientRect(); // forces layout → fonts resolved and text shaped, now
  root.remove();
}

/**
 * Drop-in language selector. Stable hooks for agents and tests: accessible name "Select language",
 * `[data-qt-selector]`, `[data-qt-current]`, `[data-qt-locale="fr"]` on every option.
 *
 * @example <LanguageSelector />
 * @example <LanguageSelector variant="native" />
 */
export const LanguageSelector: {
  <L extends string = Locale>(props: LanguageSelectorProps<L>): ReactNode;
  /** Render-prop headless variant (same as `LanguageSelectorHeadless`). Client Components only. */
  Headless: typeof LanguageSelectorHeadless;
} = /* @__PURE__ */ Object.assign(
  function LanguageSelector<L extends string = Locale>(props: LanguageSelectorProps<L>): ReactNode {
    return props.variant === 'native' ? (
      <NativeSelector {...props} />
    ) : (
      <PopoverSelector {...props} />
    );
  },
  { Headless: LanguageSelectorHeadless },
);

function PopoverSelector<L extends string>(props: LanguageSelectorProps<L>) {
  const { store } = useLocaleContext();
  const warm = () => warmUp(store.config, store.getLocale());
  const core = useSelectorCore(props, warm); // also warms on hover/focus/touch, if idle never came
  const { current } = core;
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-warm in idle time after each switch.
  useEffect(() => onIdle(warm), [current.locale]);

  const text = props.display === 'code' ? current.locale.toUpperCase() : current.nativeName;
  return (
    <div {...core.getRootProps()} className={cx('qt-root', props.className)} style={props.style}>
      <button {...core.getTriggerProps(text)} className="qt-trigger" suppressHydrationWarning>
        {props.showFlags && current.flag && (
          <span className="qt-flag" aria-hidden="true">
            {current.flag}
          </span>
        )}
        <span
          className="qt-native"
          lang={current.locale}
          dir={current.dir}
          suppressHydrationWarning
        >
          {text}
        </span>
        <svg className="qt-chevron" aria-hidden="true" viewBox="0 0 12 12" width="12" height="12">
          <path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>
      {core.open && <Panel core={core as never} props={props as never} />}
    </div>
  );
}

function NativeSelector<L extends string>(props: LanguageSelectorProps<L>) {
  const { locale, locales, config } = useLocale<L>();
  const ctx = useLocaleContext();
  const { label = 'Select language', showFlags, showTranslatedName = true, formAction } = props;
  const select = (
    <select
      name="locale"
      aria-label={label}
      className="qt-native-select"
      value={locale}
      data-qt-trigger=""
      onChange={(e) => {
        ctx.setLocale(e.target.value);
        props.onSelect?.(e.target.value as L);
      }}
      onFocus={() => {
        for (const l of locales) ctx.prefetch(l, props.prefetchMessages as (l: string) => unknown);
      }}
      suppressHydrationWarning
    >
      {locales.map((l) => {
        const native = nativeNameOf(config, l);
        const name = getLanguageName(l, locale);
        // One text node: names come from the runtime's ICU data, which can differ between Node and
        // browsers (Chrome has no Yoruba names), so the server text is kept instead of warning.
        const text = `${showFlags ? `${getFlag(l)} ` : ''}${native}${showTranslatedName && name !== native ? ` — ${name}` : ''}`;
        return (
          <option key={l} value={l} lang={l} data-qt-locale={l} suppressHydrationWarning>
            {text}
          </option>
        );
      })}
    </select>
  );
  const attrs = {
    className: cx('qt-root qt-native-root', props.className),
    style: props.style,
    'data-qt-selector': '',
    'data-qt-current': locale,
  };
  if (!formAction) return <span {...attrs}>{select}</span>;
  return (
    // React sets method/encType itself for function (server) actions; only a URL needs method="post".
    <form
      {...attrs}
      action={formAction as string}
      method={typeof formAction === 'string' ? 'post' : undefined}
    >
      <input type="hidden" name="qt-locales" value={locales.join(',')} />
      <input type="hidden" name="qt-cookie" value={config.cookieName} />
      <input type="hidden" name="qt-strategy" value={config.strategy} />
      {select}
      <noscript>
        <button type="submit" className="qt-submit">
          OK
        </button>
      </noscript>
    </form>
  );
}

const cx = (a: string, b?: string) => (b ? `${a} ${b}` : a);
