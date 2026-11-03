import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineLocales, type LocaleConfig } from '../src/core';
import {
  LanguageSelector,
  type LanguageSelectorProps,
  LocaleProvider,
  type LocaleProviderProps,
} from '../src/react';
import { createSearchIndex, normalizeText, useLanguageSelector } from '../src/react/headless-entry';

const few = defineLocales({ locales: ['en', 'fr', 'de', 'ar'], defaultLocale: 'en' });
const many = defineLocales({
  locales: ['en', 'fr', 'es', 'de', 'ar', 'ja', 'zh-Hans', 'pt-BR', 'hi', 'sw', 'yo'],
  defaultLocale: 'en',
});

let browserLanguages: string[] = [];
Object.defineProperty(navigator, 'languages', { configurable: true, get: () => browserLanguages });
const langs = { mockReturnValue: (v: string[]) => void (browserLanguages = v) };
beforeEach(() => langs.mockReturnValue(['en-US']));
afterEach(() => langs.mockReturnValue([]));

function renderSelector(
  config: LocaleConfig = few,
  props: LanguageSelectorProps = {},
  provider: Partial<LocaleProviderProps> = {},
) {
  const user = userEvent.setup();
  render(
    <LocaleProvider config={config} initialLocale="en" {...provider}>
      <button type="button">before</button>
      <LanguageSelector {...props} />
      <button type="button">after</button>
    </LocaleProvider>,
  );
  return { user, trigger: screen.getByRole('button', { name: /^Select language:/ }) };
}

