// Find `thruput ...` commands in docs Markdown and check them against the recorded
// CLI surface (scripts/cli-surface.json). Catches renamed or removed subcommands and flags.
// Scans shell fences and inline code. `text` fences hold prose (agent prompts) and are skipped.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const shellFences = new Set(['bash', 'sh', 'shell', 'zsh', 'fish', 'console', 'shellsession']);

/** Split a shell line into words (strings) and operators (`{ op }`). Keeps `<...>` placeholders whole and drops optional `[...]` brackets. */
export function tokenize(line) {
  const tokens = [];
  let word = '';
  const flush = () => {
    word = word.replace(/^\[+/, '').replace(/\]+(\.\.\.)?$/, '');
    const quoted = word.match(/^(["'])([^"'$]*)\1$/);
    if (word) tokens.push(quoted ? quoted[2] : word);
    word = '';
  };
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"' || c === "'") {
      const end = line.indexOf(c, i + 1);
      word += line.slice(i, end < 0 ? line.length : end + 1);
      i = end < 0 ? line.length : end;
    } else if (c === '<' && /[A-Za-z]/.test(line[i + 1] ?? '')) {
      const end = line.indexOf('>', i);
      word += line.slice(i, end < 0 ? line.length : end + 1);
      i = end < 0 ? line.length : end;
    } else if (c === '#' && !word) {
      break;
    } else if (/\s/.test(c)) {
      flush();
    } else if (line.startsWith('$(', i)) {
      flush(); tokens.push({ op: '$(' }); i++;
    } else if (line.startsWith('&&', i) || line.startsWith('||', i)) {
      flush(); tokens.push({ op: line.slice(i, i + 2) }); i++;
    } else if (';|()`'.includes(c)) {
      flush(); tokens.push({ op: c });
    } else {
      word += c;
    }
  }
  flush();
  return tokens;
}

/** Find each `thruput` invocation in a line and return its arguments. A `$(...)` substitution becomes one `$SUB` argument. */
export function invocations(line) {
  const found = [];
  const finish = segment => {
    let start = 0;
    if (segment[0] === '$') start++;
    while (/^[A-Z_][A-Z0-9_]*=/.test(segment[start] ?? '')) start++;
    if (segment[start] === 'thruput') found.push(segment.slice(start + 1));
  };
  const stack = [];
  let segment = [];
  for (const token of tokenize(line)) {
    const op = token.op;
    if (!op && token.startsWith('"') && token.includes('$(')) found.push(...invocations(token.slice(1, -1)));
    if (op === '$(' || op === '(') {
      stack.push({ segment, substitution: op === '$(' });
      segment = [];
    } else if (op === ')' && stack.length) {
      finish(segment);
      const outer = stack.pop();
      segment = outer.segment;
      if (outer.substitution) segment.push('$SUB');
    } else if (op) {
      finish(segment);
      segment = [];
    } else {
      segment.push(token);
    }
  }
  finish(segment);
  for (const { segment: outer } of stack.reverse()) finish(outer);
  return found;
}

const placeholder = word => /^(<.*>|\$|[A-Z][A-Z0-9_]*$|\.\.\.)/.test(word);

/** Return problems with one invocation, or an empty list when the CLI accepts its shape. */
export function checkInvocation(args, commands) {
  const problems = [];
  let path = '';
  let positional = false;
  let expectValue = false;
  for (const arg of args) {
    if (arg === '--') break;
    // clap rejects a flag in place of a value, so a following flag is checked as a flag.
    if (expectValue && !/^-[-A-Za-z0-9]/.test(arg)) { expectValue = false; continue; }
    expectValue = false;
    const node = commands[path];
    const where = `\`thruput${path ? ` ${path}` : ''}\``;
    if (/^--[A-Za-z]/.test(arg)) {
      const flag = arg.split('=')[0];
      if (!node.flags.includes(flag)) problems.push(`unknown flag ${flag} for ${where}`);
      expectValue = node.values.includes(flag) && !arg.includes('=');
      continue;
    }
    if (/^-[A-Za-z0-9]/.test(arg)) {
      // A short flag, a bundle such as `-qy`, or a short flag with an attached value such as `-pmy-counter`.
      for (let i = 1; i < arg.length; i++) {
        const flag = `-${arg[i]}`;
        if (!node.flags.includes(flag)) { problems.push(`unknown flag ${flag} for ${where}`); break; }
        if (node.values.includes(flag)) { expectValue = i === arg.length - 1; break; }
      }
      continue;
    }
    const subcommands = Object.entries(node.subcommands);
    if (positional || !subcommands.length) { positional = true; continue; }
    // Built-in `help` takes the same command path, so `thruput help keys ls` is checked as `thruput keys ls`.
    if (arg === 'help') continue;
    const match = subcommands.find(([name, aliases]) => name === arg || aliases.includes(arg));
    if (match) {
      path = path ? `${path} ${match[0]}` : match[0];
    } else {
      if (!placeholder(arg)) problems.push(`unknown subcommand ${arg} for ${where}`);
      positional = true;
    }
  }
  return problems;
}

/** Yield `{ line, args }` for each `thruput` command in a Markdown page. */
export function* docCommands(markdown) {
  const lines = markdown.split('\n');
  let fence = null;
  let pending = '';
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i];
    const marker = text.match(/^\s*(`{3,}|~{3,})\s*([\w-]*)/);
    if (marker && (!fence || marker[1].startsWith(fence.marker))) {
      fence = fence ? null : { marker: marker[1], shell: shellFences.has(marker[2].toLowerCase()) };
      continue;
    }
    if (fence) {
      if (!fence.shell) continue;
      pending += text.replace(/\\$/, ' ');
      if (text.endsWith('\\')) continue;
      for (const args of invocations(pending)) yield { line: i + 1, args };
      pending = '';
    } else {
      for (const [, , code] of text.matchAll(/(?<!`)(`+)(?!`)(.+?)(?<!`)\1(?!`)/g)) {
        for (const args of invocations(code)) yield { line: i + 1, args };
      }
    }
  }
}

export function* pages(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* pages(path);
    else if (/\.mdx?$/.test(entry.name)) yield path;
  }
}
