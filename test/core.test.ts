import { describe, expect, it, vi } from 'vitest';
import {
  createLocaleStore,
  defineLocales,
  detectLocale,
  getDir,
  getFlag,
  getLanguageName,
  isLocale,
  localeFromPath,
  localizePath,
  matchLocale,
  parseAcceptLanguage,
  readCookie,
  resolveLocale,
  serializeLocaleCookie,
} from '../src/core';

const config = defineLocales({
  locales: ['en', 'fr', 'de', 'pt', 'pt-BR', 'ar', 'zh-Hans'],
  defaultLocale: 'en',
  queryParam: 'lang',
});

describe('defineLocales', () => {
  it('fills defaults and freezes', () => {
    expect(config.strategy).toBe('cookie');
    expect(config.cookieName).toBe('NEXT_LOCALE');
    expect(Object.isFrozen(config)).toBe(true);
  });
  it('array shorthand uses the first locale as default', () => {
    const c = defineLocales(['ja', 'en'] as const);
    expect(c.defaultLocale).toBe('ja');
    expect(c.queryParam).toBe(false);
  });
  it('throws helpful errors in development', () => {
    expect(() => defineLocales({ locales: ['en'], defaultLocale: 'fr' as 'en' })).toThrow(
      /not in locales/,
    );
    expect(() => defineLocales({ locales: [] as string[] })).toThrow(/empty/);
    expect(() => defineLocales({ locales: ['en', 'not a tag!'] })).toThrow(/BCP 47/);
  });
});

describe('parseAcceptLanguage', () => {
  it('orders by q-value, keeps header order for ties, drops q=0 and *', () => {
    expect(parseAcceptLanguage('fr-CH, fr;q=0.9, en;q=0.8, de;q=0.7, *;q=0.5')).toEqual([
      'fr-CH',
      'fr',
      'en',
      'de',
    ]);
    expect(parseAcceptLanguage('en;q=0.5, de, ja;q=0')).toEqual(['de', 'en']);
    expect(parseAcceptLanguage('da, en-GB;q=0.8, en;q=0.7')).toEqual(['da', 'en-GB', 'en']);
    expect(parseAcceptLanguage('  es ;  q = 0.3 ,  it ')).toEqual(['it', 'es']);
  });
  it('handles empty / missing headers', () => {
    expect(parseAcceptLanguage('')).toEqual([]);
    expect(parseAcceptLanguage(null)).toEqual([]);
    expect(parseAcceptLanguage(undefined)).toEqual([]);
  });
});

describe('matchLocale', () => {
  const ls = ['en', 'fr', 'pt-BR', 'zh-Hans'] as const;
  it('exact, case-insensitive', () => {
    expect(matchLocale('FR', ls)).toBe('fr');
    expect(matchLocale('pt-br', ls)).toBe('pt-BR');
  });
  it('falls back pt-BR → pt → default via resolveLocale', () => {
    // pt-BR requested, only pt supported → pt
    expect(matchLocale('pt-BR', ['en', 'pt'])).toBe('pt');
    // nothing matches → undefined (resolveLocale then uses defaultLocale)
    expect(matchLocale('pt-BR', ['en', 'fr'])).toBeUndefined();
    const c = defineLocales({ locales: ['en', 'fr'] });
    expect(resolveLocale(c, { acceptLanguage: 'pt-BR,pt;q=0.9' })).toBe('en');
  });
  it('matches another region of the same language', () => {
    expect(matchLocale('pt-PT', ls)).toBe('pt-BR');
    expect(matchLocale('zh-Hans-CN', ls)).toBe('zh-Hans');
    expect(matchLocale('fr-CA', ls)).toBe('fr');
  });
  it('is script-aware: Traditional prefers Traditional, other scripts only as a last resort', () => {
    expect(matchLocale('zh-TW', ['en', 'zh-Hans', 'zh-Hant'])).toBe('zh-Hant');
    expect(matchLocale('zh-HK', ['zh-Hans', 'zh-Hant'])).toBe('zh-Hant');
    expect(matchLocale('zh-CN', ['zh-Hant', 'zh-Hans'])).toBe('zh-Hans');
    expect(matchLocale('zh', ['zh-Hant', 'zh-Hans'])).toBe('zh-Hans');
    // A Traditional reader who also reads English gets English, not Simplified…
    expect(matchLocale(['zh-TW', 'en'], ['zh-Hans', 'en'])).toBe('en');
    // …but Simplified beats nothing at all.
    expect(matchLocale(['zh-TW'], ['zh-Hans', 'en'])).toBe('zh-Hans');
    expect(matchLocale('sr-Latn-RS', ['sr-Cyrl', 'sr-Latn'])).toBe('sr-Latn');
    expect(matchLocale('pt-PT', ['en', 'pt-BR'])).toBe('pt-BR'); // same script, other region
  });
  it('respects preference order', () => {
    expect(matchLocale(['de', 'fr', 'en'], ls)).toBe('fr');
  });
});

