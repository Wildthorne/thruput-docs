import { expect, test } from '@playwright/test';

const origin = 'http://127.0.0.1:4322';

for (const width of [320, 1280]) {
  test(`executor machines can be selected with the keyboard and fit at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(origin);
    const diagram = page.locator('validator-scale');
    await diagram.scrollIntoViewIfNeeded();
    const controls = diagram.getByRole('group', { name: 'Executor machines', exact: true });
    const machines = diagram.getByRole('list', { name: 'Contract executor machines' }).getByRole('listitem');
    await expect(machines).toHaveCount(5);
    const one = controls.getByRole('button', { name: '1 executor machine', exact: true });
    await one.focus();
    await page.keyboard.press('Enter');
    await expect(one).toHaveAttribute('aria-pressed', 'true');
    await expect(machines).toHaveCount(1);
    await page.keyboard.press('Tab');
    await page.keyboard.press('Space');
    await expect(controls.getByRole('button', { name: '3 executor machines', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(one).toHaveAttribute('aria-pressed', 'false');
    await expect(machines).toHaveCount(3);
    await controls.getByRole('button', { name: '5 executor machines', exact: true }).click();
    await expect(machines).toHaveCount(5);
    const box = await diagram.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: info.outputPath('validator-scale.png') });
    const chart = page.getByRole('figure', { name: 'More machines. More work.', exact: true });
    await chart.scrollIntoViewIfNeeded();
    await expect(chart.locator('.bar-value')).toHaveText(['700K', '1.25M', '1.89M', '2.42M', '2.95M']);
    await expect(chart).toContainText('Multi-machine values are estimates');
    const chartBox = await chart.boundingBox();
    expect(chartBox!.x).toBeGreaterThanOrEqual(0);
    expect(chartBox!.x + chartBox!.width).toBeLessThanOrEqual(width);
    await page.screenshot({ path: info.outputPath('execution-scaling.png') });
  });
}

test('validator topology is complete without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto(origin);
    const diagram = page.locator('validator-scale');
    await expect(diagram.getByRole('group', { name: 'Executor machines', exact: true })).not.toBeVisible();
    await expect(diagram.getByRole('listitem')).toHaveCount(5);
    await expect(diagram.getByText('Coordinator', { exact: true })).toBeVisible();
    await expect(diagram.getByText('Internal RPC', { exact: true })).toBeVisible();
    await expect(diagram.getByText('State', { exact: true })).toBeVisible();
  } finally { await context.close(); }
});
