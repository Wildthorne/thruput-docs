import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

export default defineConfig({
  site: "https://docs.groundhog.dev",

  // "Build a Swap" was replaced by "Design a Swap". Keep the old URL working
  // for anything already linking to it.
  redirects: {
    "/tutorials/build-a-swap": "/tutorials/design-a-swap",
  },
  integrations: [
    starlight({
      title: "Groundhog",
      customCss: ["./src/styles/custom.css"],
      components: {
        Banner: "./src/components/DocsSnapshotBanner.astro",
        Header: "./src/components/Header.astro",
        Sidebar: "./src/components/Sidebar.astro",
        MobileMenuToggle: "./src/components/MobileMenuToggle.astro",
        PageTitle: "./src/components/PageTitle.astro",
        Footer: "./src/components/Footer.astro",
        ThemeProvider: "./src/components/ThemeProvider.astro",
        ThemeSelect: "./src/components/ThemeSelect.astro",
      },
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/groundhogchain",
        },
      ],
      sidebar: [
        {
          label: "Concepts",
          items: [
            "start",
            "start/for-blockchain-developers",
            "start/for-backend-developers",
            "start/for-distributed-systems-developers",
          ],
        },
        {
          label: "Tools",
          items: [
            "start/build-with-an-agent",
            "tools/groundhog-cli",
            "tools/rust-api-docs",
            "tools/typescript-sdk",
            "tools/typescript-bindings",
            "tools/block-explorer",
            "tools/wallet-integration",
            "tools/wallet-provider",
            "tools/faucet",
          ],
        },
        {
          label: "Tutorials",
          items: [
            "start/getting-started",
            "tutorials/develop-locally",
            "tutorials/develop-on-devnet",
            "tutorials/work-with-groundhog-from-typescript",
            "tutorials/connect-a-wallet-to-your-app",
            "tutorials/build-a-counter",
            "tutorials/build-a-token",
            "tutorials/add-events-to-a-contract",
            "tutorials/design-a-swap",
          ],
        },
        {
          label: "Programming Model",
          items: [
            "programming-model/execution",
            "programming-model/storage-types",
            "programming-model/nnint",
            "programming-model/testing",
            "programming-model/advanced",
          ],
        },
        {
          label: "How It Works",
          items: [
            "how-it-works/architecture",
            "how-it-works/execution-model",
            "how-it-works/transaction-lifecycle",
            "how-it-works/contracts",
            "how-it-works/invocation-frames",
            "how-it-works/storage-economics",
            "how-it-works/consensus",
            "how-it-works/authorization",
            "how-it-works/networking",
          ],
        },
        {
          label: "Reference",
          items: [
            "reference/storage-types",
            "reference/syscalls",
            "reference/sdk-macros",
            "reference/contract-spec",
            "reference/error-handling",
            "reference/cross-contract-calls",
            "reference/xdr-protocol",
            "reference/json-rpc-api",
          ],
        },
        {
          label: "Ecosystem Guides",
          items: ["ecosystem/evm", "ecosystem/solana", "ecosystem/stellar"],
        },
        {
          label: "Community",
          items: [
            "community/contributing",
            "community/security",
            "community/roadmap",
          ],
        },
      ],
    }),
  ],
});
