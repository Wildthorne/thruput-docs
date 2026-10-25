import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pages } from './cli-commands.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

/**
 * Return packages whose mentioned versions disagree. A two-part mention such as `0.24`
 * agrees with full versions that share its major and minor.
 */
function conflicts(pagesText) {
  const versions = {};
  for (const [page, text] of pagesText) {
    for (const [, name, version] of text.matchAll(/(@thruputchain\/[a-z-]+)(?:@|`? `?)v?(\d+\.\d+(?:\.\d+(?:-[\w.]+)?)?)/g)) {
      ((versions[name] ??= {})[version] ??= []).push(page);
    }
  }
  return Object.entries(versions).filter(([, found]) => {
    const all = Object.keys(found);
    const full = all.filter(v => v.split('.').length > 2);
    const partial = all.filter(v => v.split('.').length === 2);
    if (new Set(full).size > 1) return true;
    if (full.length) return partial.some(v => !full[0].startsWith(`${v}.`));
    return partial.length > 1;
  });
}

test('version conflicts include two-part mentions', () => {
  const page = text => [['page.md', text]];
  assert.deepEqual(conflicts(page('`@thruputchain/client@0.24.0` and `@thruputchain/client` `0.24`')), []);
  assert.equal(conflicts(page('`@thruputchain/client@0.24.0` and `@thruputchain/client` `0.25`')).length, 1);
  assert.equal(conflicts(page('@thruputchain/client@0.24.0 and `@thruputchain/client` 0.24.1')).length, 1);
  assert.equal(conflicts(page('@thruputchain/react 0.7 and @thruputchain/react 0.8')).length, 1);
});

test('docs pin one version of each @thruputchain package', () => {
  const texts = [...pages(join(root, 'src/content/docs'))].map(page => [relative(root, page), readFileSync(page, 'utf8')]);
  assert.deepEqual(conflicts(texts), [], 'Pages pin different versions of the same package');
});
