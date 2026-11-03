import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const src = (p: string) => fileURLToPath(new URL(`./src/${p}`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^quick-translate-sdk$/, replacement: src('core/index.ts') },
      { find: /^quick-translate-sdk\/messages$/, replacement: src('messages/index.ts') },
      { find: /^quick-translate-sdk\/ai$/, replacement: src('ai/index.ts') },
      { find: /^quick-translate-sdk\/react$/, replacement: src('react/index.ts') },
      {
        find: /^quick-translate-sdk\/react\/headless$/,
        replacement: src('react/headless-entry.ts'),
      },
    ],
  },
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.test.{ts,tsx}'],
  },
});
