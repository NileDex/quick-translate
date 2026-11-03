// Copies non-TS assets into the build output: src/styles.css → dist/styles.css.
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(join(root, 'dist'), { recursive: true });
copyFileSync(join(root, 'src', 'styles.css'), join(root, 'dist', 'styles.css'));
