import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import markdownExport, { buildProvenance } from './markdown-export.mjs';

beforeEach(t => {
  for (const key of ['GIT_DIR', 'GIT_WORK_TREE']) {
    const saved = process.env[key];
    delete process.env[key];
    t.after(() => {
      if (saved === undefined) delete process.env[key];
      else process.env[key] = saved;
    });
  }
});

async function directory(t) {
  const root = await mkdtemp(join(tmpdir(), 'docs-provenance-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test('Git-less builds use the Railway revision without claiming a clean working tree', async t => {
  const root = await directory(t);
  assert.deepEqual(buildProvenance(root, '0.19.0', { RAILWAY_GIT_COMMIT_SHA: 'A'.repeat(40) }), {
    schemaVersion: 1, sourceRevision: 'a'.repeat(40), sourceDirty: null, agentGuideCliVersion: '0.19.0',
  });
});

test('missing or invalid deployment metadata remains explicitly unknown', async t => {
  const root = await directory(t);
  for (const value of [undefined, '', 'f86ac1d5', '<untrusted metadata>']) {
    const snapshot = buildProvenance(root, '0.19.0', { RAILWAY_GIT_COMMIT_SHA: value });
    assert.equal(snapshot.sourceRevision, null);
    assert.equal(snapshot.sourceDirty, null);
  }
});

test('Railway builds also work when the Git executable is absent', async t => {
  const root = await directory(t);
  const module = new URL('./markdown-export.mjs', import.meta.url).href;
  const output = execFileSync(process.execPath, ['--input-type=module', '-e',
    `import { buildProvenance } from ${JSON.stringify(module)};
     console.log(JSON.stringify(buildProvenance(process.cwd(), '0.19.0', { RAILWAY_GIT_COMMIT_SHA: '${'d'.repeat(40)}' })));`], {
    cwd: root, encoding: 'utf8', env: { ...process.env, PATH: '' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  const snapshot = JSON.parse(output);
  assert.equal(snapshot.sourceRevision, 'd'.repeat(40));
  assert.equal(snapshot.sourceDirty, null);
});

test('local Git identity and dirty state take precedence over deployment environment', async t => {
  const root = await directory(t);
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8',
    env: { ...process.env, GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 'test@example.test',
      GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 'test@example.test' } }).trim();
  git('init', '--quiet');
  await writeFile(join(root, 'source.md'), 'Original content\n');
  git('add', 'source.md');
  git('commit', '--quiet', '-m', 'Fixture');
  const revision = git('rev-parse', 'HEAD');
  const env = { RAILWAY_GIT_COMMIT_SHA: 'b'.repeat(40) };
  assert.deepEqual(buildProvenance(root, '0.19.0', env), {
    schemaVersion: 1, sourceRevision: revision, sourceDirty: false, agentGuideCliVersion: '0.19.0',
  });
  await writeFile(join(root, 'source.md'), 'Changed content\n');
  assert.equal(buildProvenance(root, '0.19.0', env).sourceDirty, true);
  git('restore', 'source.md');
  await writeFile(join(root, 'untracked.md'), 'New content\n');
  assert.equal(buildProvenance(root, '0.19.0', env).sourceDirty, true);
});

test('explicit CLI snapshot metadata is preserved and malformed JSON is rejected', () => {
  const snapshot = { schemaVersion: 1, sourceRevision: 'c'.repeat(40), sourceDirty: false, agentGuideCliVersion: '1.2.3' };
  assert.deepEqual(buildProvenance('/missing-checkout', '0.19.0', {
    THRUPUT_DOCS_SNAPSHOT: JSON.stringify(snapshot), RAILWAY_GIT_COMMIT_SHA: 'a'.repeat(40),
  }), snapshot);
  assert.throws(() => buildProvenance('/missing-checkout', '0.19.0', { THRUPUT_DOCS_SNAPSHOT: '{' }), SyntaxError);
});

test('the build hook exports Markdown without Git or deployment metadata', async t => {
  const root = await directory(t);
  const output = join(root, 'dist');
  await mkdir(join(root, 'public/agents'), { recursive: true });
  await mkdir(output);
  await writeFile(join(root, 'public/agents/historical.json'), JSON.stringify({ version: '0.19.0' }));
  await writeFile(join(output, 'index.html'), '<html><head><title>Docs</title></head><body><main><h1>Docs</h1><p>Content survives.</p></main></body></html>');
  const saved = [process.env.THRUPUT_DOCS_SNAPSHOT, process.env.RAILWAY_GIT_COMMIT_SHA];
  delete process.env.THRUPUT_DOCS_SNAPSHOT;
  delete process.env.RAILWAY_GIT_COMMIT_SHA;
  t.after(() => {
    for (const [index, key] of ['THRUPUT_DOCS_SNAPSHOT', 'RAILWAY_GIT_COMMIT_SHA'].entries()) {
      if (saved[index] === undefined) delete process.env[key];
      else process.env[key] = saved[index];
    }
  });
  const integration = markdownExport({ sections: [], sectionForPath: () => undefined });
  integration.hooks['astro:config:done']({ config: { root: pathToFileURL(`${root}/`), site: 'https://docs.example.test/' } });
  await integration.hooks['astro:build:done']({ dir: pathToFileURL(`${output}/`), logger: { info() {} } });
  const page = await readFile(join(output, 'markdown/pages/index.md'), 'utf8');
  assert.match(page, /Documentation source revision unavailable for this build/);
  assert.match(page, /Content survives/);
  assert.doesNotMatch(page, /`null`|uncommitted preview/);
  const manifest = JSON.parse(await readFile(join(output, 'markdown/manifest.json'), 'utf8'));
  assert.equal(manifest.snapshot.sourceRevision, null);
  assert.equal(manifest.snapshot.sourceDirty, null);
});
