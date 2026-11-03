# Changelog

## 0.2.1

Documentation only; no code changes.

- README: new **Known limits** section listing what's still true after the 0.2.0 speed work (first-open time, the one-frame switch after a menu selection, bundle size, preloading, browser language-name gaps, untested Next.js setups).

## 0.2.0

The selector now behaves like a regular language selector, only faster.

- **Nothing is lazy-loaded.** The menu ships with the page, so it opens on the first click.
- **Every language is preloaded in idle time** (new `prefetch` option, default `"all"`), so every switch is synchronous. Use `prefetch="intent"` to load on hover/focus only.
- **One-frame selection.** Picking a language closes the menu and paints first, like a native `<select>`; the page switches right after that paint. Measured at 16 ms in every case, including the first switch into Japanese or Arabic.
- **Idle warm-up.** Fonts and text shaping for every script (the menu, and each preloaded language's text) are prepared offscreen while the page is idle, so first opens and first switches stay fast.
- **Every option stays in the page** up to 500 languages (virtualization threshold raised from 50).
- **Script-aware language matching.** `zh-TW` prefers `zh-Hant`, and `sr-Latn` prefers `sr-Latn`; a different script is only a last resort.
- **New `labels` option** in `defineLocales()`, for exact language names (e.g. `{ yo: 'Yorùbá' }`).
- **`useLanguageSelector`, `LanguageSelectorHeadless`, `createSearchIndex` and `normalizeText` are now exported from `quick-translate-sdk/react`.** `quick-translate-sdk/react/headless` still works.
- **Removed:** the `preload` prop of `<LanguageSelector>` (nothing is lazy anymore).
- **Behavior change:** selecting from the menu now updates the page one frame after the click. Calling `setLocale()` directly is still synchronous.

## 0.1.0

Initial release: `<QuickTranslate>` one-component setup, `<LanguageSelector>` (styled, headless, native), built-in translator with whole-app switching (`useT`), Next.js middleware and server helpers, `quick-translate-sdk/ai` (AI replies in the chosen language), agent API and LLM tool definitions, `init` CLI.
