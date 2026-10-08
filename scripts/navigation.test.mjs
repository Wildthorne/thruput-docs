import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { sections, sectionForPath } from '../src/navigation.ts';

test('every published documentation page has exactly one sidebar owner', () => {
  const root = fileURLToPath(new URL('../src/content/docs/', import.meta.url));
  const pages = readdirSync(root, { recursive: true })
    .filter(path => /\.mdx?$/.test(path))
    .map(path => path.replace(/\.mdx?$/, '').replace(/\/index$/, ''));
  const entries = sections.flatMap(section => section.items.flatMap(item =>
    typeof item === 'string' ? [item] : 'items' in item ? item.items : []
  ));

  assert.equal(new Set(entries).size, entries.length, 'A page cannot belong to multiple sidebars');
  assert.deepEqual([...entries].sort(), [...pages].sort(), 'Missing pages or stale sidebar entries');
  for (const page of pages) {
    assert.ok(sectionForPath(`/${page}/`), `Missing section for ${page}`);
  }
});

test('legacy deep links resolve to their task area before matching URL roots', () => {
  assert.equal(sectionForPath('/reference/storage-types/')?.id, 'contracts');
  assert.equal(sectionForPath('/reference/json-rpc-api/')?.id, 'reference');
  assert.equal(sectionForPath('/tutorials/connect-a-wallet-to-your-app/')?.id, 'guides');
  assert.equal(sectionForPath('/start/build-with-an-agent/')?.id, 'get-started');
  assert.equal(sectionForPath('/tools/faucet/')?.id, 'tools');
  assert.equal(sectionForPath('/tools/block-explorer/')?.id, 'tools');
  assert.equal(sectionForPath('/cli/reference/')?.id, 'cli');
  assert.equal(sectionForPath('/contracts/errors/')?.id, 'contracts');
  assert.equal(sectionForPath('/tutorials/build-a-counter/')?.id, 'guides');
  assert.equal(sectionForPath('/react')?.id, 'react');
  assert.equal(sectionForPath('/react/wallets/')?.id, 'react');
  assert.equal(sectionForPath('/reactive/'), undefined);
  assert.equal(sectionForPath('/'), undefined);
});
