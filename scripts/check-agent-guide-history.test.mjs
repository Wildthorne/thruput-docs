import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, rmSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'guide-history-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  const write = (path, content) => writeFileSync(join(root, path), content);
  mkdirSync(join(root, 'scripts'));
  mkdirSync(join(root, 'public/agents/1.0.0'), { recursive: true });
  copyFileSync(new URL('./check-agent-guide-history.mjs', import.meta.url), join(root, 'scripts/check-agent-guide-history.mjs'));
  write('public/agents/1.0.0/agent-guide.md', 'original');
  git('init', '--quiet');
  git('add', '.');
  git('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'Baseline');
  const base = git('rev-parse', 'HEAD');
  return {
    root, git, write,
    run: (ref = base) => spawnSync(process.execPath, ['scripts/check-agent-guide-history.mjs', ref], { cwd: root, encoding: 'utf8' }),
  };
}

test('permits a new version and alias promotion', (t) => {
  const f = fixture(t);
  mkdirSync(join(f.root, 'public/agents/2.0.0'));
  f.write('public/agents/2.0.0/agent-guide.md', 'new');
  f.write('public/agent-guide.md', 'new');
  f.write('public/agents/current.json', '{"version":"2.0.0"}');
  f.git('add', '.');
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
});

test('rejects editing an existing version even when metadata and alias change', (t) => {
  const f = fixture(t);
  f.write('public/agents/1.0.0/agent-guide.md', 'replacement');
  f.write('public/agent-guide.md', 'replacement');
  f.write('public/agents/current.json', '{"sha256":"updated"}');
  const result = f.run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Existing versioned guides must not change/);
});

for (const action of ['delete', 'rename']) {
  test(`rejects ${action} of an older version`, (t) => {
    const f = fixture(t);
    const path = join(f.root, 'public/agents/1.0.0/agent-guide.md');
    if (action === 'delete') rmSync(path);
    else renameSync(path, join(f.root, 'public/agents/1.0.0/renamed.md'));
    f.git('add', '.');
    const result = f.run();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Existing versioned guides must not change/);
  });
}

test('fails when the comparison commit is unavailable', (t) => {
  const result = fixture(t).run('missing-base');
  assert.notEqual(result.status, 0);
});
