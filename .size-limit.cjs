// Budgets are min+gzip, measured the way an app's production build sees the package:
// process.env.NODE_ENV = "production" (dev-only warnings/errors are dropped), react is a peer (ignored).
// Nothing is lazy-loaded: every number below is everything that ships, and the menu is instant on the
// first click.
const prod = (config) => ({
  ...config,
  define: { ...config.define, 'process.env.NODE_ENV': '"production"' },
  // tsup emits bare `import "./chunk-x.js"` ordering imports; dropping them is correct (sideEffects).
  logOverride: { ...config.logOverride, 'ignored-bare-import': 'silent' },
});
const react = ['react', 'react-dom', 'react/jsx-runtime'];
const check = (c) => ({ gzip: true, modifyEsbuildConfig: prod, ...c });

module.exports = [
  check({ name: 'core (whole entry)', path: 'dist/index.js', limit: '1.5 kB' }),
  check({
    name: 'core: defineLocales + createLocaleStore + resolveLocale',
    path: 'dist/index.js',
    import: '{ defineLocales, createLocaleStore, resolveLocale }',
    limit: '1 kB',
  }),
  check({
    name: 'react: <LocaleProvider> + useLocale only',
    path: 'dist/react.js',
    import: '{ LocaleProvider, useLocale }',
    ignore: react,
    // includes idle preloading of every dictionary + offscreen text warm-up (one-frame switches)
    limit: '2.1 kB',
  }),
  check({
    name: 'react: <LocaleProvider> + <LanguageSelector> (complete, menu included)',
    path: 'dist/react.js',
    import: '{ LocaleProvider, LanguageSelector }',
    ignore: react,
    limit: '6.2 kB',
  }),
  check({
    name: 'react: <QuickTranslate> + <LanguageSelector> + useT (the simple setup, complete)',
    path: 'dist/react.js',
    import: '{ QuickTranslate, LanguageSelector, useT }',
    ignore: react,
    limit: '7.2 kB',
  }),
  check({
    name: 'react: useLanguageSelector (headless)',
    path: 'dist/react.js',
    import: '{ useLanguageSelector }',
    ignore: react,
    limit: '4 kB',
  }),
  check({ name: 'messages: createTranslator', path: 'dist/messages.js', limit: '500 B' }),
  check({
    name: 'ai: language instruction + localeFromRequest',
    path: 'dist/ai.js',
    limit: '1.6 kB',
  }),
  check({ name: 'agent', path: 'dist/agent.js', limit: '1.5 kB' }),
  check({ name: 'styles.css', path: 'dist/styles.css', limit: '1 kB' }),
];
