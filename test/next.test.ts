// @vitest-environment node
import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { defineLocales } from '../src/core';
import { createLocaleMiddleware, LOCALE_HEADER } from '../src/next/middleware';

const config = defineLocales({
  locales: ['en', 'fr', 'ar', 'pt-BR'],
  defaultLocale: 'en',
  queryParam: 'lang',
});
const mw = createLocaleMiddleware(config, { prefixedPaths: ['/docs'] });

const req = (path: string, headers: Record<string, string> = {}) =>
  new NextRequest(new URL(path, 'http://localhost:3000'), { headers });

// NextResponse.next({ request: { headers } }) encodes forwarded request headers like this:
const forwarded = (res: Response, name: string) => res.headers.get(`x-middleware-request-${name}`);

describe('createLocaleMiddleware', () => {
  it('cookie strategy: forwards the resolved locale (cookie > accept-language > default)', () => {
    let res = mw(req('/', { 'accept-language': 'fr-CH,fr;q=0.9' }));
    expect(forwarded(res, LOCALE_HEADER)).toBe('fr');
    expect(res.headers.get('content-language')).toBe('fr');
    expect(res.cookies.get('NEXT_LOCALE')).toBeUndefined(); // detected, not explicit → no cookie

    res = mw(req('/', { cookie: 'NEXT_LOCALE=ar', 'accept-language': 'fr' }));
    expect(forwarded(res, LOCALE_HEADER)).toBe('ar');

    res = mw(req('/', { 'accept-language': 'pt-PT' }));
    expect(forwarded(res, LOCALE_HEADER)).toBe('pt-BR');

    res = mw(req('/', { 'accept-language': 'ja' }));
    expect(forwarded(res, LOCALE_HEADER)).toBe('en');
  });

  it('?lang= override wins and is persisted', () => {
    const res = mw(req('/?lang=ar', { cookie: 'NEXT_LOCALE=fr' }));
    expect(forwarded(res, LOCALE_HEADER)).toBe('ar');
    expect(res.cookies.get('NEXT_LOCALE')?.value).toBe('ar');
  });

  it('path-prefix: redirects unprefixed scoped paths to the preferred locale', () => {
    const res = mw(req('/docs/intro?x=1', { cookie: 'NEXT_LOCALE=fr' }));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/fr/docs/intro?x=1');
  });

  it('path-prefix: a prefixed URL sets the locale and persists it', () => {
    const res = mw(req('/ar/docs', { cookie: 'NEXT_LOCALE=fr' }));
    expect(res.status).toBe(200);
    expect(forwarded(res, LOCALE_HEADER)).toBe('ar');
    expect(res.cookies.get('NEXT_LOCALE')?.value).toBe('ar');
  });

  it('path-prefix + ?lang= redirects to the clean prefixed URL', () => {
    const res = mw(req('/fr/docs?lang=pt-br'));
    expect(res.headers.get('location')).toBe('http://localhost:3000/pt-BR/docs');
    expect(res.cookies.get('NEXT_LOCALE')?.value).toBe('pt-BR');
  });

  it('does not touch unrelated paths', () => {
    const res = mw(req('/documents'));
    expect(res.status).toBe(200);
    expect(forwarded(res, LOCALE_HEADER)).toBe('en');
  });

  it('ignores spoofed / invalid cookie values', () => {
    const res = mw(req('/', { cookie: 'NEXT_LOCALE=<script>' }));
    expect(forwarded(res, LOCALE_HEADER)).toBe('en');
  });
});
