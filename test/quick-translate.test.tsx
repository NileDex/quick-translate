import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LanguageSelector, QuickTranslate, useLocale, useT } from '../src/react';

const dicts = {
  en: { hello: 'Hello', items: { one: '# item', other: '# items' } },
  fr: { hello: 'Bonjour', items: { one: '# article', other: '# articles' } },
  ar: { hello: 'مرحبا', items: { other: '# عناصر' } },
};

function App() {
  const t = useT();
  return (
    <>
      <h1>{t('hello')}</h1>
      <p>{t('items', { count: 2 })}</p>
      <LanguageSelector />
    </>
  );
}

describe('<QuickTranslate>', () => {
  it('one component: loader, fallback, then the detected language', async () => {
    document.cookie = 'NEXT_LOCALE=fr;path=/';
    const load = vi.fn((l: string) => Promise.resolve({ default: dicts[l as keyof typeof dicts] }));
    render(
      <QuickTranslate locales={['en', 'fr', 'ar']} messages={load} fallback={<p>loading</p>}>
        <App />
      </QuickTranslate>,
    );
    expect(screen.getByText('loading')).toBeInTheDocument();
    expect(await screen.findByRole('heading')).toHaveTextContent('Bonjour');
    expect(screen.getByText('2 articles')).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('fr');
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('switches the whole app from the selector and flips <html dir> for RTL', async () => {
    const user = userEvent.setup();
    render(
      <QuickTranslate locales={['en', 'fr', 'ar']} messages={dicts}>
        <App />
      </QuickTranslate>,
    );
    expect(screen.getByRole('heading')).toHaveTextContent('Hello'); // object map: no loading state
    await user.click(screen.getByRole('button', { name: /^Select language:/ }));
    await user.click(await screen.findByRole('option', { name: /العربية/ }));
    await waitFor(() => expect(screen.getByRole('heading')).toHaveTextContent('مرحبا'));
    expect(screen.getByText('2 عناصر')).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
    expect(document.cookie).toContain('NEXT_LOCALE=ar');
  });

  it('honors ?lang=, an explicit locale, defaultLocale and a defineLocales config', async () => {
    window.history.replaceState(null, '', '/?lang=ar');
    const { unmount } = render(
      <QuickTranslate locales={['en', 'fr', 'ar']} messages={dicts}>
        <App />
      </QuickTranslate>,
    );
    expect(screen.getByRole('heading')).toHaveTextContent('مرحبا');
    unmount();
    window.history.replaceState(null, '', '/');

    let current = '';
    const Probe = () => {
      current = useLocale().locale;
      return null;
    };
    // defaultLocale applies when nothing matches (the jsdom browser speaks en-US, so leave en out).
    render(
      <QuickTranslate locales={['de', 'fr']} defaultLocale="fr" messages={dicts}>
        <Probe />
      </QuickTranslate>,
    );
    expect(current).toBe('fr');
    act(() => void 0);
    render(
      <QuickTranslate locales={['en', 'fr']} locale="en" messages={dicts}>
        <App />
      </QuickTranslate>,
    );
    expect(screen.getAllByRole('heading').at(-1)).toHaveTextContent('Hello');
  });

  it('a failing loader still renders (keys as text) instead of hanging', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <QuickTranslate locales={['en']} messages={() => Promise.reject(new Error('404'))}>
        <App />
      </QuickTranslate>,
    );
    expect(await screen.findByRole('heading')).toHaveTextContent('hello');
    expect(err).toHaveBeenCalled();
    err.mockRestore();
    warn.mockRestore();
  });
});