describe('<LanguageSelector> (popover)', () => {
  it('renders an accessible, agent-findable trigger', () => {
    const { trigger } = renderSelector();
    // Accessible name contains the visible text (WCAG 2.5.3) and the current value.
    expect(trigger).toHaveAccessibleName('Select language: English');
    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveTextContent('English');
    const root = trigger.closest('[data-qt-selector]')!;
    expect(root).toHaveAttribute('data-qt-current', 'en');
  });

  it('opens on click; every option is in the DOM with data-qt-locale', async () => {
    const { user, trigger } = renderSelector();
    await user.click(trigger);
    const listbox = await screen.findByRole('listbox', { name: 'Languages' });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger).toHaveAttribute('aria-controls', listbox.id);
    const opts = screen.getAllByRole('option');
    expect(opts.map((o) => o.getAttribute('data-qt-locale'))).toEqual(['en', 'fr', 'de', 'ar']);
    expect(screen.getByRole('option', { name: /Français/ })).toHaveAttribute(
      'aria-selected',
      'false',
    );
    expect(screen.getByRole('option', { name: /English/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    // Native name has its own lang/dir for screen readers.
    expect(screen.getByText('العربية')).toHaveAttribute('dir', 'rtl');
    expect(screen.getByText('العربية')).toHaveAttribute('lang', 'ar');
  });

  it('keyboard: ArrowDown opens, arrows/Home/End move, Enter selects, focus returns', async () => {
    const { user, trigger } = renderSelector();
    trigger.focus();
    await user.keyboard('{ArrowDown}');
    const listbox = await screen.findByRole('listbox');
    await waitFor(() => expect(listbox).toHaveFocus());
    const active = () => document.getElementById(listbox.getAttribute('aria-activedescendant')!)!;
    expect(active()).toHaveAttribute('data-qt-locale', 'en'); // starts on current
    await user.keyboard('{ArrowDown}');
    expect(active()).toHaveAttribute('data-qt-locale', 'fr');
    await user.keyboard('{End}');
    expect(active()).toHaveAttribute('data-qt-locale', 'ar');
    await user.keyboard('{ArrowDown}'); // clamps
    expect(active()).toHaveAttribute('data-qt-locale', 'ar');
    await user.keyboard('{Home}');
    expect(active()).toHaveAttribute('data-qt-locale', 'en');
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    // Menu closes and focus returns in the click itself; the page switches right after the next paint.
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(trigger).toHaveFocus();
    await waitFor(() => expect(trigger).toHaveTextContent('Deutsch'));
    expect(document.documentElement.lang).toBe('de');
  });

  it('typeahead (no search box) jumps by name', async () => {
    const { user, trigger } = renderSelector();
    await user.click(trigger);
    const listbox = await screen.findByRole('listbox');
    await waitFor(() => expect(listbox).toHaveFocus());
    await user.keyboard('d');
    expect(document.getElementById(listbox.getAttribute('aria-activedescendant')!)).toHaveAttribute(
      'data-qt-locale',
      'de',
    );
    await user.keyboard('{Enter}');
    await waitFor(() => expect(trigger).toHaveTextContent('Deutsch'));
  });

  it('Escape closes without changing and restores focus; Tab closes', async () => {
    const { user, trigger } = renderSelector();
    await user.click(trigger);
    await screen.findByRole('listbox');
    await user.keyboard('{ArrowDown}{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveTextContent('English');
    await user.click(trigger);
    await screen.findByRole('listbox');
    await user.keyboard('{Tab}');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('closes on outside press', async () => {
    const { user, trigger } = renderSelector();
    await user.click(trigger);
    await screen.findByRole('listbox');
    await user.click(screen.getByText('after'));
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('search: typing on the trigger seeds the query; matches native/English/code, diacritic-insensitive', async () => {
    const { user, trigger } = renderSelector(many);
    trigger.focus();
    await user.keyboard('f');
    const input = await screen.findByRole('combobox', { name: 'Search languages' });
    await waitFor(() => expect(input).toHaveFocus());
    expect(input).toHaveValue('f');
    const codes = () => screen.getAllByRole('option').map((o) => o.getAttribute('data-qt-locale'));
    expect(codes()).toEqual(['fr']);
    await user.clear(input);
    await user.type(input, 'japanese');
    expect(codes()).toEqual(['ja']);
    await user.clear(input);
    await user.type(input, 'espanol'); // ñ → n
    expect(codes()).toEqual(['es']);
    await user.clear(input);
    await user.type(input, 'pt-b');
    expect(codes()).toEqual(['pt-BR']);
    await user.clear(input);
    await user.type(input, '本');
    expect(codes()).toEqual(['ja']);
    await user.clear(input);
    await user.type(input, 'zzz');
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(screen.getByRole('status')).toHaveTextContent('No matches');
    await user.clear(input);
    await user.type(input, 'yoru{Enter}');
    await waitFor(() => expect(trigger).toHaveTextContent('Èdè Yorùbá'));
  });

  it('aria-activedescendant on the search combobox follows arrows', async () => {
    const { user, trigger } = renderSelector(many);
    await user.click(trigger);
    const input = await screen.findByRole('combobox', { name: 'Search languages' });
    expect(input).toHaveAttribute('aria-controls', screen.getByRole('listbox').id);
    await user.keyboard('{ArrowDown}');
    expect(document.getElementById(input.getAttribute('aria-activedescendant')!)).toHaveAttribute(
      'data-active',
    );
  });

  it('groups suggested locales from navigator.languages first', async () => {
    langs.mockReturnValue(['ar-EG', 'fr']);
    const { user, trigger } = renderSelector();
    await user.click(trigger);
    const suggested = await screen.findByRole('group', { name: 'Suggested' });
    expect(
      [...suggested.querySelectorAll('[role=option]')].map((o) => o.getAttribute('data-qt-locale')),
    ).toEqual(['ar', 'fr']);
    const rest = screen.getByRole('group', { name: 'All languages' });
    expect(
      [...rest.querySelectorAll('[role=option]')].map((o) => o.getAttribute('data-qt-locale')),
    ).toEqual(['en', 'de']);
  });

  it('prefetches messages on hover and on keyboard focus, once per locale', async () => {
    const prefetchMessages = vi.fn();
    const { user, trigger } = renderSelector(few, {}, { prefetchMessages });
    await user.click(trigger);
    await screen.findByRole('listbox');
    expect(prefetchMessages).toHaveBeenCalledWith('en'); // active on open
    await user.hover(screen.getByRole('option', { name: /Français/ }));
    expect(prefetchMessages).toHaveBeenCalledWith('fr');
    await user.keyboard('{ArrowDown}{ArrowDown}');
    expect(prefetchMessages).toHaveBeenCalledWith('de');
    await user.hover(screen.getByRole('option', { name: /Français/ }));
    expect(prefetchMessages.mock.calls.filter((c) => c[0] === 'fr')).toHaveLength(1);
  });

  it('switching to Arabic flips <html dir>', async () => {
    const { user, trigger } = renderSelector();
    await user.click(trigger);
    await user.click(await screen.findByRole('option', { name: /العربية/ }));
    await waitFor(() => expect(document.documentElement).toHaveAttribute('dir', 'rtl'));
    expect(trigger.closest('[data-qt-selector]')).toHaveAttribute('data-qt-current', 'ar');
  });

  it('virtualizes above the threshold and keeps aria-setsize/posinset', async () => {
    const big = defineLocales({
      locales: ['en', 'fr', 'de', 'es', 'it', 'pt', 'nl', 'sv', 'da', 'fi', 'pl', 'cs'],
    });
    const { user, trigger } = renderSelector(big, { virtualizeThreshold: 5, visibleItems: 3 });
    await user.click(trigger);
    await screen.findByRole('listbox');
    const opts = screen.getAllByRole('option');
    expect(opts.length).toBeLessThan(12);
    expect(opts[0]).toHaveAttribute('aria-setsize', '12');
    expect(opts[0]).toHaveAttribute('aria-posinset', '1');
    await user.keyboard('{End}');
    expect(screen.getAllByRole('option').at(-1)).toHaveAttribute('data-qt-locale', 'cs');
    expect(screen.getAllByRole('option').at(-1)).toHaveAttribute('aria-posinset', '12');
  });
});

describe('<LanguageSelector variant="native">', () => {
  it('renders a real <select> with the same accessible name and data hooks', async () => {
    const user = userEvent.setup();
    render(
      <LocaleProvider config={few} initialLocale="en">
        <LanguageSelector variant="native" />
      </LocaleProvider>,
    );
    // A <select> exposes its value separately, so its name stays the plain label.
    const select = screen.getByRole('combobox', { name: 'Select language' });
    expect(select.tagName).toBe('SELECT');
    expect(screen.getAllByRole('option').map((o) => o.getAttribute('data-qt-locale'))).toEqual([
      'en',
      'fr',
      'de',
      'ar',
    ]);
    expect(screen.getByRole('option', { name: 'Français — French' })).toBeInTheDocument();
    await user.selectOptions(select, 'fr');
    expect(select).toHaveValue('fr');
    expect(document.documentElement.lang).toBe('fr');
    // Names re-render in the new UI language.
    expect(screen.getByRole('option', { name: 'Deutsch — Allemand' })).toBeInTheDocument();
  });

  it('wraps in a form with hidden fields for the no-JS server action', () => {
    const { container } = render(
      <LocaleProvider config={few} initialLocale="en">
        <LanguageSelector variant="native" formAction="/api/locale" />
      </LocaleProvider>,
    );
    const form = container.querySelector('form')!;
    expect(form).toHaveAttribute('action', '/api/locale');
    expect(form).toHaveAttribute('data-qt-selector');
    const fd = new FormData(form);
    expect(fd.get('locale')).toBe('en');
    expect(fd.get('qt-locales')).toBe('en,fr,de,ar');
    expect(fd.get('qt-cookie')).toBe('NEXT_LOCALE');
  });
});

describe('headless', () => {
  it('useLanguageSelector drives custom markup', async () => {
    function Custom() {
      const s = useLanguageSelector();
      return (
        <div {...s.getRootProps()}>
          <button type="button" {...s.getTriggerProps()}>
            {s.current.nativeName}
          </button>
          {s.open && (
            <ul {...s.getListboxProps()}>
              {s.options.map((o, i) => (
                <li key={o.locale} {...s.getOptionProps(o, i)}>
                  {o.nativeName}
                </li>
              ))}
            </ul>
          )}
        </div>
      );
    }
    const user = userEvent.setup();
    render(
      <LocaleProvider config={few} initialLocale="en">
        <Custom />
      </LocaleProvider>,
    );
    await user.click(screen.getByRole('button', { name: /^Select language:/ }));
    await user.click(screen.getByRole('option', { name: 'Français' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^Select language:/ })).toHaveTextContent(
        'Français',
      ),
    );
    // Re-opening resets the active option to the new current locale.
    await user.click(screen.getByRole('button', { name: /^Select language:/ }));
    const lb = screen.getByRole('listbox');
    await waitFor(() => expect(lb).toHaveFocus());
    expect(document.getElementById(lb.getAttribute('aria-activedescendant')!)).toHaveAttribute(
      'data-qt-locale',
      'fr',
    );
  });

  it('LanguageSelector.Headless (code-split) renders after its chunk loads', async () => {
    render(
      <LocaleProvider config={few} initialLocale="de">
        <LanguageSelector.Headless>
          {(s) => <p>current: {s.current.nativeName}</p>}
        </LanguageSelector.Headless>
      </LocaleProvider>,
    );
    expect(await screen.findByText('current: Deutsch')).toBeInTheDocument();
  });
});

describe('search index', () => {
  it('normalizes once and matches word starts without per-item allocation', () => {
    expect(normalizeText('FRANÇAIS Èdè')).toBe('francais ede');
    const idx = createSearchIndex([
      ['fr', 'Français', 'French'],
      ['af', 'Afrikaans', 'Afrikaans'],
      ['pt-BR', 'Português (Brasil)', 'Brazilian Portuguese'],
    ]);
    expect(idx.search('fr')).toBe(1);
    expect(idx.matches[0]).toBe(0);
    expect(idx.search('bras')).toBe(1);
    expect(idx.matches[0]).toBe(2);
    expect(idx.search('')).toBe(3);
    const buf = idx.matches;
    idx.search('a');
    expect(idx.matches).toBe(buf); // same buffer reused
  });
});

describe('agent event', () => {
  it('fires qt:localechange on every change', async () => {
    const fn = vi.fn();
    window.addEventListener('qt:localechange', fn);
    const { user, trigger } = renderSelector();
    await user.click(trigger);
    await user.click(await screen.findByRole('option', { name: /Deutsch/ }));
    await waitFor(() => expect(fn).toHaveBeenCalledTimes(1));
    expect((fn.mock.calls[0]![0] as CustomEvent).detail).toEqual({ locale: 'de', previous: 'en' });
    window.removeEventListener('qt:localechange', fn);
    act(() => fireEvent.blur(trigger));
  });
});
