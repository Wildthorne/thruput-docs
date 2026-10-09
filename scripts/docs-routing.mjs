import { visit } from 'unist-util-visit';

export const docsPrefix = process.env.GROUNDHOG_DOCS_SNAPSHOT ? '' : '/docs';
const docsRoots = new Set(['architecture', 'get-started', 'start', 'cli', 'contracts', 'typescript', 'react', 'guides', 'tools', 'reference', 'tutorials', 'programming-model', 'how-it-works', 'ecosystem']);

export function docsPath(path) {
  return path.startsWith('/') && docsRoots.has(path.split('/')[1]) ? `${docsPrefix}${path}` : path;
}

export function logicalDocsPath(path) {
  return path.replace(/^\/docs(?=\/|$)/, '') || '/';
}

export function docsId({ entry, data }) {
  const slug = data.slug ?? entry.replace(/\.(md|mdx)$/, '').replace(/\/index$/, '');
  if (slug === '404') return slug;
  return `${docsPrefix.slice(1)}${docsPrefix ? '/' : ''}${slug}`;
}

export function docsText(text) {
  if (!docsPrefix) return text;
  return text.replaceAll('https://docs.groundhog.dev/', `https://thruput.network${docsPrefix}/`);
}

// Keep authored links and offline snapshot routes independent of hosted routing.
export function remarkDocsRoutes() {
  return tree => visit(tree, node => {
    if (node.type === 'link' || node.type === 'image' || node.type === 'definition') {
      node.url = docsText(docsPath(node.url));
    }
    if (node.type === 'text' || node.type === 'code') node.value = docsText(node.value);
  });
}
