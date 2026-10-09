import sitemap from '@astrojs/sitemap';
import { readFile } from 'node:fs/promises';
import { fromHtml } from 'hast-util-from-html';
import { select } from 'hast-util-select';

// Use the rendered robots directive, so aliases and retired routes stay out of
// the sitemap without maintaining a second list of documentation routes.
export default function canonicalSitemap() {
  let directory;
  const integration = sitemap({
    async serialize(item) {
      const path = new URL(item.url).pathname.replace(/^\//, '');
      const html = await readFile(new URL(`${path}index.html`, directory), 'utf8');
      const robots = select('meta[name="robots"]', fromHtml(html));
      return String(robots?.properties.content ?? '').split(/[,\s]+/).includes('noindex') ? undefined : item;
    },
  });
  const build = integration.hooks['astro:build:done'];
  integration.hooks['astro:build:done'] = async context => {
    directory = context.dir;
    await build(context);
  };
  return integration;
}
