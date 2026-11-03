/**
 * `quick-translate-sdk/agent`: tool definitions (`get_locale`, `set_locale`, `list_locales`) for LLM tool
 * calling (Anthropic, OpenAI, MCP) plus handlers bound to a locale store or `window.quickTranslate`.
 *
 * @packageDocumentation
 */
import { getDir, getLanguageName, type LocaleConfig } from 'quick-translate-sdk';

/** Minimal JSON Schema subset used by the tools. */
export interface JSONSchema {
  type: 'object' | 'string';
  description?: string;
  properties?: Record<string, JSONSchema>;
  required?: string[];
  enum?: string[];
  additionalProperties?: boolean;
}

/** Tool definition in Anthropic Messages API format (`input_schema`). */
export interface ToolDefinition {
  name: 'get_locale' | 'set_locale' | 'list_locales';
  description: string;
  input_schema: JSONSchema;
}

const empty: JSONSchema = { type: 'object', properties: {}, additionalProperties: false };

/**
 * Returns the three locale tools. Pass a config (or a locale list) to constrain `set_locale` with an `enum`.
 *
 * @example
 * ```ts
 * await anthropic.messages.create({ model, tools: getLocaleToolDefinitions(locales), messages });
 * ```
 */
export function getLocaleToolDefinitions(
  config?: LocaleConfig | readonly string[],
): ToolDefinition[] {
  const list = config ? ('locales' in config ? config.locales : config) : undefined;
  return [
    {
      name: 'get_locale',
      description: 'Get the current UI language (BCP 47 locale code, e.g. "en", "pt-BR").',
      input_schema: empty,
    },
    {
      name: 'list_locales',
      description:
        'List the languages the app supports, with English and native names, text direction, and which one is current.',
      input_schema: empty,
    },
    {
      name: 'set_locale',
      description:
        'Change the UI language. Use a code returned by list_locales. The page updates in place and the choice is saved in a cookie.',
      input_schema: {
        type: 'object',
        properties: {
          locale: {
            type: 'string',
            description: 'BCP 47 locale code, e.g. "fr".',
            ...(list ? { enum: [...list] } : {}),
          },
        },
        required: ['locale'],
        additionalProperties: false,
      },
    },
  ];
}

/** OpenAI Chat Completions / Responses `tools` format. */
export function toOpenAITools(defs: ToolDefinition[] = getLocaleToolDefinitions()) {
  return defs.map((d) => ({
    type: 'function' as const,
    function: { name: d.name, description: d.description, parameters: d.input_schema },
  }));
}

/** Model Context Protocol `tools/list` format (`inputSchema`). */
export function toMCPTools(defs: ToolDefinition[] = getLocaleToolDefinitions()) {
  return defs.map((d) => ({
    name: d.name,
    description: d.description,
    inputSchema: d.input_schema,
  }));
}

/** Anything that can read and change the locale: a `LocaleStore` or `window.quickTranslate`. */
export interface LocaleTarget {
  getLocale(): string;
  setLocale(locale: string): boolean;
  config?: { locales: readonly string[] };
  listLocales?(): { code: string }[];
}

/** Result of a tool call. `ok: false` carries a message the model can act on. */
export type ToolResult =
  | { ok: true; locale: string; previous?: string }
  | {
      ok: true;
      locales: {
        code: string;
        name: string;
        nativeName: string;
        dir: 'ltr' | 'rtl';
        current: boolean;
      }[];
    }
  | { ok: false; error: string };

/**
 * Binds the tools to a store (or `window.quickTranslate`).
 *
 * @example
 * ```ts
 * const tools = createLocaleTools(store);
 * const result = tools.call(toolUse.name, toolUse.input); // → tool_result content
 * ```
 */
export function createLocaleTools(target: LocaleTarget) {
  const codes = () => target.config?.locales ?? target.listLocales?.().map((l) => l.code) ?? [];
  const handlers = {
    get_locale: (): ToolResult => ({ ok: true, locale: target.getLocale() }),
    list_locales: (): ToolResult => ({
      ok: true,
      locales: codes().map((code) => ({
        code,
        name: getLanguageName(code, 'en'),
        nativeName: getLanguageName(code),
        dir: getDir(code),
        current: code === target.getLocale(),
      })),
    }),
    set_locale: (input: { locale?: unknown }): ToolResult => {
      const previous = target.getLocale();
      const locale = typeof input?.locale === 'string' ? input.locale : '';
      return target.setLocale(locale)
        ? { ok: true, locale: target.getLocale(), previous }
        : { ok: false, error: `Unsupported locale "${locale}". Supported: ${codes().join(', ')}.` };
    },
  };
  return {
    definitions: getLocaleToolDefinitions(codes()),
    handlers,
    /** Dispatches a tool call by name. Unknown names return `{ ok: false }`. */
    call(name: string, input: unknown = {}): ToolResult {
      const h = handlers[name as keyof typeof handlers];
      return h ? h(input as { locale?: unknown }) : { ok: false, error: `Unknown tool "${name}".` };
    },
  };
}
