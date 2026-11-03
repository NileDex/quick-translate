# quick-translate-sdk

A very fast language selector for **React 18/19** and **Next.js 14/15** that switches your **whole app** to another language instantly, with no reload. Your **AI assistant's replies** switch with it. It ships with a tiny built-in translator and is built to be operated by AI agents.

- **Instant, atomic switch.** Hovering an option prefetches its dictionary. The click flips every `useT()` in the app in a single React commit, so you never see a half-translated page or a reload.
- **No flash of the wrong language.** The server resolves the locale (cookie → `Accept-Language` → default), renders `<html lang dir>`, and the client hydrates from the same value.
- **Behaves like a regular selector, but faster.** Nothing is lazy-loaded: the menu opens on the first click, and every option is always in the page. Every language is preloaded in idle time, so every switch is synchronous: one frame (16 ms) to respond, and 6–16 ms until the whole page is translated.
- **Small.** 6.1 kB min+gzip for provider + complete selector (7.1 kB with `<QuickTranslate>` + translator). Zero runtime dependencies, and no language-name data is shipped (names come from `Intl.DisplayNames`, or your own `labels`).
- **AI replies in the chosen language.** `useAiLanguage()` sends the locale with each AI request, and `getLanguageInstruction()` turns it into a system-prompt instruction for Claude or any other model.
- **Agent-friendly.** Stable roles and accessible names, `data-qt-*` hooks, an opt-in `window.quickTranslate` API, `?lang=` deep links, and JSON-Schema tool definitions for Anthropic, OpenAI and MCP.

```
sdk/         this folder: the quick-translate-sdk npm package
react-app/   React + Vite app that uses it (run it to try everything)
```

---

## Quick start (React: Vite, CRA, any SPA)

**1. Install**

```bash
npm i quick-translate-sdk
```

**2. Wrap your app once**, listing your languages and where their JSON files are:

```tsx
// main.tsx
import { QuickTranslate } from 'quick-translate-sdk/react';
import 'quick-translate-sdk/styles.css';

createRoot(document.getElementById('root')!).render(
  <QuickTranslate locales={['en', 'fr', 'ar']} messages={(l) => import(`./messages/${l}.json`)}>
    <App />
  </QuickTranslate>,
);
```

```json
// messages/en.json  (same keys in fr.json, ar.json…)
{ "title": "Hello", "cart": { "one": "# item", "other": "# items" } }
```

**3. Use it anywhere**

```tsx
import { LanguageSelector, useT } from 'quick-translate-sdk/react';

export function App() {
  const t = useT();
  return (
    <>
      <LanguageSelector />
      <h1>{t('title')}</h1>
      <p>{t('cart', { count: 3 })}</p>
    </>
  );
}
```

That's all. `<QuickTranslate>`:

- detects the user's language (`?lang=` → saved choice → browser languages → first locale);
- loads that file before the first paint and sets `<html lang dir>`;
- switches the whole app instantly when the user picks another language, with no reload, remembering the choice.

Options: `defaultLocale`, `locale` (force one), `messages={{ en, fr }}` (all files bundled, no loading), `fallback` (shown while the first file loads), `exposeAgentApi`, `onLocaleChange`.

A working app is in [`../react-app`](../react-app). Run `pnpm install && pnpm dev` there.

## Supported languages

**Any language works.** quick-translate-sdk ships no fixed list and no language data. You pass any standard language code (BCP 47: `fr`, `pt-BR`, `zh-Hant`, `sr-Latn`…), and for each one the SDK provides:

- **Its name**, in the language itself and in the current UI language, from the browser's `Intl.DisplayNames`. You can override names with `labels`.
- **Plural rules** (`one`, `two`, `few`, `many`…) from `Intl.PluralRules`, plus number, currency and date formats from `Intl`.
- **Right-to-left layout**, detected automatically for Arabic, Hebrew, Persian, Urdu, Pashto, Sindhi, Uyghur, Yiddish, Kurdish (Sorani) and Arabic/Hebrew-script variants.
- **Script-aware matching** of the visitor's browser languages (`zh-TW` → `zh-Hant`).

You supply the translations: one JSON file per language you list in `locales`.

These 107 languages and regional variants are widely used and well supported by browsers. The names below come from full Unicode language data (CLDR). A browser with less data can show a few in English; for example, Chrome shows "Yoruba" for `yo`. Set `labels` to pin any name.

