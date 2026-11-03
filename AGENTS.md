# AGENTS.md: using quick-translate (for AI coding agents)

`quick-translate-sdk` is a language selector plus a tiny translator for React 18/19 and Next.js 14/15. Switching swaps the whole app's text in one render, with no reload. Zero runtime dependencies.

## Install

```bash
npm i quick-translate-sdk
npx quick-translate-sdk init --locales en,fr,ar --default en   # scaffolds everything below; never overwrites
```

## Which import goes where

| Import                           | Where it may run                                                                                 |
| -------------------------------- | ------------------------------------------------------------------------------------------------ |
| `quick-translate-sdk`                | Anywhere: server, edge, client. Config, negotiation, `getDir`.                                   |
| `quick-translate-sdk/messages`       | Anywhere. `createTranslator` for Server Components.                                              |
| `quick-translate-sdk/ai` | Anywhere (server). `getLanguageInstruction`, `withLanguage`, `localeFromRequest`: AI replies in the chosen language. |
| `quick-translate-sdk/next`           | **Server only**: `middleware.ts`, Server Components, route handlers, server actions.             |
| `quick-translate-sdk/next/client`    | **Client Components only** (Next.js). `LocaleProvider`, `LanguageSelector`, `useT`, `useLocale`. |
| `quick-translate-sdk/react`          | Client Components (non-Next React, e.g. Vite). `QuickTranslate`, the same hooks, and `useLanguageSelector` for custom designs. |
| `quick-translate-sdk/next/action`    | Server action `setLocaleAction` (no-JS fallback).                                                |
| `quick-translate-sdk/agent`          | Anywhere. LLM tool definitions.                                                                  |
| `quick-translate-sdk/styles.css`     | Import once in the root layout or main entry.                                                    |

## Next.js App Router: the 5 files

```ts
// i18n.ts
import { defineLocales } from 'quick-translate-sdk';
import type en from './messages/en.json';
export const locales = defineLocales({
  locales: ['en', 'fr', 'ar'],
  defaultLocale: 'en',
  queryParam: 'lang',
});
export const loadMessages = (l: string) =>
  import(`./messages/${l}.json`).then((m: { default: typeof en }) => m.default);
declare module 'quick-translate-sdk' {
  interface Register {
    config: typeof locales;
  }
}
declare module 'quick-translate-sdk/messages' {
  interface MessagesRegister {
    messages: typeof en;
  }
}
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
export function LocaleProviders({
  locale,
  messages,
  children,
}: {
  locale: string;
  messages: any;
  children: React.ReactNode;
}) {
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
// app/layout.tsx
import { getDir, getLocale } from 'quick-translate-sdk/next';
import 'quick-translate-sdk/styles.css';
import { LocaleProviders } from '@/components/locale-providers';
import { loadMessages, locales } from '@/i18n';
export default async function RootLayout({ children }: { children: React.ReactNode }) {
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

Server Component text: `const t = createTranslator(await loadMessages(locale), locale)` from `quick-translate-sdk/messages`. If you translate on the server, **keep `serverRefresh` at its default (`true`)** so Server Components re-render after a switch.

## Make the app's AI assistant reply in the chosen language

```tsx
// client: send the locale with every AI request
const ai = useAiLanguage(); // from 'quick-translate-sdk/next/client' or 'quick-translate-sdk/react'
fetch('/api/chat', { method: 'POST', headers: { ...ai.headers, 'content-type': 'application/json' }, body });
```

```ts
// server (route handler): add the instruction to the system prompt
import { getLanguageInstruction, localeFromRequest, withLanguage } from 'quick-translate-sdk/ai';
const locale = localeFromRequest(locales, req);
// Claude: system: [{ type: 'text', text: BASE, cache_control: { type: 'ephemeral' } }, { type: 'text', text: getLanguageInstruction(locale) }]
// any other SDK: system: withLanguage(BASE, locale)
```

Put the instruction after the cached part of the system prompt, so switching languages keeps the cache. Don't trust a raw header value in your prompt; `localeFromRequest` only returns configured locales.

## Vite / plain React (simplest: one component)

```tsx
// main.tsx
import { QuickTranslate } from 'quick-translate-sdk/react';
import 'quick-translate-sdk/styles.css';
createRoot(el).render(
  <QuickTranslate locales={['en', 'fr', 'ar']} messages={(l) => import(`./messages/${l}.json`)}>
    <App />
  </QuickTranslate>,
);
// anywhere: const t = useT(); <LanguageSelector />  (both from 'quick-translate-sdk/react')
```

`<QuickTranslate>` detects the language (`?lang=` → cookie → browser), loads the first JSON before rendering, and sets `<html lang dir>`. Don't use it in Next.js; use the Next.js files above. Working example: `../react-app`.

## Selector recipes

```tsx
<LanguageSelector />                                         // styled: native names + translated names, search above 8 locales
<LanguageSelector display="code" showTranslatedName={false} badges={{ es: 'Preview' }} />  // compact "EN ▾", ✓ on current
<LanguageSelector variant="native" formAction={setLocaleAction} />                         // real <select>, works without JS
```

Theme it with CSS variables on `.qt-root`: `--qt-bg --qt-fg --qt-muted --qt-border --qt-active --qt-accent --qt-radius --qt-row`.

## Common mistakes

1. **Hooks or `<LanguageSelector>` without a provider.** Error: "No <LocaleProvider> found". Wrap the app in `LocaleProvider`.
2. **Using `useT`, `useLocale` or `useLanguageSelector` in a Server Component.** They're client hooks. Add `'use client'`, or use `createTranslator` and `getLocale` on the server.
3. **Passing `loadMessages` (a function) from `app/layout.tsx` straight to `LocaleProvider`.** Functions can't cross the Server → Client boundary. Wrap the provider in a `'use client'` component, as shown above.
4. **Importing `LocaleProvider` from `quick-translate-sdk/react` in Next.js.** Use `quick-translate-sdk/next/client`; that version wires `router.refresh()` and route changes.
5. **Importing `quick-translate-sdk/next` in a Client Component.** It uses `next/headers` and is server only.
6. **Forgetting `initialLocale` with SSR.** The client would start at `defaultLocale` and mismatch the server. Pass `await getLocale(locales)`.
7. **`<LanguageSelector.Headless>` in a Server Component.** Dotted client components can't be used from the server, and render props need the client anyway.
8. **Expecting `?lang=` to work without `queryParam: 'lang'`.** It's opt-in.
9. **Language names that differ between server and browser (SSR).** Node and browser ICU data differ (for example Yoruba). Set exact names with `defineLocales({ labels: { yo: 'Yorùbá' } })`. If you render names yourself, add `suppressHydrationWarning` to that element.
10. **Mismatched dictionary keys.** Register `MessagesRegister` so TypeScript checks `t('…')` keys.

## Testing it (and how browser agents find it)

- The trigger is a `button`, name `/^Select language:/` (for example "Select language: English"). It opens a `listbox` named "Languages" containing `option`s. The native variant is a `combobox` named "Select language".
- Data hooks: `[data-qt-selector]`, `[data-qt-current]`, `[data-qt-locale="fr"]`.
- With `exposeAgentApi`: `window.quickTranslate.setLocale('fr')` and the `qt:localechange` event.
