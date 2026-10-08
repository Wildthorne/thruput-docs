import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

const origin = 'http://127.0.0.1:4322';
const prompt = readFileSync(new URL('../src/content/docs/start/build-with-an-agent.md', import.meta.url), 'utf8').match(/```text\r?\n([\s\S]*?)\r?\n```/)![1];

for (const width of [320, 1280]) {
  test(`prompt preview is complete, keyboard accessible, and copyable at ${width}px`, async ({ page, context }, info) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.setViewportSize({ width, height: 900 });
    await page.goto(origin);
    const trigger = page.getByRole('button', { name: 'Preview setup prompt' });
    await trigger.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Deploy your first counter' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('textbox', { name: 'Full agent prompt' })).toHaveValue(prompt);
    const box = await dialog.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    expect(box!.height).toBeLessThanOrEqual(900);
    expect(box!.x + box!.width / 2).toBeCloseTo(width / 2, 0);
    expect(box!.y + box!.height / 2).toBeCloseTo(450, 0);
    for (let index = 0; index < 8; index++) {
      await page.keyboard.press('Tab');
      expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
    }
    await dialog.getByRole('button', { name: 'Copy prompt', exact: true }).click();
    await expect(dialog.getByRole('button', { name: 'Copied', exact: true })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(prompt);
    await expect(dialog.getByRole('link', { name: /Follow the guided quickstart/ })).toHaveAttribute('href', '/get-started/contract/');
    await page.screenshot({ path: info.outputPath('prompt-preview.png') });
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
    await trigger.click();
    await dialog.getByRole('button', { name: 'Close prompt preview' }).click();
    await expect(trigger).toBeFocused();
  });
}

test('homepage preserves technical content and prompt in Markdown without UI controls', async ({ request }) => {
  const response = await request.get(origin + '/markdown/pages/index.md');
  expect(response.ok()).toBe(true);
  const markdown = await response.text();
  for (const text of ['Stellar Thruput is a moonshot project', 'No decisions have been made about mainnet', 'compatible increments', '100', '+5', '+3', '+2', '110', 'No conventional gas fees', 'no monetary value', 'native tokens', 'strict_inc(amount as i128)', prompt]) expect(markdown).toContain(text);
  expect(markdown).not.toContain('Close prompt preview');
  expect(markdown).not.toContain('Preview setup prompt');
});

test('hero paths, workflow, and footer links reach confirmed destinations', async ({ page, request }) => {
  await page.goto(origin);
  await expect(page.locator('.hero-links').getByRole('link')).toHaveCount(2);
  await expect(page.getByRole('navigation', { name: 'Footer' }).getByRole('heading')).toHaveText(['Build', 'Learn', 'Connect', 'Project']);
  const links = await page.locator('main a[href^="/"]').evaluateAll(elements => [...new Set(elements.map(element => element.getAttribute('href')!))]);
  for (const link of links) expect((await request.get(origin + link)).ok(), link).toBe(true);
});

test('reduced motion keeps the hero cursor static', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(origin);
  await expect(page.locator('.hero-cursor')).toHaveCSS('animation-name', 'none');
});