<details>
<summary>Show all 107 languages</summary>

| Code | Language | Native name | Direction |
| --- | --- | --- | --- |
| `af` | Afrikaans | Afrikaans | LTR |
| `am` | Amharic | አማርኛ | LTR |
| `ar` | Arabic | العربية | RTL |
| `as` | Assamese | অসমীয়া | LTR |
| `az` | Azerbaijani | Azərbaycan | LTR |
| `be` | Belarusian | Беларуская | LTR |
| `bg` | Bulgarian | Български | LTR |
| `bn` | Bangla | বাংলা | LTR |
| `bs` | Bosnian | Bosanski | LTR |
| `ca` | Catalan | Català | LTR |
| `cs` | Czech | Čeština | LTR |
| `cy` | Welsh | Cymraeg | LTR |
| `da` | Danish | Dansk | LTR |
| `de` | German | Deutsch | LTR |
| `de-AT` | Austrian German | Österreichisches Deutsch | LTR |
| `de-CH` | Swiss High German | Schweizer Hochdeutsch | LTR |
| `el` | Greek | Ελληνικά | LTR |
| `en` | English | English | LTR |
| `en-AU` | Australian English | Australian English | LTR |
| `en-CA` | Canadian English | Canadian English | LTR |
| `en-GB` | British English | British English | LTR |
| `en-IN` | English (India) | English (India) | LTR |
| `en-US` | American English | American English | LTR |
| `es` | Spanish | Español | LTR |
| `es-419` | Latin American Spanish | Español latinoamericano | LTR |
| `es-MX` | Mexican Spanish | Español de México | LTR |
| `et` | Estonian | Eesti | LTR |
| `eu` | Basque | Euskara | LTR |
| `fa` | Persian | فارسی | RTL |
| `fi` | Finnish | Suomi | LTR |
| `fil` | Filipino | Filipino | LTR |
| `fr` | French | Français | LTR |
| `fr-CA` | Canadian French | Français canadien | LTR |
| `fr-CH` | Swiss French | Français suisse | LTR |
| `ga` | Irish | Gaeilge | LTR |
| `gl` | Galician | Galego | LTR |
| `gu` | Gujarati | ગુજરાતી | LTR |
| `ha` | Hausa | Hausa | LTR |
| `he` | Hebrew | עברית | RTL |
| `hi` | Hindi | हिन्दी | LTR |
| `hr` | Croatian | Hrvatski | LTR |
| `hu` | Hungarian | Magyar | LTR |
| `hy` | Armenian | Հայերեն | LTR |
| `id` | Indonesian | Indonesia | LTR |
| `ig` | Igbo | Igbo | LTR |
| `is` | Icelandic | Íslenska | LTR |
| `it` | Italian | Italiano | LTR |
| `ja` | Japanese | 日本語 | LTR |
| `jv` | Javanese | Jawa | LTR |
| `ka` | Georgian | Ქართული | LTR |
| `kk` | Kazakh | Қазақ тілі | LTR |
| `km` | Khmer | ខ្មែរ | LTR |
| `kn` | Kannada | ಕನ್ನಡ | LTR |
| `ko` | Korean | 한국어 | LTR |
| `ku` | Kurdish | Kurdî (kurmancî) | LTR |
| `ky` | Kyrgyz | Кыргызча | LTR |
| `lo` | Lao | ລາວ | LTR |
| `lt` | Lithuanian | Lietuvių | LTR |
| `lv` | Latvian | Latviešu | LTR |
| `mi` | Māori | Māori | LTR |
| `mk` | Macedonian | Македонски | LTR |
| `ml` | Malayalam | മലയാളം | LTR |
| `mn` | Mongolian | Монгол | LTR |
| `mr` | Marathi | मराठी | LTR |
| `ms` | Malay | Melayu | LTR |
| `mt` | Maltese | Malti | LTR |
| `my` | Burmese | မြန်မာ | LTR |
| `nb` | Norwegian Bokmål | Norsk bokmål | LTR |
| `ne` | Nepali | नेपाली | LTR |
| `nl` | Dutch | Nederlands | LTR |
| `nl-BE` | Flemish | Vlaams | LTR |
| `or` | Odia | ଓଡ଼ିଆ | LTR |
| `pa` | Punjabi | ਪੰਜਾਬੀ | LTR |
| `pl` | Polish | Polski | LTR |
| `ps` | Pashto | پښتو | RTL |
| `pt` | Portuguese | Português | LTR |
| `pt-BR` | Brazilian Portuguese | Português (Brasil) | LTR |
| `pt-PT` | European Portuguese | Português europeu | LTR |
| `ro` | Romanian | Română | LTR |
| `ru` | Russian | Русский | LTR |
| `rw` | Kinyarwanda | Ikinyarwanda | LTR |
| `sd` | Sindhi | سنڌي | RTL |
| `si` | Sinhala | සිංහල | LTR |
| `sk` | Slovak | Slovenčina | LTR |
| `sl` | Slovenian | Slovenščina | LTR |
| `so` | Somali | Soomaali | LTR |
| `sq` | Albanian | Shqip | LTR |
| `sr` | Serbian | Српски | LTR |
| `sr-Latn` | Serbian (Latin) | Srpski (latinica) | LTR |
| `sv` | Swedish | Svenska | LTR |
| `sw` | Swahili | Kiswahili | LTR |
| `ta` | Tamil | தமிழ் | LTR |
| `te` | Telugu | తెలుగు | LTR |
| `tg` | Tajik | Тоҷикӣ | LTR |
| `th` | Thai | ไทย | LTR |
| `ti` | Tigrinya | ትግርኛ | LTR |
| `tk` | Turkmen | Türkmen dili | LTR |
| `tr` | Turkish | Türkçe | LTR |
| `uk` | Ukrainian | Українська | LTR |
| `ur` | Urdu | اردو | RTL |
| `uz` | Uzbek | O‘zbek | LTR |
| `vi` | Vietnamese | Tiếng Việt | LTR |
| `xh` | Xhosa | IsiXhosa | LTR |
| `yo` | Yoruba | Èdè Yorùbá | LTR |
| `zh-Hans` | Simplified Chinese | 简体中文 | LTR |
| `zh-Hant` | Traditional Chinese | 繁體中文 | LTR |
| `zu` | Zulu | IsiZulu | LTR |

