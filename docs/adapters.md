# Adapters: using quick-translate with other i18n libraries

The built-in `useT()` is optional. If you already use an i18n library, keep it: let quick-translate own the **locale** (selector, cookie, SSR negotiation, `<html lang dir>`, agent API), and sync the library through `onLocaleChange` and `prefetchMessages`.

## Plain JSON (built in, no library)

With `<QuickTranslate>` (React SPA) it is one prop: `messages={(l) => import(\`./messages/${l}.json\`)}`; see `../react-app`. The lower-level form, used with Next.js:

```tsx
// i18n.ts
export const loadMessages = (l: string) => import(`./messages/${l}.json`).then((m) => m.default);

// provider (Client Component)
<LocaleProvider
  config={locales}
  initialLocale={locale}
  messages={messages}
  loadMessages={loadMessages}
>
  {children}
</LocaleProvider>


// anywhere (Client Component)
const t = useT();
t('cart.items', { count: 3 }); // plural via Intl.PluralRules

// Server Component
import { createTranslator } from 'quick-translate-sdk/messages';
const t = createTranslator(await loadMessages(locale), locale);
```

## next-intl (App Router)

next-intl reads the locale on the server through its request config. Point it at quick-translate's resolution, and keep its client provider in sync.

```ts
// i18n/request.ts (next-intl)
import { getRequestConfig } from 'next-intl/server';
import { getLocale } from 'quick-translate-sdk/next';
import { locales } from '../i18n';

export default getRequestConfig(async () => {
  const locale = await getLocale(locales); // middleware header → cookie → Accept-Language
  return { locale, messages: (await import(`../messages/${locale}.json`)).default };
});
```

```tsx
// app/providers.tsx
'use client';
import { NextIntlClientProvider } from 'next-intl';
import { LocaleProvider } from 'quick-translate-sdk/next/client';
import { locales } from '@/i18n';

// Switching: quick-translate writes the cookie and calls router.refresh(); next-intl's server config
// then resolves the new locale and streams the new messages. Prefetch warms the JSON chunk.
export function Providers({ locale, messages, children }) {
  return (
    <LocaleProvider
      config={locales}
      initialLocale={locale}
      prefetchMessages={(l) => import(`../messages/${l}.json`)}
    >
      <NextIntlClientProvider locale={locale} messages={messages}>
        {children}
      </NextIntlClientProvider>
    </LocaleProvider>
  );
}
```

Use quick-translate's middleware, not next-intl's, so there's one source of truth (or chain them with the `then` option of `createLocaleMiddleware`).

## react-i18next

```tsx
import i18n from './i18n-next'; // your i18next instance

<LocaleProvider
  config={locales}
  initialLocale={i18n.language}
  prefetchMessages={(l) => i18n.loadLanguages(l)}
  onLocaleChange={(l) => i18n.changeLanguage(l)}
>
  <App />
</LocaleProvider>

```

`onLocaleChange` runs after the switch is committed. If you want quick-translate to wait for i18next's resources (an atomic switch), use `loadMessages: (l) => i18n.loadLanguages(l).then(() => ({}))` instead of `prefetchMessages`.
