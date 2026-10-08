import { readFile, stat } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfm } from 'micromark-extension-gfm';
import { gfmFromMarkdown } from 'mdast-util-gfm';
import { fromHtml } from 'hast-util-from-html';
import { selectAll } from 'hast-util-select';
import GithubSlugger from 'github-slugger';
import { visit } from 'unist-util-visit';

export const parseMarkdown = source => fromMarkdown(source, { extensions: [gfm()], mdastExtensions: [gfmFromMarkdown()] });
const nodeText = node => node.value ?? (node.children ?? []).map(nodeText).join('');

/** Reparse the emitted files and check file/fragment links without network access. */
export async function validateMarkdown(directory, paths) {
  const documents = new Map();
  for (const path of paths) {
    const tree = parseMarkdown(await readFile(resolve(directory, path), 'utf8'));
    const anchors = new Set();
    const slugger = new GithubSlugger();
    visit(tree, node => {
      if (node.type === 'heading') anchors.add(slugger.slug(nodeText(node)));
      if (node.type === 'html') {
        for (const anchor of selectAll('[id]', fromHtml(node.value, { fragment: true }))) anchors.add(anchor.properties.id);
      }
    });
    documents.set(resolve(directory, path), { tree, anchors });
  }
  for (const [path, { tree }] of documents) {
    const links = [];
    visit(tree, node => {
      if (['link', 'image', 'definition'].includes(node.type)) links.push(node.url);
    });
    for (const link of links) {
      if (/^[a-z][a-z\d+.-]*:/i.test(link) || link.startsWith('//')) continue;
      if (link.startsWith('/')) throw new Error(`Nonportable Markdown link ${link} in ${path}`);
      const url = new URL(link, pathToFileURL(path));
      const target = fileURLToPath(url);
      const within = relative(directory, target);
      if (within.startsWith('..') || !(await stat(target)).isFile()) throw new Error(`Missing exported file ${link} in ${path}`);
      if (url.hash && documents.has(target) && !documents.get(target).anchors.has(decodeURIComponent(url.hash.slice(1)))) {
        throw new Error(`Missing exported anchor ${link} in ${path}`);
      }
    }
  }
}
