import { logicalDocsPath } from './docs-routing.mjs';
import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, resolve, relative, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { toMarkdown } from 'mdast-util-to-markdown';
import { gfmToMarkdown } from 'mdast-util-gfm';
import { visit } from 'unist-util-visit';
import { readPage } from './markdown-content.mjs';
import { validateMarkdown } from './markdown-validation.mjs';

const options = { extensions: [gfmToMarkdown()], bullet: '-', fences: true };
const heading = (depth, value) => toMarkdown({ type: 'heading', depth, children: [{ type: 'text', value }] }, options);
const listLink = (label, url) => toMarkdown({ type: 'link', url, children: [{ type: 'text', value: label }] }, options).trim();
const relativeLink = (from, to) => posix.relative(posix.dirname(from), to);
const markdownPath = url => `markdown/pages/${logicalDocsPath(new URL(url).pathname).replace(/^\/|\/$/g, '') || 'index'}.md`;
const normalizedRoute = url => {
  const result = new URL(url);
  result.search = '';
  result.hash = '';
  if (!posix.extname(result.pathname) && !result.pathname.endsWith('/')) result.pathname += '/';
  return result.href;
};

async function filesAt(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesAt(path));
    else if (entry.isFile()) files.push(path);
    else throw new Error(`Unexpected non-regular build output: ${path}`);
  }
  return files.sort();
}

/** Hosted builds may contain source files without a Git checkout. */
export function buildProvenance(root, agentGuideCliVersion, env = process.env) {
  if (env.THRUPUT_DOCS_SNAPSHOT) return JSON.parse(env.THRUPUT_DOCS_SNAPSHOT);
  const git = (...args) => {
    try {
      return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    } catch {
      return null;
    }
  };
  const railwayRevision = env.RAILWAY_GIT_COMMIT_SHA?.trim();
  const sourceRevision = git('rev-parse', 'HEAD') ??
    (/^[0-9a-f]{40}$/i.test(railwayRevision ?? '') ? railwayRevision.toLowerCase() : null);
  const status = git('status', '--porcelain', '--untracked-files=normal');
  return { schemaVersion: 1, sourceRevision, sourceDirty: status === null ? null : status !== '', agentGuideCliVersion };
}

function provenance(snapshot) {
  const source = snapshot.sourceRevision
    ? `Documentation source: \`${snapshot.sourceRevision}\`${snapshot.sourceDirty === true ? ' (uncommitted preview)' : snapshot.sourceDirty === false ? '' : ' (working-tree status unavailable)'}.`
    : 'Documentation source revision unavailable for this build.';
  // The agent guide version stays in snapshot.json; printing it here read as the
  // docs' own CLI version, and the CLI strips that guide from its bundled copy.
  return `${source} Hosted docs may be newer than this snapshot.\n\n`;
}

