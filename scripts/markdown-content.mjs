// Convert authored page content after Astro has rendered components. Navigation,
// copy controls, and syntax-highlighting markup are not part of the document.
import { fromHtml } from 'hast-util-from-html';
import { select, selectAll } from 'hast-util-select';
import { toText } from 'hast-util-to-text';
import { toMdast } from 'hast-util-to-mdast';

const text = value => ({ type: 'text', value });
const element = (tagName, children, properties = {}) => ({ type: 'element', tagName, properties, children });
const classes = node => node.properties?.className ?? [];
const ids = value => Array.isArray(value) ? value : String(value ?? '').split(/\s+/).filter(Boolean);
const rawText = node => node.type === 'text' ? node.value : (node.children ?? []).map(rawText).join('');
const escapeAttribute = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');

function clean(node, labels) {
  if (node.type === 'text') return [node];
  if (node.type !== 'element') return [];
  const { tagName, properties: props } = node;
  if (['script', 'style', 'link', 'button', 'nav', 'noscript'].includes(tagName)
      || classes(node).some(name => ['sl-anchor-link', 'copy', 'sr-only', 'starlight-aside__title'].includes(name))
      || props.ariaHidden === 'true' || props.ariaHidden === true
      || props.role === 'tablist') return [];

  let content;
  if (tagName === 'pre') {
    const lines = selectAll('.ec-line .code', node);
    // Expressive Code uses a div for each line. Joining rendered text would lose
    // line breaks, while copy-button attributes use a private delimiter.
    const value = lines.length
      ? lines.map(line => rawText(line).replace(/\n$/, '')).join('\n')
      : rawText(select('code', node) ?? node).replace(/\n$/, '');
    const code = select('code', node);
    const language = props.dataLanguage ?? classes(code ?? {}).find(name => name.startsWith('language-'))?.slice(9);
    content = element('pre', [element('code', [text(value)])], { dataLanguage: language });
  } else if (tagName === 'home-agent-prompt') {
    const prompt = select('textarea', node);
    content = element('div', [element('h2', [text('Use a coding agent')]),
      element('pre', [element('code', [text(prompt ? rawText(prompt) : '')])], { dataLanguage: 'text' })]);
  } else if (tagName === 'svg') {
    const description = [props.ariaLabel, ...selectAll('title, desc, text', node).map(toText)].filter(Boolean).join(' ');
    if (!description) throw new Error('A content diagram needs an accessible title, description, or text labels');
    content = element('p', [text(`Diagram: ${description}`)]);
  } else {
    const children = node.children.flatMap(child => clean(child, labels));
    content = element(tagName, children, { ...props });
    if (props.role === 'tabpanel') {
      const label = props.ariaLabel ?? (ids(props.ariaLabelledBy).map(id => labels.get(id)).filter(Boolean).join(' ') || labels.get(props.id));
      if (!label) throw new Error('A tab panel needs a label in the Markdown export');
      content = element('div', [element('h3', [text(label)]), ...children]);
    } else if (tagName === 'aside' && classes(node).includes('starlight-aside')) {
      content.tagName = 'blockquote';
      const kind = classes(node).find(name => name.startsWith('starlight-aside--'))?.slice(17) ?? 'note';
      const title = props.ariaLabel ?? kind;
      const label = title.toLowerCase() === kind ? title : `${kind}: ${title}`;
      content.children.unshift(element('p', [element('strong', [text(label)])]));
    } else if (tagName === 'summary') {
      content = element('p', [element('strong', children)]);
    } else if (tagName === 'figcaption') {
      const title = select('.title', node);
      content = element('p', title && toText(title).trim() ? [element('strong', [text(toText(title))])] : children);
    } else if (tagName === 'textarea') {
      content = element('pre', [element('code', [text(rawText(node))])], { dataLanguage: 'text' });
    } else if (tagName === 'h1') {
      content.tagName = 'h2';
    } else if (tagName === 'a' && select('h2, h3, h4', content)) {
      // A card's heading carries its link; descriptions remain ordinary prose.
      const heading = select('h2, h3, h4', content);
      heading.children = [element('a', heading.children, { href: props.href })];
      content.tagName = 'div';
    }
  }
  // Explicit anchors retain Starlight's exact IDs and historical fragment aliases.
  const anchor = props.id && props.id !== '_top' ? [element('export-anchor', [], { id: props.id })] : [];
  delete content.properties.id;
  delete content.properties.hidden;
  return [...anchor, content];
}

/** Extract a page or redirect from rendered HTML; never fetch external content. */
export function readPage(html, url) {
  const document = fromHtml(html);
  const redirect = select('a[data-redirect]', document);
  const refresh = select('meta[http-equiv="refresh"]', document);
  if (redirect || refresh) {
    const destination = redirect?.properties.href ?? String(refresh.properties.content).match(/url=(.*)$/i)?.[1];
    if (!destination) throw new Error(`Invalid redirect at ${url}`);
    return { url, redirect: new URL(destination, url).href,
      fragmentRoutes: JSON.parse(redirect?.properties.dataFragmentRoutes ?? '{}') };
  }
  if (select('meta[name="robots"]', document)?.properties.content?.includes('noindex')) return undefined;
  const main = select('main', document);
  if (!main) throw new Error(`No main content at ${url}`);
  const title = String(select('meta[property="og:title"]', document)?.properties.content ??
    toText(select('h1', main) ?? select('title', document))).replace(/\s+/g, ' ').trim();
  const description = String(select('meta[name="description"]', document)?.properties.content ?? '');
  const labels = new Map();
  for (const tab of selectAll('[role="tab"]', main)) {
    labels.set(tab.properties.id, toText(tab));
    for (const id of ids(tab.properties.ariaControls)) labels.set(id, toText(tab));
  }
  const body = select('.sl-markdown-content', main) ?? main;
  const children = body.children.flatMap(node => clean(node, labels));
  const anchors = new Set(selectAll('[id]', body).map(node => node.properties.id));
  anchors.add('_top');
  const tree = toMdast({ type: 'root', children }, {
    handlers: {
      pre: (_state, node) => ({ type: 'code', lang: node.properties.dataLanguage || null, value: rawText(node) }),
      'export-anchor': (_state, node) => ({ type: 'html', value: `<a id="${escapeAttribute(node.properties.id)}"></a>` }),
    },
  });
  return { url, title, description, tree, anchors };
}
