import { visit } from 'unist-util-visit';

export const docsPrefix = process.env.THRUPUT_DOCS_SNAPSHOT ? '' : '/docs';
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

// Keep authored links and offline snapshot routes independent of hosted routing.
export function remarkDocsRoutes() {
  return tree => visit(tree, node => {
    if (node.type === 'link' || node.type === 'image' || node.type === 'definition') {
      node.url = docsPath(node.url);
    }
  });
}