describe('resolveLocale', () => {
  it('query → path → cookie → accept-language → default', () => {
    const all = {
      search: '?lang=de',
      pathname: '/ar/docs',
      cookieHeader: 'a=1; NEXT_LOCALE=fr',
      acceptLanguage: 'pt-BR',
    };
    expect(resolveLocale(config, all)).toBe('de');
    expect(resolveLocale(config, { ...all, search: '' })).toBe('ar');
    expect(resolveLocale(config, { ...all, search: '', pathname: '/docs' })).toBe('fr');
    expect(resolveLocale(config, { acceptLanguage: 'pt-BR,en;q=0.5' })).toBe('pt-BR');
    expect(resolveLocale(config, { acceptLanguage: 'pt-PT' })).toBe('pt');
    expect(resolveLocale(config, {})).toBe('en');
  });
  it('ignores unsupported cookie and query values', () => {
    expect(resolveLocale(config, { cookie: 'xx', search: '?lang=xx', acceptLanguage: 'de' })).toBe(
      'de',
    );
  });
  it('ignores ?lang= when queryParam is disabled', () => {
    const c = defineLocales({ locales: ['en', 'fr'] });
    expect(resolveLocale(c, { search: '?lang=fr' })).toBe('en');
  });
  it('domain strategy', () => {
    const c = defineLocales({
      locales: ['en', 'fr'],
      strategy: 'domain',
      domains: { 'example.fr': 'fr', 'example.com': 'en' },
    });
    expect(resolveLocale(c, { host: 'example.fr:3000', acceptLanguage: 'en' })).toBe('fr');
  });
  it('detectLocale reads the browser', () => {
    document.cookie = 'NEXT_LOCALE=ar;path=/';
    expect(detectLocale(config)).toBe('ar');
  });
});

describe('paths', () => {
  const ls = config.locales;
  it('localeFromPath', () => {
    expect(localeFromPath('/fr/docs', ls)).toBe('fr');
    expect(localeFromPath('/docs', ls)).toBeUndefined();
    expect(localeFromPath('/', ls)).toBeUndefined();
  });
  it('localizePath swaps or adds the prefix', () => {
    expect(localizePath('/fr/docs/a', 'de', ls)).toBe('/de/docs/a');
    expect(localizePath('/docs', 'de', ls)).toBe('/de/docs');
    expect(localizePath('/', 'de', ls)).toBe('/de');
    expect(localizePath('/fr', 'de', ls)).toBe('/de');
    expect(localizePath('/fr/', 'de', ls)).toBe('/de');
  });
});

describe('cookies', () => {
  it('reads one cookie among many and decodes it', () => {
    expect(readCookie('a=1; NEXT_LOCALE=pt-BR; b=2', 'NEXT_LOCALE')).toBe('pt-BR');
    expect(readCookie('XNEXT_LOCALE=fr', 'NEXT_LOCALE')).toBeUndefined();
    expect(readCookie('NEXT_LOCALE=%E0%A4', 'NEXT_LOCALE')).toBeUndefined();
    expect(readCookie(undefined, 'x')).toBeUndefined();
  });
  it('serializes with path, max-age and samesite', () => {
    expect(serializeLocaleCookie(config, 'fr')).toBe(
      'NEXT_LOCALE=fr;path=/;max-age=31536000;samesite=lax',
    );
  });
});

describe('Intl helpers', () => {
  it('getDir', () => {
    for (const l of ['ar', 'he', 'fa', 'ur', 'ar-EG', 'az-Arab', 'ckb'])
      expect(getDir(l)).toBe('rtl');
    for (const l of ['en', 'arn', 'fr', 'zh-Hans', 'hi', 'yo']) expect(getDir(l)).toBe('ltr');
  });
  it('getLanguageName uses Intl.DisplayNames, capitalized', () => {
    expect(getLanguageName('fr')).toBe('Français');
    expect(getLanguageName('fr', 'en')).toBe('French');
    expect(getLanguageName('de', 'fr')).toBe('Allemand');
    expect(getLanguageName('ja')).toBe('日本語');
  });
  it('getLanguageName falls back when Intl.DisplayNames is missing', async () => {
    vi.resetModules();
    const intl = Intl as { DisplayNames: unknown };
    const orig = intl.DisplayNames;
    intl.DisplayNames = undefined; // simulate an old runtime
    try {
      const { getLanguageName: fresh } = await import('../src/core/intl');
      expect(fresh('fr-CA', 'xx')).toBe('Français');
      expect(fresh('yo', 'xx')).toBe('Yo');
    } finally {
      intl.DisplayNames = orig;
    }
  });
  it('getFlag derives a region flag', () => {
    expect(getFlag('fr')).toBe('🇫🇷');
    expect(getFlag('pt-BR')).toBe('🇧🇷');
    expect(getFlag('not-a-locale!!')).toBe('');
  });
  it('isLocale', () => {
    expect(isLocale(config, 'fr')).toBe(true);
    expect(isLocale(config, 'FR')).toBe(false);
    expect(isLocale(config, 3)).toBe(false);
  });
});

describe('createLocaleStore', () => {
  it('notifies subscribers only on change', () => {
    const store = createLocaleStore(config, 'fr');
    const fn = vi.fn();
    const off = store.subscribe(fn);
    expect(store.setLocale('fr')).toBe(true);
    expect(fn).not.toHaveBeenCalled();
    expect(store.setLocale('DE')).toBe(true);
    expect(store.getLocale()).toBe('de');
    expect(fn).toHaveBeenCalledWith('de', 'fr');
    off();
    store.setLocale('en');
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it('rejects unsupported locales with a dev warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const store = createLocaleStore(config);
    expect(store.setLocale('xx')).toBe(false);
    expect(store.getLocale()).toBe('en');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('not one of'));
    warn.mockRestore();
  });
  it('falls back to the default for an unsupported initial value', () => {
    expect(createLocaleStore(config, 'xx').getLocale()).toBe('en');
  });
});