</details>

Use the exact code from the first column in `locales` and as the JSON file name (`messages/pt-BR.json`). A language missing from this table works too; only its name depends on the browser's data, and you can set it with `labels`.

---

### Next.js (App Router)

Next.js resolves the language on the server, so it uses the Next helpers instead of `<QuickTranslate>`. Run `npx quick-translate-sdk init` to generate these files.

```ts
// i18n.ts
import { defineLocales } from 'quick-translate-sdk';
export const locales = defineLocales({
  locales: ['en', 'fr', 'ar'],
  defaultLocale: 'en',
  queryParam: 'lang',
});
export const loadMessages = (l: string) => import(`./messages/${l}.json`).then((m) => m.default);
```

```ts
// middleware.ts
import { createLocaleMiddleware } from 'quick-translate-sdk/next';
import { locales } from './i18n';
export default createLocaleMiddleware(locales);
export const config = { matcher: ['/((?!api|_next|.*\\..*).*)'] };
```

```tsx
// components/locale-providers.tsx
'use client';
import { LocaleProvider } from 'quick-translate-sdk/next/client';
import { loadMessages, locales } from '@/i18n';

export function LocaleProviders({ locale, messages, children }) {
  return (
    <LocaleProvider
      config={locales}
      initialLocale={locale}
      messages={messages}
      loadMessages={loadMessages}
      serverRefresh={false}
      exposeAgentApi
    >
      {children}
    </LocaleProvider>
  );
}
```

```tsx
// app/layout.tsx (Server Component)
import { getDir, getLocale } from 'quick-translate-sdk/next';
import 'quick-translate-sdk/styles.css';
import { LocaleProviders } from '@/components/locale-providers';
import { loadMessages, locales } from '@/i18n';

export default async function RootLayout({ children }) {
  const locale = await getLocale(locales);
  return (
    <html lang={locale} dir={getDir(locale)}>
      <body>
        <LocaleProviders locale={locale} messages={await loadMessages(locale)}>
          {children}
        </LocaleProviders>
      </body>
    </html>
  );
}
```

