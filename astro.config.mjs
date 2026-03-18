import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  integrations: [
    starlight({
      title: 'Groundhog',
      customCss: ['./src/styles/custom.css'],
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/groundhogchain' },
      ],
      sidebar: [
        {
          label: 'Concepts',
          items: [
            'start',
            'start/for-blockchain-developers',
            'start/for-backend-developers',
            'start/for-distributed-systems-developers',
          ],
        },
        {
          label: 'Programming Model',
          items: [
            'programming-model/execution',
            'programming-model/storage-types',
            'programming-model/nnint',
            'programming-model/advanced',
          ],
        },
        {
          label: 'Tutorials',
          items: [
            'start/getting-started',
            'tutorials/build-a-counter',
            'tutorials/build-a-token',
            'tutorials/build-a-swap',
          ],
        },
        {
          label: 'Tools',
          items: [
            'tools/typescript-sdk',
            'tools/block-explorer',
            'tools/wallet-integration',
            'tools/faucet',
          ],
        },
        {
          label: 'How It Works',
          items: [
            'how-it-works/architecture',
            'how-it-works/execution-model',
            'how-it-works/transaction-lifecycle',
            'how-it-works/contracts',
            'how-it-works/invocation-frames',
            'how-it-works/storage-economics',
            'how-it-works/consensus',
            'how-it-works/authorization',
            'how-it-works/networking',
          ],
        },
        {
          label: 'Reference',
          items: [
            'reference/storage-types',
            'reference/syscalls',
            'reference/sdk-macros',
            'reference/error-handling',
            'reference/cross-contract-calls',
            'reference/xdr-protocol',
            'reference/json-rpc-api',
          ],
        },
        {
          label: 'Migration Guides',
          items: [
            'migration/stellar-migration',
            'migration/evm-migration',
            'migration/solana-migration',
          ],
        },
        {
          label: 'Community',
          items: [
            'community/contributing',
            'community/security',
            'community/roadmap',
          ],
        },
      ],
    }),
  ],
});
