import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { toMarkdown } from 'mdast-util-to-markdown';
import { gfmToMarkdown } from 'mdast-util-gfm';
import { visit } from 'unist-util-visit';
import { readPage } from './markdown-content.mjs';
import { exportMarkdown } from './markdown-export.mjs';
import { hostedDocsUrl } from './docs-routing.mjs';
import { validateMarkdown } from './markdown-validation.mjs';

const site = 'https://docs.example.test/';
const snapshot = { schemaVersion: 1, sourceRevision: 'a'.repeat(40), sourceDirty: false, agentGuideCliVersion: '1.2.3' };
const html = body => `<html><head><title>Example</title><meta name="description" content="Example description"></head>
  <body><nav>Browser navigation</nav><main><h1 id="_top">Example</h1><div class="sl-markdown-content">${body}</div></main></body></html>`;
const render = body => toMarkdown(readPage(html(body), site).tree, { extensions: [gfmToMarkdown()] });

test('rendered code preserves indentation, empty lines, HTML characters, and language', () => {
  const page = readPage(html(`<div class="expressive-code"><figure>
    <figcaption><span class="title">main.ts</span><span class="sr-only">Editor</span></figcaption>
    <pre data-language="ts"><code><div class="ec-line"><div class="code"><span>if (a &lt; b) {</span></div></div><div class="ec-line"><div class="code">  run(&quot;x&quot;);</div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code">}</div></div></code></pre>
    <div class="copy"><button>Copy</button></div></figure></div>`), site);
  const code = [];
  visit(page.tree, 'code', node => { code.push(node); });
  assert.equal(code.length, 1);
  assert.equal(code[0].value, 'if (a < b) {\n  run("x");\n\n}');
  assert.equal(code[0].lang, 'ts');
  const markdown = toMarkdown(page.tree);
  assert.ok(markdown.includes('**main.ts**'));
  assert.doesNotMatch(markdown, /Copy|Editor|span|Browser navigation/);
});

test('warnings retain their kind, accessible title, and body', () => {
  const markdown = render(`<aside class="starlight-aside starlight-aside--caution" aria-label="Not implemented">
    <p class="starlight-aside__title" aria-hidden="true"><svg></svg>Not implemented</p><p>Do not rely on this feature.</p></aside>`);
  assert.match(markdown, /> \*\*caution: Not implemented\*\*/);
  assert.match(markdown, /> Do not rely on this feature\./);
});

test('all tab choices, steps, tables, details, and described diagrams remain readable', () => {
  const markdown = render(`<starlight-tabs><div role="tablist"><button role="tab" id="a" aria-controls="pa">Rust</button><button role="tab" id="b" aria-controls="pb">TypeScript</button></div>
    <div role="tabpanel" id="pa" aria-labelledby="a"><p>Rust example</p></div>
    <div role="tabpanel" id="pb" aria-labelledby="b" hidden><p>TypeScript example</p></div></starlight-tabs>
    <ol class="sl-steps"><li>Build</li><li>Test</li></ol>
    <table><thead><tr><th>Type</th><th>Use</th></tr></thead><tbody><tr><td>Balance</td><td>Tokens</td></tr></tbody></table>
    <details><summary>Prerequisites</summary><p>Registry access is required.</p></details>
    <svg role="img"><title>Execution</title><desc>Submit, then commit</desc></svg>`);
  for (const text of ['### Rust', '### TypeScript', 'Rust example', 'TypeScript example', '1. Build', '2. Test', '| Balance', '**Prerequisites**', 'Registry access is required.', 'Diagram: Execution Submit, then commit']) {
    assert.ok(markdown.includes(text), `${text}\n${markdown}`);
  }
});

test('unlabelled content diagrams and tab panels fail instead of losing meaning', () => {
  assert.throws(() => render('<svg role="img"><path /></svg>'), /diagram needs/);
  assert.throws(() => render('<div role="tabpanel">Unlabelled</div>'), /panel needs/);
});

async function fixture(t, homeBody) {
  const directory = await mkdtemp(join(tmpdir(), 'groundhog-markdown-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  for (const [path, content] of [
    ['index.html', html(homeBody)],
    ['contracts/start/index.html', html('<h2 id="build">Build</h2><p>Keep prerequisites.</p>')],
    ['legacy/index.html', '<a data-redirect data-fragment-routes=\'{"old-build":"/contracts/start/#build"}\' href="/contracts/start/">Moved</a>'],
    ['images/chart.svg', '<svg xmlns="http://www.w3.org/2000/svg"><title>Diagram</title></svg>'],
  ]) {
    await mkdir(dirname(join(directory, path)), { recursive: true });
    await writeFile(join(directory, path), content);
  }
  return directory;
}