```tsx
// any Client Component
'use client';
import { LanguageSelector, useT } from 'quick-translate-sdk/next/client';

export function Header() {
  const t = useT();
  return (
    <header>
      <h1>{t('home.title')}</h1>
      <LanguageSelector />
    </header>
  );
}
```

### Next.js Pages Router

```tsx
// pages/_app.tsx
import { LocaleProvider } from 'quick-translate-sdk/next/client';
import 'quick-translate-sdk/styles.css';
import { loadMessages, locales } from '../i18n';

export default function App({ Component, pageProps }) {
  return (
    <LocaleProvider
      config={locales}
      initialLocale={pageProps.locale}
      messages={pageProps.messages}
      loadMessages={loadMessages}
      serverRefresh={false}
    >
      <Component {...pageProps} />
    </LocaleProvider>
  );
}

// pages/index.tsx
import { resolveLocale } from 'quick-translate-sdk';
export async function getServerSideProps({ req }) {
  const locale = resolveLocale(locales, {
    cookieHeader: req.headers.cookie,
    acceptLanguage: req.headers['accept-language'],
  });
  return { props: { locale, messages: await loadMessages(locale) } };
}
```

Set `<Html lang>` in `pages/_document.tsx` from the same value, for example from `this.props.__NEXT_DATA__.props.pageProps.locale`.

> The Pages Router path relies on Next's `next/navigation` compatibility layer for `pages/`. It typechecks, but unlike App Router and Vite it isn't covered by this repo's e2e suite yet.

---

## Your AI assistant answers in the chosen language

If your app has an AI chat or assistant, the selector also controls the language of its replies. When the user picks Français, the next AI answer is in French. Switching mid-conversation changes the very next reply. This works with any model or provider.

```tsx
// Client Component: send the chosen locale with every AI request
'use client';
import { useAiLanguage } from 'quick-translate-sdk/next/client'; // or 'quick-translate-sdk/react'

const ai = useAiLanguage(); // { locale, name, headers, instruction }
await fetch('/api/chat', {
  method: 'POST',
  headers: { ...ai.headers, 'content-type': 'application/json' }, // { 'x-qt-locale': 'fr' }
  body: JSON.stringify({ messages }),
});
<span>Replies in {ai.name}</span>
```

```ts
// app/api/chat/route.ts (server): turn it into a system-prompt instruction
import Anthropic from '@anthropic-ai/sdk';
import { getLanguageInstruction, localeFromRequest } from 'quick-translate-sdk/ai';
import { locales } from '@/i18n';

export async function POST(req: Request) {
  const locale = localeFromRequest(locales, req); // x-qt-locale header → cookie → Accept-Language
  const { messages } = await req.json();
  const stream = new Anthropic().beta.messages.stream({
    model: 'claude-opus-5-5',
    max_tokens: 64000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: [
      { type: 'text', text: 'You are the assistant of …', cache_control: { type: 'ephemeral' } },
      { type: 'text', text: getLanguageInstruction(locale) }, // after the cache breakpoint
    ],
    messages,
  });
  // …stream the text deltas back to the client
}
```

- **`getLanguageInstruction('fr')`** produces: *"Write every reply in French (Français, locale code fr), the language the user selected in the interface. Do this even if the user writes in another language; only switch if they explicitly ask you to. Keep code, commands, identifiers, URLs, product names and quoted text unchanged. Use this locale's conventions for numbers, dates and punctuation."* The language is named in English and natively, so models don't drift back to English or to the language the user typed in. RTL locales also get a right-to-left hint, and `{ mode: 'always' }` never switches away.
- **`withLanguage(systemPrompt, locale)`** is a string version for any SDK (OpenAI, Vercel AI SDK `system:`, local models).
- **`localeFromRequest(config, request)`** works with any Fetch-API server (Next route handlers, Hono, Remix, Bun, Deno). It only accepts configured locales, so the header can't be used to inject text into your prompt.
- **Prompt caching:** with Claude, put the instruction in a system block *after* the cached base prompt (as above). Switching languages then doesn't invalidate the cached prefix.
- **Agents switching languages:** if the AI itself, or a browser agent, calls `window.quickTranslate.setLocale('es')` or the `set_locale` tool from `quick-translate-sdk/agent`, both the UI and the following AI replies switch.

