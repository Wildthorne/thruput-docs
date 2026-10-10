import { docsPath, logicalDocsPath, docsPrefix } from '../scripts/docs-routing.mjs';
interface NavigationGroup {
  label: string;
  items: string[];
  collapsed?: boolean;
}

interface NavigationLink {
  label: string;
  link: string;
}

interface DocumentationSection {
  id: string;
  label: string;
  href: string;
  items: (string | NavigationGroup | NavigationLink)[];
}

// Keep current content routes here until each page is migrated. A page has one
// sidebar owner; cross-section links belong in the page content.
export const sections: DocumentationSection[] = [
  {
    id: 'get-started', label: 'Get Started', href: '/get-started/',
    items: [
      'get-started',
      'get-started/cli', 'get-started/contract', 'get-started/typescript', 'get-started/react',
      'start/build-with-an-agent',
    ],
  },
  {
    id: 'architecture', label: 'Understand Stellar Thruput', href: '/architecture/',
    items: [
      'architecture',
      'how-it-works/architecture',
      'how-it-works/execution-model', 'how-it-works/transaction-lifecycle',
      'how-it-works/storage-economics',
      'how-it-works/consensus', 'how-it-works/networking',
      { label: 'Coming from...', collapsed: true, items: [
        'start/for-blockchain-developers',
        'ecosystem/evm', 'ecosystem/solana', 'ecosystem/stellar',
        'start/for-backend-developers', 'start/for-distributed-systems-developers',
      ] },
    ],
  },
  {
    id: 'cli', label: 'CLI', href: '/cli/',
    items: [
      'cli',
      'cli/install',
      'cli/configuration', 'cli/wallets',
      'cli/create-project', 'cli/build-and-test', 'cli/local-node', 'cli/deploy-and-call',
      'cli/transactions', 'cli/codegen', 'cli/agent-tools', 'cli/automation', 'cli/troubleshooting', 'cli/reference',
    ],
  },
  {
    id: 'contracts', label: 'Smart Contracts', href: '/contracts/',
    items: [
      'contracts',
      'contracts/project-structure', 'contracts/methods',
      'programming-model/execution', 'programming-model/storage-types', 'programming-model/nnint',
      'how-it-works/authorization', 'contracts/errors', 'contracts/events',
      'contracts/cross-contract-calls', 'how-it-works/invocation-frames',
      'programming-model/testing', 'contracts/debugging',
      'contracts/client-bindings', 'how-it-works/contracts',
      { label: 'Reference', collapsed: true, items: [
        'tools/rust-api-docs', 'reference/storage-types', 'reference/sdk-macros', 'reference/syscalls',
      ] },
    ],
  },
  {
    id: 'typescript', label: 'TypeScript', href: '/typescript/',
    items: [
      'typescript',
      'typescript/setup',
      'typescript/connect', 'typescript/transport', 'typescript/values',
      'tools/typescript-bindings', 'typescript/reads', 'typescript/events',
      'typescript/wallet-clients', 'tools/wallet-integration', 'typescript/accounts', 'typescript/transactions',
      'typescript/transaction-status', 'typescript/deployment',
      { label: 'Reference', collapsed: true, items: [
        'tools/typescript-sdk', 'tools/wallet-provider',
      ] },
    ],
  },
  {
    id: 'react', label: 'React', href: '/react/',
    items: [
      'react', 'react/setup', 'react/providers',
      'react/reads', 'react/balances', 'react/queries', 'react/events',
      'react/wallets', 'react/transactions', 'react/transaction-status', 'react/reference',
    ],
  },
  {
    id: 'guides', label: 'Guides', href: '/guides/',
    items: [
      'guides',
      'tutorials/build-a-counter', 'tutorials/work-with-thruput-from-typescript',
      'tutorials/build-a-counter-with-react', 'tutorials/connect-a-wallet-to-your-app',
      'tutorials/build-a-token', 'tutorials/build-an-amm',
    ],
  },
  {
    id: 'tools', label: 'Tools', href: '/tools/faucet/',
    items: ['tools/faucet', 'tools/block-explorer', 'tools/wallet-extension'],
  },
  {
    id: 'reference', label: 'Reference', href: '/reference/json-rpc-api/',
    items: [
      'reference/json-rpc-api', 'reference/contract-spec', 'reference/xdr-protocol',
      { label: 'TypeScript Client API', link: 'https://client-ts.thruput.network/' },
      { label: 'TypeScript Protocol API', link: 'https://protocol-ts.thruput.network/' },
    ],
  },
];

const routeItem = (item: string | NavigationGroup | NavigationLink): string | NavigationGroup | NavigationLink =>
  typeof item === 'string' ? `${docsPrefix.slice(1)}${docsPrefix ? '/' : ''}${item}` :
  'items' in item ? { ...item, items: item.items.map(value => routeItem(value) as string) } :
  { ...item, link: docsPath(item.link) };
export const sidebar = sections.map(({ label, items }) => ({ label, items: items.map(routeItem), collapsed: true }));

export function sectionForPath(pathname: string): DocumentationSection | undefined {
  const slug = logicalDocsPath(pathname).replace(/^\/+|\/+$/g, '');
  // Exact ownership takes precedence over the root while legacy routes remain.
  return sections.find(section => section.items.some(item =>
    typeof item === 'string' ? item === slug : 'items' in item && item.items.includes(slug)
  )) ?? sections.find(section => slug === section.id || slug.startsWith(`${section.id}/`));
}
