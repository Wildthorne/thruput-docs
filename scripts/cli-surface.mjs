// Record the CLI's command tree so tests can check `thruput ...` lines in the docs
// without installing the CLI. Regenerate after each CLI release the docs target:
//   THRUPUT_CLI=/path/to/thruput node scripts/cli-surface.mjs
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const surfacePath = fileURLToPath(new URL('./cli-surface.json', import.meta.url));

const aliasList = text => (text.match(/\[alias(?:es)?: ([^\]]+)\]/)?.[1] ?? '').split(',').map(s => s.trim()).filter(Boolean);

/** Parse one `--help` page into subcommands, flags (long and short, including aliases), and the flags that take a value. */
export function parseHelp(help) {
  const subcommands = {};
  const flags = new Set();
  const values = new Set();
  let section = '';
  for (const line of help.split('\n')) {
    const heading = line.match(/^([A-Z][A-Za-z ]*):\s*$/);
    if (heading) { section = heading[1]; continue; }
    if (section === 'Commands') {
      const command = line.match(/^ {2}([a-z][a-z0-9-]*)\s/);
      if (command && command[1] !== 'help') subcommands[command[1]] = aliasList(line);
    } else if (/[Oo]ptions$/.test(section)) {
      const option = line.match(/^ {2,6}(-[A-Za-z0-9])?(?:, )?(--[a-z0-9][a-z0-9-]*)?([ =]\[?<)?/);
      const names = [option?.[1], option?.[2], ...aliasList(line)].filter(Boolean);
      for (const name of names) {
        flags.add(name);
        if (option[3]) values.add(name);
      }
    }
  }
  return { subcommands, flags: [...flags].sort(), values: [...values].sort() };
}

/** Walk every subcommand's help through the given CLI binary. */
export function readSurface(cli) {
  const home = mkdtempSync(join(tmpdir(), 'cli-surface-'));
  const env = { ...process.env, NO_COLOR: '1', HOME: home, XDG_CONFIG_HOME: home, XDG_CACHE_HOME: home, XDG_DATA_HOME: home, XDG_STATE_HOME: home };
  const run = args => execFileSync(cli, args, { env, encoding: 'utf8' });
  try {
    const commands = {};
    const queue = [[]];
    while (queue.length) {
      const path = queue.shift();
      const page = parseHelp(run([...path, '--help']));
      commands[path.join(' ')] = page;
      for (const name of Object.keys(page.subcommands)) queue.push([...path, name]);
    }
    return { cli: run(['--version']).trim(), commands };
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const cli = process.env.THRUPUT_CLI;
  if (!cli) throw new Error('Set THRUPUT_CLI to the CLI binary the docs target');
  const surface = readSurface(cli);
  writeFileSync(surfacePath, `${JSON.stringify(surface, null, 2)}\n`);
  console.log(`Recorded ${Object.keys(surface.commands).length} commands from ${surface.cli}`);
}