The example app has a working chat at `/` (`components/ai-chat.tsx` + `app/api/chat/route.ts`, Claude Opus 5.5, streaming). Set `ANTHROPIC_API_KEY` for live answers. Without it, or with `QT_CHAT_MOCK=1`, it returns a localized demo reply produced by the same locale resolution, which is what the e2e test `e2e/ai-chat.spec.ts` checks.

## How the instant switch works

1. `<LocaleProvider messages loadMessages>` keeps one dictionary per locale.
2. Hovering or keyboard-focusing an option calls `loadMessages(locale)` once. The JSON chunk is usually in memory before the click.
3. `setLocale('fr')` waits for that dictionary if it isn't there yet. It then sets the locale in an external store. Every component that calls `useT()`/`useLocale()` re-renders in one batch. Components that only switch languages (`useSetLocale()`) don't re-render.
4. Then the cookie is written, `<html lang dir>` updated, `qt:localechange` fired, and `navigate` runs in `startTransition`:
   - **Next, cookie strategy:** `router.refresh()` re-renders Server Components. Pass `serverRefresh={false}` when your text lives in `useT()`, and the switch never touches the network.
   - **Next, path-prefix strategy:** `router.push('/fr/…')` (soft navigation, no reload).
   - **Vite / SPA:** nothing else to do.

A later click wins over a slower earlier one, so there's no race.

## API reference

Every export has TSDoc, so your editor shows these docs inline.

### `quick-translate-sdk` (core, framework-agnostic, server-safe)

| Export                                                                                                                                              |                                                                                                                                                                                                   |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `defineLocales({ locales, defaultLocale?, strategy?, cookieName?, cookieMaxAge?, queryParam?, domains?, labels? })` or `defineLocales(['en','fr'] as const)` | Frozen config. `strategy`: `'cookie'` (default), `'path-prefix'` or `'domain'`. `cookieName` defaults to `NEXT_LOCALE`. `queryParam`: `false` by default; set it to `'lang'` to allow `?lang=fr`. `labels`: exact names to show, e.g. `{ yo: 'Yorùbá' }` (otherwise from `Intl.DisplayNames`). |
| `resolveLocale(config, { search, pathname, host, cookie, cookieHeader, acceptLanguage, languages })`                                                | `?lang=` → path prefix → domain → cookie → Accept-Language/`navigator.languages` → default.                                                                                                       |
| `detectLocale(config)`                                                                                                                              | Browser-side `resolveLocale` (SPA).                                                                                                                                                               |
| `parseAcceptLanguage(header)` / `matchLocale(requested, locales)`                                                                                   | q-value parsing; `pt-BR` → `pt` → same-language match (`pt` → `pt-BR`).                                                                                                                           |
| `createLocaleStore(config, initial?)`                                                                                                               | `{ getLocale, setLocale, subscribe, config }`.                                                                                                                                                    |
| `getDir(locale)`                                                                                                                                    | `'rtl'` for ar, he, fa, ur, ps, sd, ug, yi, ckb, … and `-Arab`/`-Hebr` scripts.                                                                                                                   |
| `getLanguageName(code, inLocale = code)`                                                                                                            | Uses `Intl.DisplayNames`, capitalized, with a tiny fallback map for very old runtimes.                                                                                                            |
| `getFlag(locale)`                                                                                                                                   | Emoji flag of the most likely region, via `Intl.Locale#maximize`.                                                                                                                                 |
| `localizePath(path, locale, locales)` / `localeFromPath`                                                                                            | Path-prefix helpers.                                                                                                                                                                              |
| `readCookie`, `serializeLocaleCookie`, `writeLocaleCookie`, `findLocale`, `isLocale`                                                                | Utilities.                                                                                                                                                                                        |
| `interface Register { config }`                                                                                                                     | Register your config to type `Locale` everywhere.                                                                                                                                                 |

### `quick-translate-sdk/messages` (server-safe)

| Export                                    |                                                                                                                                                                                                                                                                              |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createTranslator(messages, locale)`      | Returns `t(key, values?)`: dot keys, `{name}` interpolation, plurals via `Intl.PluralRules` (`{ zero?, one, two, few, many, other }`; `#` is replaced by the formatted `count`). A missing key returns the key itself and warns in development. Use it in Server Components. |
| `interface MessagesRegister { messages }` | Register your dictionary type for autocompleted, type-checked keys.                                                                                                                                                                                                          |

