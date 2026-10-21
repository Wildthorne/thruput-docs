import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { createInterface } from 'node:readline';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { chromium } from '@playwright/test';
import { visit } from 'unist-util-visit';
import { parseMarkdown, validateMarkdown } from './markdown-validation.mjs';

const binary = process.argv[2];
if (!binary) throw new Error('Usage: node scripts/smoke-snapshot.mjs /path/to/thruput');
const exported = mkdtempSync(resolve(tmpdir(), 'thruput-docs-export-'));
try {
  const output = resolve(exported, 'docs');
  const result = spawnSync(resolve(binary), ['docs', 'export', '--dir', resolve('dist/docs-snapshot'), '--output', output, '--json'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, true);
  assert.equal(report.data.index, resolve(output, 'index.md'));
  const paths = readdirSync(output, { recursive: true }).filter(path => path.endsWith('.md'));
  await validateMarkdown(output, paths);
  const codes = source => {
    const result = [];
    visit(parseMarkdown(source), 'code', node => { result.push(node.value); });
    return result;
  };
  for (const page of ['get-started/react', 'get-started/contract', 'guides/build-a-token', 'reference/json-rpc-api']) {
    assert.deepEqual(codes(readFileSync(resolve(output, `pages/${page}.md`), 'utf8')),
      codes(readFileSync(resolve(`src/content/docs/${page}.md`), 'utf8')), `Code changed in ${page}`);
  }
  assert.ok(readFileSync(resolve(output, 'pages/reference/json-rpc-api.md'), 'utf8').includes('Not Yet Implemented'));
  assert.deepEqual(JSON.parse(readFileSync(resolve(output, 'snapshot.json'), 'utf8')), report.data.snapshot);
  console.log(`CLI exported ${paths.length} Markdown files; portable links and source code examples verified.`);
} finally {
  rmSync(exported, { recursive: true, force: true });
}
const server = spawn(resolve(binary), ['docs', '--dir', resolve('dist/docs-snapshot'), '--port', '0', '--json'], {
  stdio: ['ignore', 'pipe', 'inherit'],
});
const stopped = once(server, 'exit');
const lines = createInterface({ input: server.stdout });
let timer;
let browser;
try {
  const ready = await Promise.race([
    once(lines, 'line').then(([line]) => JSON.parse(line)),
    stopped.then(([code]) => { throw new Error(`Server exited before readiness: ${code}`); }),
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Server readiness timeout')), 15000); }),
  ]);
  clearTimeout(timer);
  const origin = new URL(ready.data.url).origin;
  assert.equal(ready.data.markdownIndex, resolve('dist/docs-snapshot/markdown/index.md'));
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const externalRequests = [];
  await context.route('**/*', route => {
    if (new URL(route.request().url()).origin === origin) return route.continue();
    externalRequests.push(route.request().url());
    return route.abort();
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin);
  await page.getByRole('complementary', { name: 'Local documentation snapshot' }).waitFor();
  const prompt = await page.locator('textarea[name="agent-prompt"]').inputValue();
  assert.ok(prompt.includes(`${origin}/cli/install/`));
  assert.ok(!prompt.includes('https://thruput.network'));
  await page.goto(`${origin}/start/`);
  await page.waitForURL(`${origin}/architecture/`);
  assert.equal(await page.locator('main h1').textContent(), 'Introduction');
  for (const [legacy, destination, fragment] of [
    ['reference/error-handling', 'contracts/errors', 'defining-errors'],
    ['reference/cross-contract-calls', 'contracts/cross-contract-calls', 'gas-limits'],
    ['programming-model/advanced', 'programming-model/storage-types', 'lock-requests'],
    ['programming-model/advanced', 'programming-model/nnint', 'negative-set-values'],
  ]) {
    await page.goto(`${origin}/${legacy}/#${fragment}`);
    await page.waitForURL(`${origin}/${destination}/#${fragment}`);
    assert.equal(await page.locator(`[id="${fragment}"]`).count(), 1);
  }
  await page.goto(`${origin}/tutorials/add-events-to-a-contract/#step-5-query-it-on-chain`);
  await page.waitForURL(`${origin}/typescript/events/#query-events`);
  await page.goto(`${origin}/tutorials/develop-locally/#4-start-the-local-node`);
  await page.waitForURL(`${origin}/cli/local-node/#start-the-node`);
  await page.goto(`${origin}/tutorials/build-a-counter/`);
  await page.locator('main h1').waitFor();
  const actions = page.locator('page-actions');
  await actions.locator('summary').click();
  await actions.getByRole('button', { name: 'Copy link for an agent' }).click();
  await page.waitForFunction(() => document.querySelector('page-actions [role="status"]')?.textContent === 'Copied');
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), `${origin}/markdown/pages/tutorials/build-a-counter.md`);
  await actions.getByRole('button', { name: 'Copy task prompt' }).click();
  await page.waitForFunction(() => document.querySelector('page-actions [role="status"]')?.textContent === 'Copied');
  const task = await page.evaluate(() => navigator.clipboard.readText());
  assert.ok(task.includes(`${origin}/tutorials/build-a-counter/`));
  assert.ok(!task.includes('https://thruput.network/'));
  await page.locator('site-search > button').click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: /^Search/ }).fill('storage');
  const result = dialog.locator('.pagefind-ui__result-link').first();
  await result.waitFor();
  assert.equal(new URL(await result.getAttribute('href'), origin).origin, origin);
  await result.click();
  await page.locator('main h1').waitFor();
  mkdirSync('test-results/snapshot', { recursive: true });
  await page.screenshot({ path: 'test-results/snapshot/desktop.png', fullPage: false });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.screenshot({ path: 'test-results/snapshot/mobile.png', fullPage: false });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  const guide = await context.request.get(`${origin}/agent-guide.md`);
  assert.equal(guide.status(), 200);
  assert.ok((await guide.text()).includes('thruput skill install'));
  const markdown = await context.request.get(`${origin}/markdown/pages/get-started/react.md`);
  assert.equal(markdown.status(), 200);
  assert.ok(markdown.headers()['content-type'].startsWith('text/markdown'));
  assert.ok((await markdown.text()).includes('useContractView'));
  const index = await context.request.get(`${origin}/llms.txt`);
  assert.equal(index.status(), 200);
  assert.ok((await index.text()).includes('markdown/sections/react.md'));
  assert.deepEqual(errors, []);
  assert.deepEqual(externalRequests, []);
  console.log('Snapshot smoke passed: real CLI, tutorial, search navigation, local agent prompt, Markdown guide, desktop/mobile, no external requests.');
} finally {
  clearTimeout(timer);
  await browser?.close();
  lines.close();
  server.kill('SIGTERM');
  await stopped;
}
