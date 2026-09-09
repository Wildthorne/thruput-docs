import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// Validate checked-in release bytes before Astro copies them to the site.
const root = fileURLToPath(new URL('../public/', import.meta.url));
const manifest = JSON.parse(readFileSync(resolve(root, 'agents/current.json'), 'utf8'));
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(manifest.version)) {
  throw new Error('Invalid agent guide version');
}
if (!['preview', 'release'].includes(manifest.status)) throw new Error('Invalid guide status');
const versioned = readFileSync(resolve(root, `agents/${manifest.version}/agent-guide.md`));
const current = readFileSync(resolve(root, 'agent-guide.md'));
if (!current.equals(versioned)) throw new Error('Current agent guide differs from versioned guide');
if (createHash('sha256').update(current).digest('hex') !== manifest.sha256) {
  throw new Error('Agent guide checksum differs from selected source artifact');
}
const text = current.toString('utf8');
if (!text.includes(`<!-- groundhog-cli-version: ${manifest.version} -->`) || text.includes('{{GROUNDHOG_CLI_VERSION}}')) {
  throw new Error('Agent guide does not identify the selected CLI version');
}
console.log(`Agent guide verified: ${manifest.version} (${manifest.status})`);