### `quick-translate-sdk/ai` (server-safe, any provider)

| Export | |
|---|---|
| `getLanguageInstruction(locale, { mode? })` | System-prompt instruction to reply in the chosen language. `mode`: `'unless-asked'` (default) or `'always'`. |
| `withLanguage(systemPrompt, locale, options?)` | Appends that instruction to a string system prompt. |
| `localeFromRequest(config, request)` | Locale for an incoming AI request: `x-qt-locale` header → cookie → `Accept-Language` → default. |
| `AI_LOCALE_HEADER` | `'x-qt-locale'`. |

### `quick-translate-sdk/react` (Client Components)

| Export                                                                                                                                                     |                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<QuickTranslate locales messages? defaultLocale? locale? fallback? prefetch? …>` | **The simple setup for React SPAs.** Detects the language, loads its dictionary before rendering, sets `<html lang dir>`, then preloads the other languages in idle time. Accepts every `LocaleProvider` option below except `config`/`initialLocale`/`messages`/`loadMessages`. |
| `prefetch` (on `QuickTranslate` / `LocaleProvider`) | `'all'` (default): every language's dictionary loads in idle time, so every switch is synchronous. `'intent'`: load only on hover/focus, for very large dictionaries. |
| `<LocaleProvider config initialLocale? messages? loadMessages? prefetchMessages? onLocaleChange? navigate? persist? syncDocument? exposeAgentApi? store?>` | The low-level provider (used by Next.js and by `<QuickTranslate>`). The context value never changes; state lives in an external store.                                                                                                                                                                                                                                                                                                                                  |
| `useT()` / `useMessages()`                                                                                                                                 | Translate function / raw dictionary for the active locale.                                                                                                                                                                                                                                                                                                                                          |
| `useAiLanguage()` | `{ locale, name, headers, instruction }`. Send `headers` with AI requests so replies use the chosen language. |
| `useLocale()`                                                                                                                                              | `{ locale, dir, setLocale, locales, config }`.                                                                                                                                                                                                                                                                                                                                                      |
| `useLocaleSelector(fn)`                                                                                                                                    | Re-renders only when `fn(locale)` changes.                                                                                                                                                                                                                                                                                                                                                          |
| `useSetLocale()`                                                                                                                                           | Setter only; never re-renders.                                                                                                                                                                                                                                                                                                                                                                      |
| `<LanguageSelector>`                                                                                                                                       | Props: `variant` (`'popover'` or `'native'`), `display` (`'name'` or `'code'`), `showFlags`, `showTranslatedName`, `showCheck`, `badges={{ es: 'Preview' }}`, `searchable` (boolean, or a number threshold, default 8), `suggested`, `label`, `texts`, `formAction`, `virtualizeThreshold` (default 500), `itemHeight`, `prefetchMessages`, `onSelect`, `className`, `style`. |
| `<LanguageSelector.Headless>` / `<LanguageSelectorHeadless>` | Render-prop version for fully custom designs. |
| `useLanguageSelector(options)` | Headless hook: prop getters (`getRootProps`, `getTriggerProps`, `getInputProps`, `getListboxProps`, `getOptionProps`) plus `options`, `activeIndex`, `open`, `query`, `virtual`, `current`. |
| `createSearchIndex` / `normalizeText` | The search used by the menu (diacritic-insensitive, word-start matching). |

`quick-translate-sdk/react/headless` still works and exports the same headless pieces, for compatibility.

### `quick-translate-sdk/next` (server only: middleware, Server Components, actions)

| Export                                                             |                                                                                                                                                    |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createLocaleMiddleware(config, { prefixedPaths?, then? })`        | Resolves the locale, redirects for path-prefix, persists explicit choices (`?lang=`, prefixed URLs), and forwards the locale to Server Components. |
| `getLocale(config)`                                                | In Server Components: middleware header → cookie → Accept-Language → default. Works with Next 14 (sync) and 15 (async).                            |
| `setLocale(config, locale)`                                        | Sets the cookie inside your own server action or route handler.                                                                                    |
| `generateLocaleParams(config)` / `parseLocaleParam(config, param)` | For `app/[locale]/…`.                                                                                                                              |

