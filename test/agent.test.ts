import { describe, expect, it } from 'vitest';
import {
  createLocaleTools,
  getLocaleToolDefinitions,
  toMCPTools,
  toOpenAITools,
} from '../src/agent';
import { createLocaleStore, defineLocales } from '../src/core';

const config = defineLocales({ locales: ['en', 'fr', 'ar'] });

describe('agent tools', () => {
  it('defines three tools in Anthropic format, with an enum when given a config', () => {
    const defs = getLocaleToolDefinitions(config);
    expect(defs.map((d) => d.name)).toEqual(['get_locale', 'list_locales', 'set_locale']);
    const set = defs.find((d) => d.name === 'set_locale')!;
    expect(set.input_schema).toEqual({
      type: 'object',
      properties: {
        locale: { type: 'string', description: expect.any(String), enum: ['en', 'fr', 'ar'] },
      },
      required: ['locale'],
      additionalProperties: false,
    });
    expect(getLocaleToolDefinitions()[2]!.input_schema.properties!.locale!.enum).toBeUndefined();
  });

  it('converts to OpenAI and MCP formats', () => {
    const defs = getLocaleToolDefinitions(config);
    expect(toOpenAITools(defs)[0]).toEqual({
      type: 'function',
      function: {
        name: 'get_locale',
        description: defs[0]!.description,
        parameters: defs[0]!.input_schema,
      },
    });
    expect(toMCPTools(defs)[2]).toMatchObject({
      name: 'set_locale',
      inputSchema: defs[2]!.input_schema,
    });
  });

  it('handlers operate a store and return model-friendly results', () => {
    const store = createLocaleStore(config);
    const tools = createLocaleTools(store);
    expect(tools.call('get_locale')).toEqual({ ok: true, locale: 'en' });
    expect(tools.call('set_locale', { locale: 'fr' })).toEqual({
      ok: true,
      locale: 'fr',
      previous: 'en',
    });
    expect(store.getLocale()).toBe('fr');
    const bad = tools.call('set_locale', { locale: 'xx' });
    expect(bad).toEqual({ ok: false, error: 'Unsupported locale "xx". Supported: en, fr, ar.' });
    expect(tools.call('nope')).toMatchObject({ ok: false });
    expect(tools.call('list_locales')).toEqual({
      ok: true,
      locales: [
        { code: 'en', name: 'English', nativeName: 'English', dir: 'ltr', current: false },
        { code: 'fr', name: 'French', nativeName: 'Français', dir: 'ltr', current: true },
        { code: 'ar', name: 'Arabic', nativeName: 'العربية', dir: 'rtl', current: false },
      ],
    });
    expect(tools.definitions[2]!.input_schema.properties!.locale!.enum).toEqual(['en', 'fr', 'ar']);
  });

  it('works against a window.quickTranslate-like object', () => {
    let cur = 'en';
    const tools = createLocaleTools({
      getLocale: () => cur,
      setLocale: (l) => (['en', 'fr'].includes(l) ? ((cur = l), true) : false),
      listLocales: () => [{ code: 'en' }, { code: 'fr' }],
    });
    expect(tools.call('set_locale', { locale: 'fr' })).toMatchObject({ ok: true, locale: 'fr' });
  });
});