/** Generate portable Markdown from the same rendered pages shipped as HTML. */
export async function exportMarkdown({ directory, site, snapshot, sections = [], sectionForPath = () => undefined }) {
  const files = await filesAt(directory);
  const existing = new Set(files.map(file => relative(directory, file).split('\\').join('/')));
  const pages = new Map();
  const redirects = new Map();
  for (const file of files.filter(file => file.endsWith('/index.html'))) {
    const route = relative(directory, file).split('\\').join('/').replace(/index\.html$/, '');
    const url = new URL(route, site).href;
    const page = readPage(await readFile(file, 'utf8'), url);
    if (!page) continue;
    if (page.redirect) redirects.set(url, page);
    else {
      page.path = markdownPath(url);
      page.htmlPath = file;
      page.section = sectionForPath(new URL(url).pathname) ?? { id: 'overview', label: 'Overview' };
      pages.set(url, page);
    }
  }
  if (!pages.size) throw new Error('No documentation pages available for Markdown export');
  const outputs = new Set();
  const assets = new Map();
  const write = async (path, content) => {
    if (outputs.has(path)) throw new Error(`Duplicate Markdown output: ${path}`);
    outputs.add(path);
    await mkdir(dirname(resolve(directory, path)), { recursive: true });
    await writeFile(resolve(directory, path), content);
  };
  function link(value, page, from) {
    const original = new URL(value, page.url);
    if (original.origin !== new URL(site).origin) return value;
    let url = original;
    const seen = new Set();
    while (redirects.has(normalizedRoute(url))) {
      const key = normalizedRoute(url);
      if (seen.has(key)) throw new Error(`Redirect cycle at ${key}`);
      seen.add(key);
      const redirect = redirects.get(key);
      const mapped = Object.hasOwn(redirect.fragmentRoutes, url.hash.slice(1));
      const next = new URL(mapped ? redirect.fragmentRoutes[url.hash.slice(1)] : redirect.redirect, site);
      if (!mapped && !next.hash) next.hash = url.hash;
      url = next;
    }
    const target = pages.get(normalizedRoute(url));
    if (target) {
      if (url.hash && !target.anchors.has(decodeURIComponent(url.hash.slice(1)))) {
        throw new Error(`Broken documentation fragment: ${value} in ${page.url}`);
      }
      return relativeLink(from, target.path) + url.hash;
    }
    const source = decodeURIComponent(url.pathname).replace(/^\//, '');
    if (existing.has(source) && !source.endsWith('.html')) {
      const target = `markdown/assets/${source}`;
      assets.set(source, target);
      return relativeLink(from, target) + url.hash;
    }
    throw new Error(`Broken local documentation link: ${value} in ${page.url}`);
  }
  function render(page, from, bundle = false) {
    const tree = structuredClone(page.tree);
    visit(tree, node => {
      if (node.type === 'link' || node.type === 'image' || node.type === 'definition') node.url = link(node.url, page, from);
      // Bundle links point to individual pages. Their original IDs must not
      // create duplicate anchors within the assembled document.
      if (bundle && node.type === 'html') node.value = '';
    });
    return `${bundle ? '' : '<a id="_top"></a>\n\n'}${heading(bundle ? 2 : 1, page.title)}\n` +
      `Source: <${page.url}>\n\n${bundle ? '' : provenance(snapshot)}${page.description}\n\n` +
      toMarkdown(tree, options);
  }
  const grouped = [...sections, { id: 'overview', label: 'Overview' }].map(section => {
    const entries = (section.items ?? []).flatMap(item =>
      typeof item === 'string' ? [item] : item.items ?? []);
    const order = new Map(entries.map((slug, index) => [normalizedRoute(new URL(slug, site)), index]));
    return { ...section, pages: [...pages.values()]
      .filter(page => page.section.id === section.id)
      .sort((a, b) => (order.get(normalizedRoute(new URL(logicalDocsPath(new URL(a.url).pathname), site))) ?? entries.length) - (order.get(normalizedRoute(new URL(logicalDocsPath(new URL(b.url).pathname), site))) ?? entries.length)) };
  }).filter(section => section.pages.length);
  const orderedPages = grouped.flatMap(section => section.pages);
  const index = from => `# Project Thruput documentation\n\n${provenance(snapshot)}` +
    `Read a focused section or an individual page before loading the full documentation.\n\n` +
    `- [Complete documentation](${relativeLink(from, 'markdown/full.md')})\n\n` +
    grouped.map(section => `## ${section.label}\n\n` +
      `[Section bundle](${relativeLink(from, `markdown/sections/${section.id}.md`)})\n\n` +
      section.pages.map(page => `- ${listLink(page.title, relativeLink(from, page.path))}: ${page.description}\n`).join('')).join('\n');
  for (const page of pages.values()) {
    await write(page.path, render(page, page.path));
    const html = await readFile(page.htmlPath, 'utf8');
    await writeFile(page.htmlPath, html.replace('</head>',
      `<link rel="alternate" type="text/markdown" href="/${page.path}"><link rel="help" type="text/plain" href="/llms.txt"></head>`));
  }
  await write('markdown/index.md', index('markdown/index.md'));
  await write('llms.txt', index('llms.txt'));
  for (const section of grouped) {
    const path = `markdown/sections/${section.id}.md`;
    await write(path, `# ${section.label}\n\n${provenance(snapshot)}` +
      section.pages.map(page => render(page, path, true)).join('\n---\n\n'));
  }
  for (const path of ['markdown/full.md', 'llms-full.txt']) {
    await write(path, `# Project Thruput documentation\n\n${provenance(snapshot)}` +
      orderedPages.map(page => render(page, path, true)).join('\n---\n\n'));
  }
  for (const [source, target] of assets) {
    await mkdir(dirname(resolve(directory, target)), { recursive: true });
    await copyFile(resolve(directory, source), resolve(directory, target));
    if (target.endsWith('.md')) outputs.add(target);
  }
  await write('markdown/manifest.json', JSON.stringify({ schemaVersion: 1, snapshot,
    pages: [...pages.values()].map(({ url, path, title, section }) => ({ url, path: path.slice('markdown/'.length), title, section: section.id })),
  }, null, 2) + '\n');
  await validateMarkdown(directory, [...outputs].filter(path => /\.(md|txt)$/.test(path)));
  return pages.size;
}

/** Astro build integration; no browser or network service is needed to read exports. */
export default function markdownExport({ sections, sectionForPath }) {
  let config;
  return {
    name: 'thruput-markdown',
    hooks: {
      'astro:config:done': ({ config: resolved }) => { config = resolved; },
      'astro:build:done': async ({ dir, logger }) => {
        const root = fileURLToPath(config.root);
        const guide = JSON.parse(await readFile(resolve(root, 'public/agents/historical.json'), 'utf8'));
        const snapshot = buildProvenance(root, guide.version);
        const count = await exportMarkdown({ directory: fileURLToPath(dir), site: config.site,
          snapshot, sections, sectionForPath });
        logger.info(`Exported ${count} Markdown pages, section bundles, and llms indexes.`);
      },
    },
  };
}
