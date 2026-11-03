import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { defineLocales } from '../src/core';
import {
  LanguageSelector,
  LocaleProvider,
  QuickTranslate,
  useLanguageSelector,
  useT,
} from '../src/react';

// Behaves like a regular language selector: no lazy loading, no waiting, every option in the DOM.

describe('regular-selector behavior, at full speed', () => {
  it('the menu opens synchronously on the very first click (nothing lazy-loaded)', async () => {
    const user = userEvent.setup();
    render(
      <LocaleProvider config={defineLocales(['en', 'fr', 'de'])} initialLocale="en">
        <LanguageSelector />
      </LocaleProvider>,
    );
    await user.click(screen.getByRole('button', { name: /^Select language:/ }));
    // getBy (not findBy): the listbox is there in the same commit as the click.
    expect(screen.getByRole('listbox', { name: 'Languages' })).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(3);
  });

  it('keeps every option in the DOM, even for long lists', async () => {
    const user = userEvent.setup();
    // 120 well-formed three-letter language codes: aaq, abq, … eqq.
    const many = Array.from(
      { length: 120 },
      (_, i) =>
        `${String.fromCharCode(97 + Math.floor(i / 26))}${String.fromCharCode(97 + (i % 26))}q`,
    );
    render(
      <LocaleProvider config={defineLocales(['en', ...many])} initialLocale="en">
        <LanguageSelector searchable={false} />
      </LocaleProvider>,
    );
    await user.click(screen.getByRole('button', { name: /^Select language:/ }));
    expect(screen.getAllByRole('option')).toHaveLength(121);
  });

  it('labels: exact names everywhere (trigger, menu, native select, agent API)', async () => {
    const user = userEvent.setup();
    const config = defineLocales({
      locales: ['en', 'yo'],
      labels: { yo: 'Yorùbá', en: 'English (US)' },
    });
    render(
      <LocaleProvider config={config} initialLocale="yo" exposeAgentApi>
        <LanguageSelector showTranslatedName={false} />
        <LanguageSelector variant="native" label="Native" showTranslatedName={false} />
      </LocaleProvider>,
    );
    const trigger = screen.getByRole('button', { name: /^Select language:/ });
    expect(trigger).toHaveTextContent('Yorùbá');
    expect(trigger).toHaveAccessibleName('Select language: Yorùbá');
    expect(screen.getByRole('option', { name: 'English (US)' })).toBeInTheDocument(); // native <option>
    expect(window.quickTranslate?.listLocales().map((l) => l.nativeName)).toEqual([
      'English (US)',
      'Yorùbá',
    ]);
    await user.click(trigger);
    expect(screen.getByRole('listbox').textContent).toContain('English (US)');
  });

  it('preloads every dictionary in idle time, so every switch is synchronous', async () => {
    const user = userEvent.setup();
    const dicts = { en: { hi: 'Hello' }, fr: { hi: 'Bonjour' }, de: { hi: 'Hallo' } };
    const load = vi.fn((l: string) => Promise.resolve(dicts[l as keyof typeof dicts]));
    const Hi = () => <h1>{useT()('hi')}</h1>;
    render(
      <QuickTranslate locales={['en', 'fr', 'de']} locale="en" messages={load}>
        <Hi />
        <LanguageSelector />
      </QuickTranslate>,
    );
    expect(await screen.findByRole('heading')).toHaveTextContent('Hello');
    // Idle preload fetched the others without any hover.
    await waitFor(() =>
      expect(load.mock.calls.map((c) => c[0]).sort()).toEqual(['de', 'en', 'fr']),
    );
    await new Promise((r) => setTimeout(r, 0));
    await user.click(screen.getByRole('button', { name: /^Select language:/ }));
    await user.click(screen.getByRole('option', { name: /Deutsch/ }));
    // The menu closes in the click; the page switches right after that paint, with no network wait
    // (the 50 ms cap is a frame or two, far below any request).
    await waitFor(() => expect(screen.getByRole('heading')).toHaveTextContent('Hallo'), {
      timeout: 50,
    });
    expect(load).toHaveBeenCalledTimes(3); // nothing re-fetched
  });

  it('prefetch="intent" keeps the old on-hover-only behavior', async () => {
    const load = vi.fn(() => Promise.resolve({ hi: 'x' }));
    render(
      <QuickTranslate locales={['en', 'fr', 'de']} locale="en" messages={load} prefetch="intent">
        <span>app</span>
      </QuickTranslate>,
    );
    await screen.findByText('app');
    await new Promise((r) => setTimeout(r, 400));
    expect(load).toHaveBeenCalledTimes(1); // only the first language
  });

  it('idle warm-up lays out every language name offscreen once, then cleans up', async () => {
    const append = vi.spyOn(document.body, 'append');
    render(
      <LocaleProvider config={defineLocales(['en', 'ja', 'ar'])} initialLocale="en">
        <LanguageSelector />
      </LocaleProvider>,
    );
    await waitFor(() => expect(append).toHaveBeenCalled());
    const box = append.mock.calls
      .map((c) => c[0] as HTMLElement)
      .find((n) => n.classList?.contains('qt-root'))!;
    expect(box.getAttribute('aria-hidden')).toBe('true');
    // An offscreen copy of the real menu: every language, normal and selected (bold) rows.
    const langs = [...box.querySelectorAll('.qt-native')].map((s) => s.getAttribute('lang'));
    expect(langs).toEqual(['en', 'ja', 'ar', 'en', 'ja', 'ar']);
    expect(box.isConnected).toBe(false); // removed right after layout
    append.mockRestore();
  });

  it('useLanguageSelector is available from the main entry', () => {
    expect(typeof useLanguageSelector).toBe('function');
  });
});
