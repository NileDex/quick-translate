import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Profiler } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { defineLocales } from '../src/core';
import { createTranslator } from '../src/messages';
import { LanguageSelector, LocaleProvider, useLocale, useMessages, useT } from '../src/react';

describe('createTranslator', () => {
  const t = createTranslator(
    {
      hi: 'Hello {name}',
      nested: { title: 'Title' },
      items: { zero: 'No items', one: '# item', other: '# items' },
      ar: { one: 'one', two: 'two', few: 'few', many: 'many', other: 'other' },
    },
    'en',
  );
  it('looks up nested keys and interpolates', () => {
    expect(t('hi', { name: 'Ada' })).toBe('Hello Ada');
    expect(t('hi')).toBe('Hello {name}');
    expect(t('nested.title')).toBe('Title');
  });
  it('plurals via Intl.PluralRules, # = formatted count', () => {
    expect(t('items', { count: 0 })).toBe('No items');
    expect(t('items', { count: 1 })).toBe('1 item');
    expect(t('items', { count: 1234 })).toBe('1,234 items');
    const ar = createTranslator(
      { n: { one: 'one', two: 'two', few: 'few', many: 'many', other: 'other' } },
      'ar',
    );
    expect(ar('n', { count: 2 })).toBe('two');
    expect(ar('n', { count: 5 })).toBe('few');
  });
  it('returns the key for missing messages (dev warning)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(t('nope.missing')).toBe('nope.missing');
    expect(createTranslator(undefined, 'en')('x')).toBe('x');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

const config = defineLocales({ locales: ['en', 'fr', 'de'] });
const dicts = {
  en: { title: 'Hello', body: 'Welcome', nav: { home: 'Home' } },
  fr: { title: 'Bonjour', body: 'Bienvenue', nav: { home: 'Accueil' } },
  de: { title: 'Hallo', body: 'Willkommen', nav: { home: 'Startseite' } },
};

function deferredLoader() {
  const calls: string[] = [];
  const resolvers = new Map<string, () => void>();
  const load = vi.fn(
    (l: string) =>
      new Promise<{ default: (typeof dicts)['en'] }>((resolve) => {
        calls.push(l);
        resolvers.set(l, () => resolve({ default: dicts[l as keyof typeof dicts] }));
      }),
  );
  return { load, calls, resolve: (l: string) => resolvers.get(l)?.() };
}

describe('whole-app switching with useT()', () => {
  function App() {
    return (
      <>
        <Title />
        <Body />
        <Nav />
      </>
    );
  }
  const Title = () => <h1>{useT()('title')}</h1>;
  const Body = () => <p>{useT()('body')}</p>;
  const Nav = () => <a href="/">{useT()('nav.home')}</a>;

  it('waits for the dictionary, then flips every component in one commit (no mixed languages)', async () => {
    const loader = deferredLoader();
    let commits = 0;
    let set!: (l: 'en' | 'fr' | 'de') => boolean;
    const Grab = () => {
      set = useLocale<'en' | 'fr' | 'de'>().setLocale;
      return null;
    };
    render(
      <LocaleProvider
        config={config}
        initialLocale="en"
        messages={dicts.en}
        loadMessages={loader.load}
      >
        <Profiler id="app" onRender={(_, phase) => phase === 'update' && commits++}>
          <Grab />
          <App />
        </Profiler>
      </LocaleProvider>,
    );
    expect(screen.getByRole('heading')).toHaveTextContent('Hello');
    expect(loader.load).not.toHaveBeenCalled(); // initial dictionary came from props

    act(() => void set('fr'));
    // Still fully English while French loads: nothing half-translated.
    expect(screen.getByRole('heading')).toHaveTextContent('Hello');
    expect(screen.getByText('Welcome')).toBeInTheDocument();
    expect(document.documentElement.lang).not.toBe('fr');

    await act(async () => loader.resolve('fr'));
    expect(screen.getByRole('heading')).toHaveTextContent('Bonjour');
    expect(screen.getByText('Bienvenue')).toBeInTheDocument();
    expect(screen.getByText('Accueil')).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('fr');
    expect(commits).toBe(1); // the whole tree switched in a single commit

    // Already-loaded locale: synchronous, instant.
    act(() => void set('en'));
    expect(screen.getByRole('heading')).toHaveTextContent('Hello');
    expect(loader.load).toHaveBeenCalledTimes(1);
  });

  it('a later click wins over a slower earlier one', async () => {
    const loader = deferredLoader();
    let set!: (l: 'en' | 'fr' | 'de') => boolean;
    const Grab = () => {
      set = useLocale<'en' | 'fr' | 'de'>().setLocale;
      return null;
    };
    render(
      <LocaleProvider
        config={config}
        initialLocale="en"
        messages={dicts.en}
        loadMessages={loader.load}
      >
        <Grab />
        <Title />
      </LocaleProvider>,
    );
    act(() => void set('fr'));
    act(() => void set('de'));
    await act(async () => loader.resolve('de'));
    expect(screen.getByRole('heading')).toHaveTextContent('Hallo');
    await act(async () => loader.resolve('fr'));
    expect(screen.getByRole('heading')).toHaveTextContent('Hallo');
  });

  it('hovering an option prefetches its dictionary, so the click switches synchronously', async () => {
    const user = userEvent.setup();
    const load = vi.fn((l: string) => Promise.resolve(dicts[l as keyof typeof dicts]));
    render(
      <LocaleProvider config={config} initialLocale="en" messages={dicts.en} loadMessages={load}>
        <LanguageSelector />
        <App />
        <RawDict />
      </LocaleProvider>,
    );
    await user.click(screen.getByRole('button', { name: /^Select language:/ }));
    await user.hover(await screen.findByRole('option', { name: /Deutsch/ }));
    expect(load).toHaveBeenCalledWith('de');
    await waitFor(() => expect(load.mock.results.at(-1)?.value).resolves.toBeDefined());
    await user.click(screen.getByRole('option', { name: /Deutsch/ }));
    await waitFor(() => expect(screen.getByRole('heading')).toHaveTextContent('Hallo'));
    expect(screen.getByText('Startseite')).toBeInTheDocument();
    expect(screen.getByTestId('raw')).toHaveTextContent('Willkommen');
    expect(load.mock.calls.filter((c) => c[0] === 'de')).toHaveLength(1);
  });

  function RawDict() {
    return <span data-testid="raw">{useMessages<(typeof dicts)['en']>()?.body}</span>;
  }
});

describe('selector display options', () => {
  it('display="code", check mark, badges, native names only', async () => {
    const user = userEvent.setup();
    render(
      <LocaleProvider config={config} initialLocale="en">
        <LanguageSelector display="code" showTranslatedName={false} badges={{ fr: 'Preview' }} />
      </LocaleProvider>,
    );
    const trigger = screen.getByRole('button', { name: /^Select language:/ });
    expect(trigger).toHaveTextContent('EN');
    expect(trigger).toHaveAccessibleName('Select language: EN');
    await user.click(trigger);
    const fr = await screen.findByRole('option', { name: /Français/ });
    expect(fr).toHaveTextContent('FrançaisPreview');
    expect(fr.querySelector('.qt-name')).toBeNull();
    expect(
      screen.getByRole('option', { name: /English/ }).querySelector('.qt-check'),
    ).toHaveTextContent('✓');
    expect(fr.querySelector('.qt-check')).toHaveTextContent('');
  });
});
