import { mkdirSync, readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Materialize the exact follow-along files, independently of the examples app.
const root = fileURLToPath(new URL('../', import.meta.url));
const [outputArgument, bindingArgument, part = '4'] = process.argv.slice(2);
if (!outputArgument || !bindingArgument || !['2', '3', '4'].includes(part)) {
  throw new Error('Usage: node scripts/prepare-counter-guide.mjs OUTPUT COUNTER_BINDING [2|3|4]');
}
const output = resolve(outputArgument);
mkdirSync(output, { recursive: true });
const chapters = ['work-with-groundhog-from-typescript'];
if (part !== '2') chapters.push('build-a-counter-with-react');
if (part === '4') chapters.push('connect-a-wallet-to-your-app');
for (const chapter of chapters) {
  const source = readFileSync(resolve(root, `src/content/docs/tutorials/${chapter}.md`), 'utf8');
  for (const match of source.matchAll(/```\w+ title="([^"]+)"\n([\s\S]*?)\n```/g)) {
    // An existing environment may contain local test settings or a signing key.
    const path = resolve(output, match[1]);
    if (match[1] === '.env' && existsSync(path)) continue;
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${match[2]}\n`, { mode: match[1] === '.env' ? 0o600 : 0o644 });
  }
}
mkdirSync(resolve(output, 'src/contracts'), { recursive: true });
const binding = resolve(output, 'src/contracts/counter.ts');
if (resolve(bindingArgument) !== binding) copyFileSync(resolve(bindingArgument), binding);
if (!existsSync(resolve(output, 'package.json'))) {
  writeFileSync(resolve(output, 'package.json'), JSON.stringify({
    name: 'counter-follow-along', private: true, type: 'module',
    scripts: { dev: 'vite', build: 'tsc --noEmit && vite build' },
  }, null, 2) + '\n');
}
if (!existsSync(resolve(output, '.npmrc'))) {
  writeFileSync(resolve(output, '.npmrc'), '@groundhogchain:registry=https://npm.pkg.github.com\n');
}
console.log(`Counter part ${part} files prepared in ${output}`);
