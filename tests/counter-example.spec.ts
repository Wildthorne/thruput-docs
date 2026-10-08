import { expect, test } from '@playwright/test';

const origin = 'http://127.0.0.1:4322';

test('the prompt types, then advances to Rust and TypeScript without moving the layout or focus', async ({ page }) => {
  await page.clock.install();
  await page.goto(origin);
  const example = page.locator('counter-example');
  const fullPrompt = await example.locator('[data-agent-text]').textContent();
  await example.scrollIntoViewIfNeeded();
  await expect(example).toHaveAttribute('data-running', '');
  await page.clock.runFor(600);
  const partial = await example.locator('[data-agent-text]').textContent();
  expect(partial!.length).toBeGreaterThan(0);
  expect(partial!.length).toBeLessThan(fullPrompt!.length);
  const box = await example.boundingBox();
  await page.clock.runFor(5_600);
  await expect(example.getByRole('tab', { name: 'Rust', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(example.getByRole('tabpanel', { name: 'Rust', exact: true })).toBeVisible();
  expect((await example.boundingBox())!.height).toBeCloseTo(box!.height, 0);
  await page.clock.runFor(4_500);
  await expect(example.getByRole('tabpanel', { name: 'TypeScript' })).toBeVisible();
  expect((await example.boundingBox())!.height).toBeCloseTo(box!.height, 0);
  expect(await example.evaluate(element => element.contains(document.activeElement))).toBe(false);
  await page.locator('#hero').scrollIntoViewIfNeeded();
  await expect(example).not.toHaveAttribute('data-running');
});

test('manual tabs stop autoplay and Agent replays typing on every selection', async ({ page }) => {
  await page.clock.install();
  await page.goto(origin);
  const example = page.locator('counter-example');
  await example.getByRole('tab', { name: 'Rust', exact: true }).click();
  await expect(example).not.toHaveAttribute('data-running');
  await expect(example.getByRole('button', { name: 'Resume code examples' })).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(example.getByRole('tab', { name: 'TypeScript' })).toBeFocused();
  await expect(example.getByRole('tabpanel', { name: 'TypeScript' })).toBeVisible();
  await page.keyboard.press('Home');
  await expect(example.getByRole('tab', { name: 'Agent', exact: true })).toBeFocused();
  await expect(example).toHaveAttribute('data-running', '');
  await page.clock.runFor(500);
  const partial = await example.locator('[data-agent-text]').textContent();
  expect(partial).not.toContain('native and RV32 tests.');
  await page.clock.runFor(4_000);
  await expect(example.locator('[data-agent-text]')).toContainText('Build it and run the native and RV32 tests.');
  await expect(example).not.toHaveAttribute('data-running');
  await example.getByRole('tab', { name: 'Agent', exact: true }).click();
  await page.clock.runFor(500);
  expect(await example.locator('[data-agent-text]').textContent()).not.toContain('native and RV32 tests.');
  await page.clock.runFor(4_000);
  await expect(example).not.toHaveAttribute('data-running');
  await example.getByRole('button', { name: 'Resume code examples' }).click();
  await expect(example).toHaveAttribute('data-running', '');
  await example.getByRole('button', { name: 'Pause code examples' }).click();
  await expect(example).not.toHaveAttribute('data-running');
});

for (const width of [320, 1280]) {
  test(`reduced-motion examples are static and manually selectable at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(origin);
    const example = page.locator('counter-example');
    await example.scrollIntoViewIfNeeded();
    await expect(example).not.toHaveAttribute('data-running');
    await expect(example.getByRole('button', { name: /code examples/ })).not.toBeVisible();
    for (const label of ['Agent', 'Rust', 'TypeScript']) {
      await example.getByRole('tab', { name: label, exact: true }).click();
      await expect(example.getByRole('tabpanel', { name: label, exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: info.outputPath(`${label}.png`) });
    }
  });
}

test('all examples remain readable without JavaScript and in Markdown', async ({ browser, request }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto(origin);
    const example = page.locator('counter-example');
    for (const label of ['Agent', 'Rust', 'TypeScript']) await expect(example.getByRole('tabpanel', { name: label, exact: true })).toBeVisible();
    const markdown = await (await request.get(origin + '/markdown/pages/index.md')).text();
    for (const text of ['### Agent', '### Rust', '### TypeScript', 'native and RV32 tests.', 'strict_inc(amount as i128)', 'Counter.increment.call', 'wallet.executeCallsAndWait']) expect(markdown).toContain(text);
  } finally { await context.close(); }
});
