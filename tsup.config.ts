import { defineConfig, type Options } from 'tsup';

// Entries are built separately so each one gets the right RSC directive in its output.
// Cross-entry imports go through the package name (marked external) so code is never duplicated
// between `quick-translate-sdk`, `quick-translate-sdk/react` and `quick-translate-sdk/next/*`.
const external = [
  'react',
  'react-dom',
  'next',
  'quick-translate-sdk',
  'quick-translate-sdk/react',
  'quick-translate-sdk/messages',
  'quick-translate-sdk/ai',
];

const base: Options = {
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  target: 'es2020',
  platform: 'neutral',
  external,
  splitting: false,
  treeshake: false,
  outExtension: ({ format }) => ({ js: format === 'cjs' ? '.cjs' : '.js' }),
};

export default defineConfig([
  // Server-safe entries: no directive.
  {
    ...base,
    entry: {
      index: 'src/core/index.ts',
      messages: 'src/messages/index.ts',
      ai: 'src/ai/index.ts',
      agent: 'src/agent/index.ts',
      next: 'src/next/index.ts',
    },
  },
  // Client entries: keep "use client" at the top of every output file.
  {
    ...base,
    entry: {
      react: 'src/react/index.ts',
      'react-headless': 'src/react/headless-entry.ts',
      'next-client': 'src/next/client.tsx',
    },
    banner: { js: '"use client";' },
    // ESM: the dropdown panel becomes its own lazily-loaded chunk (see src/react/selector.tsx).
    splitting: true,
  },
  // Server action entry.
  {
    ...base,
    entry: { 'next-action': 'src/next/action.ts' },
    banner: { js: '"use server";' },
  },
  // CLI.
  {
    entry: { cli: 'src/cli.ts' },
    format: ['cjs'],
    platform: 'node',
    target: 'node18',
    banner: { js: '#!/usr/bin/env node' },
    outExtension: () => ({ js: '.cjs' }),
  },
]);
