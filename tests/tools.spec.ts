import { expect, test } from '@playwright/test';

const origin = 'http://127.0.0.1:4322';

for (const width of [375, 1280]) {
  test(`Tools has three entries and wallet screenshots load at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(origin + '/tools/wallet-extension/');
    const tools = page.locator('.sidebar .top-level > li > details').filter({
      has: page.locator('summary .large', { hasText: /^Tools$/ }),
    });
    await expect(tools.locator('a')).toHaveText(['Faucet', 'Explorer', 'Wallet Extension']);
    await expect(tools.locator('a[aria-current="page"]')).toHaveAttribute('href', '/tools/wallet-extension/');
    await expect(page.locator('main h1')).toHaveText('Wallet Extension');
    const images = page.locator('.sl-markdown-content img');
    await expect(images).toHaveCount(3);
    for (const image of await images.all()) {
      await image.scrollIntoViewIfNeeded();
      await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true);
      await expect(image).toHaveAttribute('alt', /.+/);
      const box = await image.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath('wallet-extension.png'), fullPage: true });
  });
}

test('wallet download links match and Markdown exports retain screenshots', async ({ page, request }) => {
  await page.goto(origin + '/tools/wallet-extension/');
  const archive = await page.getByRole('link', { name: 'Download Thruput Wallet', exact: true }).getAttribute('href');
  const checksum = await page.getByRole('link', { name: 'SHA-256 checksum', exact: true }).getAttribute('href');
  expect(archive).toMatch(/\/wallet\/[a-f0-9]{64}\/thruput-wallet\.zip$/);
  expect(checksum).toBe(archive!.replace('thruput-wallet.zip', 'SHA256SUMS'));
  const markdown = await request.get(origin + '/markdown/pages/tools/wallet-extension.md');
  expect(markdown.ok()).toBe(true);
  const content = await markdown.text();
  for (const name of ['wallet-install', 'wallet-create', 'wallet-devnet']) {
    expect(content).toContain(`../../assets/images/wallet/${name}.png`);
    const image = await request.get(`${origin}/markdown/assets/images/wallet/${name}.png`);
    expect(image.ok()).toBe(true);
    expect(image.headers()['content-type']).toBe('image/png');
  }
});
