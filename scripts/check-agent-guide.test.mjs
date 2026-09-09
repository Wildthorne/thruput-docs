import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, cpSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const source = fileURLToPath(new URL('../', import.meta.url));
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'agent-guide-check-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'scripts'));
  cpSync(join(source, 'scripts/check-agent-guide.mjs'), join(root, 'scripts/check-agent-guide.mjs'));
  cpSync(join(source, 'public'), join(root, 'public'), { recursive: true });
  return {
    root,
    run: () => spawnSync(process.execPath, [join(root, 'scripts/check-agent-guide.mjs')], { encoding: 'utf8' }),
    write: (path, bytes) => writeFileSync(join(root, 'public', path), bytes),
  };
}

test('accepts the selected source guide', (t) => {
  const result = fixture(t).run();
  assert.equal(result.status, 0, result.stderr);
});

test('rejects drift in the current alias', (t) => {
  const f = fixture(t);
  f.write('agent-guide.md', 'edited copy');
  const result = f.run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /differs from versioned/);
});

test('rejects modified versioned bytes even when the alias matches', (t) => {
  const f = fixture(t);
  const manifest = JSON.parse(readFileSync(join(f.root, 'public/agents/current.json')));
  for (const path of ['agent-guide.md', `agents/${manifest.version}/agent-guide.md`]) f.write(path, 'edited guide');
  const result = f.run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /checksum differs/);
});

test('rejects a mismatched CLI marker with an otherwise correct checksum', (t) => {
  const f = fixture(t);
  const manifest = JSON.parse(readFileSync(join(f.root, 'public/agents/current.json')));
  const bytes = '<!-- groundhog-cli-version: 0.0.0 -->\n';
  manifest.sha256 = createHash('sha256').update(bytes).digest('hex');
  f.write('agents/current.json', JSON.stringify(manifest));
  for (const path of ['agent-guide.md', `agents/${manifest.version}/agent-guide.md`]) f.write(path, bytes);
  const result = f.run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /does not identify/);
});