### `quick-translate-sdk/next/client`

A Next-aware `LocaleProvider` (adds `serverRefresh`, default `true`), plus re-exports of `LanguageSelector`, `useT`, `useLocale`, `useMessages`, `useLocaleSelector` and `useSetLocale`.

### `quick-translate-sdk/next/action`

`setLocaleAction`: a `"use server"` action for `<LanguageSelector variant="native" formAction={setLocaleAction} />`, so switching works with **JavaScript disabled**.

### `quick-translate-sdk/styles.css`

Optional, 871 B gzipped. CSS variables only (`--qt-bg`, `--qt-fg`, `--qt-muted`, `--qt-border`, `--qt-active`, `--qt-accent`, `--qt-radius`, `--qt-row`). Includes dark mode, logical properties for RTL, and `prefers-reduced-motion` support.

---

## AI agents

### Browser and computer-use agents (Playwright MCP, Claude in Chrome)

- **Find it by role and name.** It's a `button` whose name starts with **"Select language"** and includes the current value, for example "Select language: Français". Opening it shows a `listbox` named "Languages" in which every option is present at once, with no hover-only menu and no scrolling up to ~15 locales. `variant="native"` is a real `<select>` (role `combobox`, name "Select language").
- **Stable DOM hooks.** `[data-qt-selector]`, `[data-qt-current="fr"]`, and `[data-qt-locale="fr"]` on every option. No hashed class names.
- **Programmatic API** (opt-in via `exposeAgentApi`):

  ```js
  window.quickTranslate.getLocale()       // "en"
  window.quickTranslate.listLocales()     // [{ code, name, nativeName, dir, current }]
  window.quickTranslate.setLocale('fr')   // true, or false if unsupported
  addEventListener('qt:localechange', (e) => e.detail) // { locale, previous }
  ```
- **Deep link.** With `queryParam: 'lang'`, `?lang=ja` works, server-rendered in Next.

The repo's browser tests operate the selector using **only** roles and accessible names, the way an agent does.

### LLM tool calling (`quick-translate-sdk/agent`)

```ts
import {
  createLocaleTools,
  getLocaleToolDefinitions,
  toMCPTools,
  toOpenAITools,
} from 'quick-translate-sdk/agent';

const tools = getLocaleToolDefinitions(locales); // Anthropic format (input_schema), set_locale has an enum
toOpenAITools(tools);
toMCPTools(tools); // other formats
const qt = createLocaleTools(store /* or window.quickTranslate */);
qt.call('set_locale', { locale: 'fr' }); // { ok: true, locale: 'fr', previous: 'en' }
```

### AI coding agents

Read [`AGENTS.md`](./AGENTS.md) and [`llms.txt`](./llms.txt). They're short and give exact snippets and common mistakes.

---

## Performance (measured, not guessed)

Measured on 2026-11-03 on Windows 11, Node 25, Chromium (Playwright), against production builds.

**Bundle size** (min+gzip, `pnpm size`, `NODE_ENV=production`, React excluded):

Nothing is lazy-loaded, so each number is everything that ships.

| What you import | Size | Budget |
| --- | --- | --- |
| `quick-translate-sdk` core, whole entry | **1.47 kB** | 1.5 kB |
| Core: `defineLocales` + `createLocaleStore` + `resolveLocale` | 874 B | 1 kB |
| `<LocaleProvider>` + `useLocale` (incl. idle preloading + warm-up) | 2.04 kB | 2.1 kB |
| `<LocaleProvider>` + `<LanguageSelector>` (complete, menu included) | **6.13 kB** | 6.2 kB |
| `<QuickTranslate>` + `<LanguageSelector>` + `useT` (the simple setup) | **7.12 kB** | 7.2 kB |
| `useLanguageSelector` (headless) | 3.27 kB | 4 kB |
| `quick-translate-sdk/messages` | 269 B | 500 B |
| `quick-translate-sdk/ai` (server; includes the core helpers it uses) | 1.34 kB | 1.6 kB |
| `quick-translate-sdk/agent` | 1.01 kB | 1.5 kB |
| `styles.css` | 871 B | 1 kB |

**Speed**, measured in the `react-app` production build (6 languages including Arabic and Japanese). Each run uses a fresh browser session, so fonts and caches start cold. Interaction latency is the Event Timing duration from click to next paint, as INP measures it; Chromium reports 16 ms as its floor.

