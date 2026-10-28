// Run with: node scripts/generate-social-image.mjs
// Requires the Playwright Chromium browser: pnpm exec playwright install chromium
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import sharp from 'sharp';

const root = new URL('../', import.meta.url);
const font = await readFile(new URL('node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2', root));
const logo = await readFile(new URL('public/brand/stellar-dark.svg', root));

// A quiet, static version of the ribbon in src/components/home/DotField.astro.
const dots = [];
for (let y = 24; y < 606; y += 24) {
  for (let x = 24; x < 1176; x += 24) {
    const nx = x / 1200;
    const ny = y / 630;
    const ribbon = Math.exp(-(((ny - 0.48 - Math.sin(nx * 6) * 0.37) / 0.31) ** 2));
    const edge = Math.min(1, nx * 10, (1 - nx) * 10, ny * 12, (1 - ny) * 8);
    const centerFade = 1 - 0.72 * Math.exp(-(((nx - 0.5) / 0.27) ** 2) - ((ny - 0.43) / 0.3) ** 2);
    const opacity = (0.24 + ribbon * 0.48) * edge * centerFade * 0.38;
    dots.push(`<circle cx="${x}" cy="${y}" r="${1 + ribbon * 1.5}" opacity="${opacity}" />`);
  }
}

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 });
  await page.setContent(`<!doctype html>
    <html lang="en"><head><meta charset="utf-8"><style>
      @font-face { font-family: Inter; src: url(data:font/woff2;base64,${font.toString('base64')}); font-weight: 100 900; font-display: swap; }
      * { box-sizing: border-box; }
      body { margin: 0; width: 1200px; height: 630px; background: #000; color: #fff; font-family: Inter, sans-serif; }
      .field { position: absolute; inset: 0; }
      main { position: absolute; left: 80px; top: 208px; }
      h1 { margin: 0; font-size: 76px; font-weight: 500; letter-spacing: -.035em; }
      .brand { display: flex; align-items: center; gap: 24px; margin-top: 52px; font-size: 28px; font-weight: 500; }
      .brand img { width: 140px; height: 35px; }
      .divider { width: 1px; height: 30px; background: #555; }
    </style></head><body>
      <svg class="field" xmlns="http://www.w3.org/2000/svg" width="1200" height="630" fill="#fdda24">${dots.join('')}</svg>
      <main>
        <h1>Blockchain technology<br>built for abundance</h1>
        <div class="brand"><img src="data:image/svg+xml;base64,${logo.toString('base64')}" alt="Stellar"><span class="divider"></span><span>Project Thruput</span></div>
      </main>
    </body></html>`);
  await page.evaluate(() => document.fonts.ready);
  const image = await page.screenshot();
  await sharp(image).png({ compressionLevel: 9 }).toFile(fileURLToPath(new URL('public/images/thruput-social.png', root)));
} finally {
  await browser.close();
}
