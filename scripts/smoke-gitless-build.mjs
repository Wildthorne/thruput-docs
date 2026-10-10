// Exercise Railway/source-archive builds without moving or modifying the real .git directory.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = await mkdtemp(join(tmpdir(), 'docs-gitless-build-'));
try {
  const files = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
  for (const file of files) {
    await mkdir(dirname(join(source, file)), { recursive: true });
    await cp(resolve(root, file), join(source, file));
  }
  // Astro needs dependencies inside this project root, not an external symlink.
  await cp(resolve(root, 'node_modules'), join(source, 'node_modules'), { recursive: true, verbatimSymlinks: true });
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const env = { ...process.env };
  for (const key of ['THRUPUT_DOCS_SNAPSHOT', 'RAILWAY_GIT_COMMIT_SHA', 'GIT_DIR', 'GIT_WORK_TREE']) delete env[key];
  assert.throws(() => execFileSync('git', ['rev-parse', 'HEAD'], { cwd: source, env, stdio: 'pipe' }),
    'The fixture must not inherit a Git checkout');

  for (const railwayRevision of [revision, null]) {
    // Run the same package script without pnpm trying to reinstall the copied dependency tree.
    const output = execFileSync('npm', ['run', 'build'], {
      cwd: source,
      env: { ...env, ...(railwayRevision ? { RAILWAY_GIT_COMMIT_SHA: railwayRevision } : {}) },
      encoding: 'utf8', stdio: 'pipe', maxBuffer: 10 * 1024 * 1024,
    });
    assert.match(output, /Exported \d+ Markdown pages/);
    const manifest = JSON.parse(await readFile(join(source, 'dist/markdown/manifest.json'), 'utf8'));
    assert.equal(manifest.snapshot.sourceRevision, railwayRevision);
    assert.equal(manifest.snapshot.sourceDirty, null);
    assert.ok(manifest.pages.length > 50);
    for (const path of ['markdown/index.md', 'markdown/full.md', 'llms.txt', 'llms-full.txt']) {
      const text = await readFile(join(source, 'dist', path), 'utf8');
      assert.ok(text.includes(railwayRevision ?? 'Documentation source revision unavailable'));
      if (railwayRevision) assert.match(text, /working-tree status unavailable/);
    }
    console.log(`Git-less site build passed: ${railwayRevision ? 'Railway commit metadata' : 'no deployment metadata'}.`);
  }
} finally {
  await rm(source, { recursive: true, force: true });
}