| Interaction | Result |
| --- | --- |
| Selecting a language, first time or not, any script (27 clicks: Latin, Arabic, Japanese) | **16 ms** every time (one frame) |
| Click → whole page translated, without hovering first | **6–16 ms** |
| First open of the menu (fresh session) | **24–32 ms** |
| Opening the menu after switching to Japanese | **16 ms** |

Before these changes, the same app measured 40–64 ms for the first open and up to 144 ms for the first switch into Japanese.

**Earlier measurements (Next.js example, since removed from the repo):**

| Measurement | Result |
| --- | --- |
| Click → DOM committed, 300 reading + 300 setter-only components | 1.0–1.2 ms |
| Re-renders in that case | 300/300 readers, **0/300 setter-only** (a naive Context: 300/300 and 300/300) |

**Lighthouse 12.8** on the earlier Next.js example:

| Page       | Preset          | Performance | Accessibility | Best practices | SEO |
| ---------- | --------------- | ----------- | ------------- | -------------- | --- |
| `/`        | desktop         | 100         | 100           | 100            | 100 |
| `/en/docs` | desktop         | 100         | 100           | 100            | 100 |
| `/`        | mobile (4× CPU) | 83          | 100           | 100            | 100 |
| `/en/docs` | mobile (4× CPU) | 82          | 100           | 100            | 100 |

The mobile TBT (~600 ms) is attributed by Lighthouse to Next's framework chunk (`chunks/349-*.js`, React + router). quick-translate lives in a separate ~9.6 kB (unzipped) chunk, so the 100 mobile target is **not** met on this machine.

Bundle sizes: run `pnpm size` here. Lighthouse was measured on the earlier Next.js example; re-measure in your own app.

## How it stays fast

- **Nothing is lazy.** The menu ships with the page, so the first click never waits for a download.
- **Every language is preloaded in idle time** (`prefetch="all"`, the default), so a switch never waits for the network. With `prefetch="intent"`, a language loads on hover or focus instead, and the switch waits for it if needed. It never shows a half-translated page.
- **The browser's first-time work happens in idle time, not on the click.** Building `Intl.DisplayNames`, resolving fonts for each script (CJK, Arabic…) and shaping text are one-time costs. The SDK does them offscreen while the page is idle: once for the menu's real markup, and once for each preloaded language's text.
- **The menu responds before the page changes.** Selecting an option closes the menu and paints in that same frame, the way a native `<select>` does. The whole page switches language right after that paint, so the click stays at one frame even when the new language is expensive to lay out the first time.

## Behavior notes

- **Every option is always in the page**, like a regular `<select>`, up to 500 options. Only bigger lists are windowed (`virtualizeThreshold`), and they still have search.
- **Language matching is script-aware.** `zh-TW` prefers `zh-Hant`, and `sr-Latn` prefers `sr-Latn`. A different script (`zh-TW` → `zh-Hans`) is only used if no requested language matches better.
- **Language names** come from the browser's `Intl.DisplayNames` unless you set `labels` in `defineLocales({ labels: { yo: 'Yorùbá' } })`.
  - Plain React apps aren't server-rendered, so they never see a mismatch.
  - With server rendering (Next.js), Node and browsers ship different ICU data; for example, Chrome has no Yoruba names. Set `labels` for the languages you need identical; without them, the server's text is kept on hydration instead of warning.
- **`aria-label` is "Select language: <current>"**, for example "Select language: Français". It includes the visible text (WCAG 2.5.3) and tells screen readers and AI agents the current value. Lookups by the "Select language" prefix work.
- **Flags are off by default** (`showFlags` turns them on). Flags are regions, not languages, and Windows shows letters instead of flag emoji.

## Development

```bash
# in sdk/
pnpm i
pnpm build | test | typecheck | lint | size
pnpm dev                    # rebuilds on change (tsup --watch)
npm publish                 # publish quick-translate-sdk (runs the build first)
pnpm changeset              # or: describe a change; CI opens the release PR, then publishes with provenance

# in react-app/
pnpm sdk:update && pnpm dev # rebuild the SDK, refresh the app's copy, start on :5173
pnpm e2e                    # browser tests
```

MIT © Joseph Akpan Sunday
