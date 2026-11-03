import { act, render, screen } from '@testing-library/react';
import { memo, Profiler, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { defineLocales, getDir } from '../src/core';
import { LocaleProvider, useLocale, useLocaleSelector, useSetLocale } from '../src/react';

const config = defineLocales({ locales: ['en', 'fr', 'ar'], defaultLocale: 'en' });

function setup(ui: ReactNode, props: Partial<Parameters<typeof LocaleProvider>[0]> = {}) {
  return render(
    <LocaleProvider config={config} initialLocale="en" {...props}>
      {ui}
    </LocaleProvider>,
  );
}

describe('useLocale / provider', () => {
  it('throws a helpful error without a provider', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const Bad = () => <>{useLocale().locale}</>;
    expect(() => render(<Bad />)).toThrow(/No <LocaleProvider> found/);
    err.mockRestore();
  });

  it('switch is optimistic: cookie, <html lang dir>, event, onLocaleChange, navigate', () => {
    const onLocaleChange = vi.fn();
    const navigate = vi.fn();
    const events: string[] = [];
    const onEvt = (e: CustomEvent<{ locale: string }>) => events.push(e.detail.locale);
    window.addEventListener('qt:localechange', onEvt);
    let api!: ReturnType<typeof useLocale>;
    const Grab = () => {
      api = useLocale();
      return <span data-testid="l">{api.locale}</span>;
    };
    setup(<Grab />, { onLocaleChange, navigate });
    act(() => {
      expect(api.setLocale('ar')).toBe(true);
    });
    expect(screen.getByTestId('l')).toHaveTextContent('ar');
    expect(document.cookie).toContain('NEXT_LOCALE=ar');
    expect(document.documentElement.lang).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
    expect(onLocaleChange).toHaveBeenCalledWith('ar', 'en');
    expect(navigate).toHaveBeenCalledWith('ar', 'en');
    expect(events).toEqual(['ar']);
    expect(api.dir).toBe('rtl');
    window.removeEventListener('qt:localechange', onEvt);
  });

  it('rejects unsupported locales without side effects', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const navigate = vi.fn();
    let api!: ReturnType<typeof useLocale>;
    const Grab = () => {
      api = useLocale();
      return null;
    };
    setup(<Grab />, { navigate });
    act(() => {
      expect(api.setLocale('xx' as 'en')).toBe(false);
    });
    expect(navigate).not.toHaveBeenCalled();
    expect(document.cookie).not.toContain('NEXT_LOCALE');
    warn.mockRestore();
  });

  it('follows initialLocale when the server sends a new one (router.refresh)', () => {
    const Show = () => <>{useLocale().locale}</>;
    const { rerender, container } = setup(<Show />);
    rerender(
      <LocaleProvider config={config} initialLocale="fr">
        <Show />
      </LocaleProvider>,
    );
    expect(container).toHaveTextContent('fr');
  });

  it('re-renders only components that read the locale', () => {
    const renders = { reader: 0, setterOnly: 0, unrelated: 0, derived: 0, tree: 0 };
    let set!: (l: 'en' | 'fr' | 'ar') => boolean;
    const Reader = memo(() => {
      renders.reader++;
      return <>{useLocale().locale}</>;
    });
    const SetterOnly = memo(() => {
      renders.setterOnly++;
      set = useSetLocale();
      return null;
    });
    const Unrelated = memo(() => {
      renders.unrelated++;
      return null;
    });
    // Derived selector: re-renders only when direction flips.
    const Derived = memo(() => {
      renders.derived++;
      return <>{useLocaleSelector((l: string) => getDir(l))}</>;
    });
    setup(
      <Profiler id="tree" onRender={() => renders.tree++}>
        <Reader />
        <SetterOnly />
        <Unrelated />
        <Derived />
      </Profiler>,
    );
    const base = { ...renders };
    act(() => void set('fr')); // ltr → ltr
    expect(renders.reader - base.reader).toBe(1);
    expect(renders.setterOnly - base.setterOnly).toBe(0);
    expect(renders.unrelated - base.unrelated).toBe(0);
    expect(renders.derived - base.derived).toBe(0);
    act(() => void set('ar')); // ltr → rtl
    expect(renders.reader - base.reader).toBe(2);
    expect(renders.derived - base.derived).toBe(1);
    expect(renders.setterOnly - base.setterOnly).toBe(0);
    expect(renders.unrelated - base.unrelated).toBe(0);
  });

  it('exposes window.quickTranslate when exposeAgentApi is on', () => {
    const Show = () => <span data-testid="l">{useLocale().locale}</span>;
    const { unmount } = setup(<Show />, { exposeAgentApi: true });
    const api = window.quickTranslate!;
    expect(api.getLocale()).toBe('en');
    expect(api.listLocales()).toEqual([
      { code: 'en', name: 'English', nativeName: 'English', dir: 'ltr', current: true },
      { code: 'fr', name: 'French', nativeName: 'Français', dir: 'ltr', current: false },
      { code: 'ar', name: 'Arabic', nativeName: 'العربية', dir: 'rtl', current: false },
    ]);
    act(() => {
      expect(api.setLocale('fr')).toBe(true);
    });
    expect(screen.getByTestId('l')).toHaveTextContent('fr');
    unmount();
    expect(window.quickTranslate).toBeUndefined();
  });

  it('does not expose the agent API by default', () => {
    setup(null);
    expect(window.quickTranslate).toBeUndefined();
  });
});
