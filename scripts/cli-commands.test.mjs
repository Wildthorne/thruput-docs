import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkInvocation, docCommands, pages } from './cli-commands.mjs';
import { parseHelp, surfacePath } from './cli-surface.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

test('help parsing captures subcommands, aliases, flags, and value flags', () => {
  const help = [
    'Manage keys', '', 'Usage: thruput keys <COMMAND>', '', 'Commands:',
    '  generate  Generate a key', '  ls        List stored keys [alias: list]', '  help      Print help', '',
    'Options:', '  -y, --yes      Confirm [aliases: --force, -f]', '  -p, --package <PACKAGE>', '  -h, --help     Print help', '',
    'Global options:', '      --json     JSON output',
  ].join('\n');
  assert.deepEqual(parseHelp(help), {
    subcommands: { generate: [], ls: ['list'] },
    flags: ['--force', '--help', '--json', '--package', '--yes', '-f', '-h', '-p', '-y'],
    values: ['--package', '-p'],
  });
});

test('command extraction handles prompts, env prefixes, continuations, pipes, and substitutions', () => {
  const page = [
    '```bash', '$ thruput keys ls', 'FOO=1 thruput deploy \\', '  --fund 10 | jq .', 'echo "$(thruput --version)"',
    'thruput deploy --fund $(thruput balance) --yes', '```',
    'Run `thruput tx show <HASH> [--json]` or `cargo build`.',
    'Then ``thruput keys ls && P=local thruput keys "ls"``.',
    '```fish', "echo '&&' thruput removed; thruput build -p ';' --yes", '```',
  ].join('\n');
  assert.deepEqual([...docCommands(page)].map(c => c.args), [
    ['keys', 'ls'], ['deploy', '--fund', '10'], ['--version'], ['balance'], ['deploy', '--fund', '$SUB', '--yes'],
    ['tx', 'show', '<HASH>', '--json'], ['keys', 'ls'], ['keys', 'ls'], ['build', '-p', ';', '--yes'],
  ]);
});

test('invocation check reports unknown subcommands and flags', () => {
  const commands = {
    '': { subcommands: { keys: [] }, flags: ['--json', '-V'], values: [] },
    keys: { subcommands: { ls: ['list'] }, flags: ['--json', '--profile', '-p'], values: ['--profile', '-p'] },
    'keys ls': { subcommands: {}, flags: ['--json', '-a', '-b'], values: [] },
  };
  for (const ok of [
    ['keys', 'list', '--json', '-ab'], ['keys', '<COMMAND>'], ['--json', 'keys', 'ls'], ['help', 'keys'],
    ['keys', '--profile', 'local', 'ls'], ['keys', '-plocal', 'ls'], ['keys', '--profile=local', 'ls'],
  ]) assert.deepEqual(checkInvocation(ok, commands), [], ok.join(' '));
  assert.deepEqual(checkInvocation(['keys', 'show', 'alice', '--all'], commands), [
    'unknown subcommand show for `thruput keys`', 'unknown flag --all for `thruput keys`',
  ]);
  assert.deepEqual(checkInvocation(['--json', 'removed'], commands), ['unknown subcommand removed for `thruput`']);
  assert.deepEqual(checkInvocation(['keys', 'ls', '-V'], commands), ['unknown flag -V for `thruput keys ls`']);
  assert.deepEqual(checkInvocation(['keys', '--profile', '--removed'], commands), ['unknown flag --removed for `thruput keys`']);
  assert.deepEqual(checkInvocation(['help', 'keys', 'removed'], commands), ['unknown subcommand removed for `thruput keys`']);
});

test('docs use only commands and flags the target CLI accepts', () => {
  const { cli, commands } = JSON.parse(readFileSync(surfacePath, 'utf8'));
  const problems = [];
  for (const page of pages(join(root, 'src/content/docs'))) {
    for (const { line, args } of docCommands(readFileSync(page, 'utf8'))) {
      for (const problem of checkInvocation(args, commands)) problems.push(`${relative(root, page)}:${line}: ${problem}`);
    }
  }
  assert.deepEqual(problems, [], `Docs disagree with ${cli}. Fix the docs, or regenerate scripts/cli-surface.json for a newer CLI.`);
});
