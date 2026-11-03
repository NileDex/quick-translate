// Publishes this package to GitHub Packages as @niledex/quick-translate-sdk, from your own machine.
//
// GitHub Packages only accepts owner-scoped names, while npm keeps the plain name
// "quick-translate-sdk". This switches the name for the publish and always restores package.json,
// even if the publish fails. Extra arguments are passed to npm (e.g. --dry-run, --otp=123456).
//
// One-time login (personal access token (classic) with the write:packages scope as the password):
//   npm login --scope=@niledex --auth-type=legacy --registry=https://npm.pkg.github.com
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Path to npm's npm-cli.js: from `npm run` (npm_execpath), else next to the running Node. */
function npmCli() {
  const fromRun = process.env.npm_execpath ?? '';
  if (/npm-cli\.js$/.test(fromRun)) return fromRun;
  const nodeDir = dirname(process.execPath);
  for (const candidate of [
    join(nodeDir, 'node_modules', 'npm', 'bin', 'npm-cli.js'), // Windows installer layout
    join(nodeDir, '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'), // macOS / Linux layout
  ])
    if (existsSync(candidate)) return candidate;
  throw new Error('Could not find npm. Run this with `npm run publish:github` instead.');
}

const SCOPED_NAME = '@niledex/quick-translate-sdk';
const REGISTRY = 'https://npm.pkg.github.com';

const root = fileURLToPath(new URL('..', import.meta.url));
const file = fileURLToPath(new URL('../package.json', import.meta.url));
const original = readFileSync(file, 'utf8');
const pkg = JSON.parse(original);

console.log(`Publishing ${SCOPED_NAME}@${pkg.version} to ${REGISTRY}`);
try {
  writeFileSync(file, `${JSON.stringify({ ...pkg, name: SCOPED_NAME }, null, 2)}\n`);
  const args = ['publish', '--registry', REGISTRY, '--ignore-scripts', ...process.argv.slice(2)];
  // Run npm's own JS entry with Node: no shell, so arguments are passed safely on every OS.
  execFileSync(process.execPath, [npmCli(), ...args], { cwd: root, stdio: 'inherit' });
} catch {
  console.error('\nPublish to GitHub Packages failed (see the npm output above).');
  process.exitCode = 1;
} finally {
  writeFileSync(file, original); // back to "quick-translate-sdk" for npm
}
