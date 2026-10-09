import { expect, test } from '@playwright/test';
const origin = 'http://127.0.0.1:4322';

test('landing and docs have distinct canonical URLs and retain root downloads', async ({ page, request }) => {
  await page.goto(origin);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://thruput.network/');
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Documentation', exact: true }).click();
  await expect(page).toHaveURL(origin + '/docs/get-started/');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://thruput.network/docs/get-started/');
  const links = await page.locator('main a[href^="/"]').evaluateAll(links => links.map(link => link.getAttribute('href')));
  expect(links.every(link => link!.startsWith('/docs/') || link!.startsWith('/markdown/'))).toBe(true);
  await page.getByRole('link', { name: 'Stellar Thruput homepage' }).click();
  await expect(page).toHaveURL(origin + '/');
  for (const path of ['/markdown/pages/cli/install.md', '/llms.txt', '/agents/current.json', '/agent-guide.md']) {
    expect((await request.get(origin + path)).status()).toBe(200);
  }
});

test('old root links preserve query strings and fragments', async ({ page }) => {
  for (const [oldPath, destination] of [
    ['/cli/install/?via=old#configure-cargo-access', '/docs/cli/install/?via=old#configure-cargo-access'],
    ['/start/?via=old#_top', '/docs/architecture/?via=old#_top'],
    ['/programming-model/advanced/?via=old#negative-set-values', '/docs/programming-model/nnint/?via=old#negative-set-values'],
  ]) {
    await page.goto(origin + oldPath);
    await expect(page).toHaveURL(origin + destination);
    await expect(page.locator(`[id="${new URL(origin + destination).hash.slice(1)}"]`)).toBeVisible();
  }
});

test('sitemap lists canonical pages and excludes URL aliases and redirect pages', async ({ request }) => {
  const xml = await (await request.get(origin + '/sitemap-0.xml')).text();
  expect(xml).toContain('<loc>https://thruput.network/</loc>');
  expect(xml).toContain('<loc>https://thruput.network/docs/cli/install/</loc>');
  for (const path of ['/cli/install/', '/docs/', '/start/', '/docs/start/', '/docs/tools/groundhog-cli/']) {
    expect(xml).not.toContain(`<loc>https://thruput.network${path}</loc>`);
  }
});
