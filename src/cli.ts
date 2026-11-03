/**
 * `npx quick-translate-sdk init`: detects Next.js (App/Pages Router) or Vite and writes the config,
 * middleware and a provider/selector snippet. Never overwrites existing files.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

const args = process.argv.slice(2);
const cmd = args[0];
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const dry = args.includes('--dry-run');
const cwd = process.cwd();

function help() {
  console.log(`quick-translate-sdk

Usage:
  npx quick-translate-sdk init [--locales en,fr,de] [--default en] [--strategy cookie|path-prefix] [--dry-run]

Writes (only if missing):
  Next.js:  i18n.ts, messages/<locale>.json, middleware.ts, components/locale-providers.tsx,
            components/language-switcher.tsx                          (+ prints the layout snippet)
  React:    src/messages/<locale>.json                                (+ prints the main.tsx snippet)
`);
}

function write(file: string, content: string) {
  const rel = relative(cwd, file);
  if (existsSync(file)) return console.log(`  skip   ${rel} (exists)`);
  if (!dry) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
  }
  console.log(`  create ${rel}${dry ? ' (dry run)' : ''}`);
}

function init() {
  let pkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> } = {};
  try {
    pkg = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8'));
  } catch {
    console.error('No package.json found. Run this in your project root.');
    process.exit(1);
  }
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const locales = (flag('locales') ?? 'en,fr,es')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const def = flag('default') ?? locales[0];
  const strategy = flag('strategy') ?? 'cookie';
  const src = existsSync(join(cwd, 'src')) ? join(cwd, 'src') : cwd;
  const config = `import { defineLocales } from 'quick-translate-sdk';
import type en from './messages/${def}.json';

export const locales = defineLocales({
  locales: [${locales.map((l) => `'${l}'`).join(', ')}],
  defaultLocale: '${def}',
  strategy: '${strategy}',
  queryParam: 'lang', // ?lang=fr deep links (handy for agents & QA); set false to disable
});

/** One JSON file per locale, code-split; prefetched when an option is hovered. */
export const loadMessages = (locale: string) =>
  import(\`./messages/\${locale}.json\`).then((m: { default: typeof en }) => m.default);

declare module 'quick-translate-sdk' {
  interface Register {
    config: typeof locales;
  }
}
declare module 'quick-translate-sdk/messages' {
  interface MessagesRegister {
    messages: typeof en; // typed, autocompleted t('…') keys
  }
}
`;
  // Starter dictionaries: same keys everywhere; translate the non-default ones.
  const writeMessages = (dir: string) => {
    for (const l of locales)
      write(
        join(dir, 'messages', `${l}.json`),
        `${JSON.stringify({ home: { title: l === def ? 'Hello' : `Hello (${l})` } }, null, 2)}\n`,
      );
  };

  if (deps.next) {
    const appDir = ['app', 'src/app'].map((d) => join(cwd, d)).find(existsSync);
    const root =
      existsSync(join(cwd, 'src', 'app')) || existsSync(join(cwd, 'src', 'pages')) ? src : cwd;
    console.log(`Detected Next.js (${appDir ? 'App Router' : 'Pages Router'})`);
    write(join(root, 'i18n.ts'), config);
    writeMessages(root);
    write(
      join(root, 'middleware.ts'),
      `import { createLocaleMiddleware } from 'quick-translate-sdk/next';
import { locales } from './i18n';

export default createLocaleMiddleware(locales);

export const config = { matcher: ['/((?!api|_next|.*\\\\..*).*)'] };
`,
    );
    write(
      join(root, 'components', 'locale-providers.tsx'),
      `'use client';
import { LocaleProvider } from 'quick-translate-sdk/next/client';
import type { Messages } from 'quick-translate-sdk/messages';
import type { ReactNode } from 'react';
import { loadMessages, locales } from '@/i18n';

// Client wrapper: functions (loadMessages) can't be passed from a Server Component.
// serverRefresh={false}: text lives in useT(), so switching never hits the server.
export function LocaleProviders(props: { locale: string; messages: Messages; children: ReactNode }) {
  return (
    <LocaleProvider
      config={locales}
      initialLocale={props.locale}
      messages={props.messages}
      loadMessages={loadMessages}
      serverRefresh={false}
      exposeAgentApi
    >
      {props.children}
    </LocaleProvider>
  );
}
`,
    );
    write(
      join(root, 'components', 'language-switcher.tsx'),
      `'use client';
import { LanguageSelector } from 'quick-translate-sdk/next/client';

export function LanguageSwitcher() {
  return <LanguageSelector />;
}
`,
    );
    console.log(
      appDir
        ? `
Next, edit app/layout.tsx:

  import { getLocale, getDir } from 'quick-translate-sdk/next';
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

Then, in any Client Component:
  const t = useT();            // import { useT } from 'quick-translate-sdk/next/client'
  <h1>{t('home.title')}</h1>
  <LanguageSwitcher />`
        : `
Pages Router: see the "Next.js Pages Router" section of the quick-translate-sdk README for _app.tsx / _document.tsx.`,
    );
  } else {
    console.log(
      deps.vite ? 'Detected Vite' : 'No framework detected; using the React (Vite) setup',
    );
    writeMessages(src);
    console.log(`
Next, wrap your app in main.tsx:

  import { QuickTranslate } from 'quick-translate-sdk/react';
  import 'quick-translate-sdk/styles.css';

  <QuickTranslate locales={[${locales.map((l) => `'${l}'`).join(', ')}]} messages={(l) => import(\`./messages/\${l}.json\`)}>
    <App />
  </QuickTranslate>

Then anywhere:

  import { LanguageSelector, useT } from 'quick-translate-sdk/react';
  const t = useT();
  <LanguageSelector />  <h1>{t('home.title')}</h1>`);
  }
  if (!deps['quick-translate-sdk']) console.log('\nDon’t forget: npm i quick-translate-sdk');
}

if (cmd === 'init') init();
else help();
