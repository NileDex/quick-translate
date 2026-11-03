# Set up quick-translate-sdk with an AI coding assistant

Copy the prompt below into Claude Code, Cursor, GitHub Copilot or another coding agent, from your project's root folder. First edit the two lines marked **EDIT**: your languages and your default language.

The agent will detect your framework, install the SDK, move your hardcoded text into translation files, translate them, add a language selector, and check that everything works.

---

```text
Add multi-language support to this project with the npm package "quick-translate-sdk".

EDIT: Languages to support: en, fr, es, de, ar, ja
EDIT: Default language: en

Before you start, read node_modules/quick-translate-sdk/AGENTS.md after installing (it has the exact
API, the imports to use where, and common mistakes). Follow it over anything you remember.

1. Detect the framework.
   - Next.js App Router (an app/ folder), Next.js Pages Router (a pages/ folder), or a plain React app
     (Vite, CRA or another SPA). Tell me which one you found.
   - Check that React is 18 or newer, and that Next.js, if used, is 14 or newer.

2. Install: run the project's package manager (npm install / pnpm add / yarn add / bun add)
   with quick-translate-sdk.

3. Create one translation file per language: messages/<code>.json (src/messages/ in a src/ layout).
   - Find the user-visible text in components and pages: headings, paragraphs, buttons, labels,
     placeholders, aria-labels, alt text, titles, error messages.
   - Move it into messages/<default>.json with nested, descriptive keys (e.g. "home.title",
     "cart.items"). Use {name} for variables, and plural objects { "one": "...", "other": "..." }
     with # for the count. Arabic also needs zero/two/few/many; Japanese and Chinese only "other".
   - Create the other language files with the SAME keys, translated naturally (not word for word).
     Keep {variables}, #, brand names, code and URLs unchanged.

4. Wire it up, following AGENTS.md for the detected framework:
   - Plain React (Vite/SPA): wrap the root in
       <QuickTranslate locales={[...]} messages={(l) => import(`./messages/${l}.json`)}>
     from "quick-translate-sdk/react", and import "quick-translate-sdk/styles.css" once.
   - Next.js App Router: i18n.ts (defineLocales + loadMessages), middleware.ts
     (createLocaleMiddleware), a 'use client' provider component wrapping LocaleProvider from
     "quick-translate-sdk/next/client", and app/layout.tsx rendering
     <html lang={locale} dir={getDir(locale)}> with await getLocale(locales).
     Never import "quick-translate-sdk/next" in Client Components.
   - Register the default dictionary's type (MessagesRegister in AGENTS.md) so t('...') keys are
     type-checked.

5. Replace every hardcoded string you moved with t('key') from useT() (Client Components) or
   createTranslator (Server Components). Don't leave any visible English text behind, except brand
   names.

6. Add <LanguageSelector /> where users expect it (usually the header or nav). Match the app's style
   through the CSS variables on .qt-root (--qt-bg, --qt-fg, --qt-accent, --qt-border, --qt-radius).
   If the design is compact, use display="code" showTranslatedName={false}.

7. If the app has an AI chat or assistant, make its replies follow the selected language: send
   useAiLanguage().headers with each AI request, and on the server add
   getLanguageInstruction(localeFromRequest(locales, request)) to the system prompt
   ("quick-translate-sdk/ai"). Skip this step if there's no AI feature.

8. Verify, and fix anything that fails:
   - The project builds and type-checks, and existing tests still pass.
   - Switching language in the selector changes all visible text with no page reload.
   - Arabic (or any right-to-left language) flips the layout to right-to-left.
   - Reloading the page keeps the chosen language; ?lang=fr in the URL switches to French.
   - The browser console shows no hydration warnings or errors.

When you're done, summarize: the files you created or changed, the languages added, any text you
couldn't move into translation files (and why), and anything I should review, such as translations
you're unsure about.
```

---

**Tips**

- **Large app?** Ask the agent to do one page or section at a time, then continue with the next.
- **Professional translations:** the agent's translations are a good start. Have native speakers review anything customer-facing.
- **Add a language later:** ask the agent to *"add Italian (it) to quick-translate-sdk: create messages/it.json with the same keys as messages/en.json, and add 'it' to the locales list."*
- **What the agent reads:** [AGENTS.md](./AGENTS.md) (setup rules and common mistakes) and [llms.txt](./llms.txt) (compact API summary) ship inside the package, at `node_modules/quick-translate-sdk/`.
