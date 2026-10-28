import { defineConfig } from "astro/config";
import { unified } from "@astrojs/markdown-remark";
import canonicalSitemap from "./scripts/canonical-sitemap.mjs";
import starlight from "@astrojs/starlight";
import { sidebar, sections, sectionForPath } from "./src/navigation.ts";
import { remarkDocsRoutes } from "./scripts/docs-routing.mjs";
import markdownExport from "./scripts/markdown-export.mjs";

export default defineConfig({
  site: "https://www.thruput.network",
  markdown: { processor: unified({ remarkPlugins: [remarkDocsRoutes] }) },

  integrations: [
    canonicalSitemap(),
    starlight({
      title: "Stellar Project Thruput",
      titleDelimiter: "|",
      head: [
        { tag: "meta", attrs: { property: "og:image", content: "https://www.thruput.network/images/thruput-social.png" } },
        { tag: "meta", attrs: { property: "og:image:type", content: "image/png" } },
        { tag: "meta", attrs: { property: "og:image:width", content: "2400" } },
        { tag: "meta", attrs: { property: "og:image:height", content: "1260" } },
        { tag: "meta", attrs: { property: "og:image:alt", content: "Blockchain technology built for abundance. Stellar | Project Thruput." } },
        { tag: "meta", attrs: { name: "twitter:image", content: "https://www.thruput.network/images/thruput-social.png" } },
        { tag: "meta", attrs: { name: "twitter:image:alt", content: "Blockchain technology built for abundance. Stellar | Project Thruput." } },
      ],
      routeMiddleware: "./src/route-middleware.ts",
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
          href: "https://github.com/thruputchain",
        },
      ],
      sidebar,
    }),
    markdownExport({ sections, sectionForPath }),
  ],
});
