import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const base = process.argv[2];
if (!base || process.argv.length !== 3) {
  throw new Error('Usage: node scripts/check-agent-guide-history.mjs <base-commit>');
}
const cwd = fileURLToPath(new URL('../', import.meta.url));
// Resolve a commit before using it in a diff; missing history must fail closed.
const commit = execFileSync('git', ['rev-parse', '--verify', '--end-of-options', `${base}^{commit}`], {
  cwd, encoding: 'utf8',
}).trim();
const changed = execFileSync('git', [
  'diff', '--name-only', '--no-renames', '--diff-filter=MDT', commit, '--',
  ':(glob)public/agents/*/agent-guide.md',
], { cwd, encoding: 'utf8' }).trim();
if (changed) {
  throw new Error(`Existing versioned guides must not change or disappear:\n${changed}`);
}
console.log('Existing versioned guides preserved');
