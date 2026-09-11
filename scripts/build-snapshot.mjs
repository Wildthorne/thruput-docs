import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, 'dist/docs-snapshot');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const guide = JSON.parse(readFileSync(resolve(root, 'public/agents/current.json'), 'utf8'));
const snapshot = {
  schemaVersion: 1,
  sourceRevision: git('rev-parse', 'HEAD'),
  sourceDirty: git('status', '--porcelain', '--untracked-files=normal') !== '',
  agentGuideCliVersion: guide.version,
};

// Invalidate an older snapshot before building. A failed build must not leave a
// manifest that makes partial output appear ready to the CLI.
rmSync(resolve(output, 'snapshot.json'), { force: true });
execFileSync(process.execPath, ['scripts/check-agent-guide.mjs'], { cwd: root, stdio: 'inherit' });
execFileSync(process.execPath, ['node_modules/astro/bin/astro.mjs', 'build', '--outDir', output], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, GROUNDHOG_DOCS_SNAPSHOT: JSON.stringify(snapshot) },
});
writeFileSync(resolve(output, 'snapshot.json'), `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`\nSnapshot ready: ${output}\nPass this directory to groundhog docs --dir.`);