test('exports pages and bundles with portable links, copied assets, discovery and provenance', async t => {
  const directory = await fixture(t, '<a href="/legacy/#old-build">Build a contract</a><img src="/images/chart.svg" alt="Execution flow"><a href="https://external.example/api">API</a>');
  const count = await exportMarkdown({ directory, site, snapshot });
  assert.equal(count, 2);
  const page = await readFile(join(directory, 'markdown/pages/index.md'), 'utf8');
  assert.ok(page.includes('[Build a contract](contracts/start.md#build)'));
  assert.ok(page.includes('![Execution flow](../assets/images/chart.svg)'));
  assert.ok(page.includes('[API](https://external.example/api)'));
  assert.ok(page.includes(snapshot.sourceRevision));
  assert.ok(page.includes(`Documentation source: \`${'a'.repeat(40)}\``));
  assert.ok(!page.includes('CLI 1.2.3'), 'pages must not present the agent guide version as the docs version');
  const index = await readFile(join(directory, 'markdown/index.md'), 'utf8');
  assert.ok(index.includes('sections/overview.md'));
  const full = await readFile(join(directory, 'markdown/full.md'), 'utf8');
  assert.ok(full.includes('(pages/contracts/start.md#build)'));
  assert.ok((await readFile(join(directory, 'llms-full.txt'), 'utf8')).includes('(markdown/pages/contracts/start.md#build)'));
  assert.ok((await readFile(join(directory, 'index.html'), 'utf8')).includes('type="text/markdown" href="/markdown/pages/index.md"'));
  assert.ok((await readFile(join(directory, 'markdown/assets/images/chart.svg'), 'utf8')).includes('<svg'));
  // Validate an actual copied Markdown tree after the HTML site is gone.
  const { cp } = await import('node:fs/promises');
  await cp(join(directory, 'markdown'), join(directory, 'portable'), { recursive: true });
  await rm(join(directory, 'markdown'), { recursive: true });
  await validateMarkdown(join(directory, 'portable'), ['index.md', 'full.md', 'sections/overview.md', 'pages/index.md', 'pages/contracts/start.md']);
});

test('broken local links and fragments stop export', async t => {
  for (const href of ['/missing/', '/contracts/start/#missing']) {
    const directory = await fixture(t, `<a href="${href}">Broken</a>`);
    await assert.rejects(exportMarkdown({ directory, site, snapshot }), /Broken/);
  }
});

test('indexes and bundles follow navigation order, including grouped entries', async t => {
  const directory = await fixture(t, '<p>Home</p>');
  const slugs = ['guides', 'tutorials/build-a-counter', 'tutorials/work-with-thruput-from-typescript',
    'tutorials/build-a-counter-with-react', 'tutorials/connect-a-wallet-to-your-app'];
  for (const [index, slug] of slugs.entries()) {
    const path = join(directory, slug, 'index.html');
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, html(`<p>Chapter marker ${index}</p>`));
  }
  const section = { id: 'guides', label: 'Guides', items: [slugs[0],
    { label: 'Counter', items: slugs.slice(1) }, { label: 'External', link: 'https://example.test/' }] };
  await exportMarkdown({ directory, site, snapshot, sections: [section],
    sectionForPath: path => slugs.some(slug => path === `/${slug}/`) ? section : undefined });
  for (const file of ['markdown/index.md', 'llms.txt']) {
    const content = await readFile(join(directory, file), 'utf8');
    const positions = slugs.map(slug => content.indexOf(`pages/${slug}.md`));
    assert.ok(positions.every(position => position >= 0));
    assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
  }
  for (const file of ['markdown/sections/guides.md', 'markdown/full.md', 'llms-full.txt']) {
    const content = await readFile(join(directory, file), 'utf8');
    const positions = slugs.map((_, index) => content.indexOf(`Chapter marker ${index}`));
    assert.ok(positions.every(position => position >= 0));
    assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
  }
});

test('snapshot pages cite their hosted docs URL', () => {
  assert.equal(hostedDocsUrl('https://thruput.network/'), 'https://thruput.network/');
  assert.equal(hostedDocsUrl('https://thruput.network/guides/build-a-token/'), 'https://thruput.network/docs/guides/build-a-token/');
  assert.equal(hostedDocsUrl('https://thruput.network/docs/cli/install/'), 'https://thruput.network/docs/cli/install/');
});

test('snapshot exports cite hosted URLs on pages and bundles', async t => {
  const directory = await fixture(t, '<p>Home</p>');
  await exportMarkdown({ directory, site, snapshot, routePrefix: '' });
  const source = path => readFile(join(directory, 'markdown', path), 'utf8');
  assert.ok((await source('pages/contracts/start.md')).includes(`Source: <${site}docs/contracts/start/>`));
  assert.ok((await source('full.md')).includes(`Source: <${site}docs/contracts/start/>`));
  assert.ok((await source('pages/index.md')).includes(`Source: <${site}>`));
});
