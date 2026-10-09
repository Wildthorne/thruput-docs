import { expect, test } from '@playwright/test';

const origin = 'http://127.0.0.1:4322';

test('parallel payments finish together, exclude overspending, and pause without advancing', async ({ page }) => {
  await page.clock.install();
  await page.goto(origin);
  const animation = page.locator('shared-state-animation');
  await animation.scrollIntoViewIfNeeded();
  await expect(animation).toHaveAttribute('data-running', '');
  await page.clock.runFor(2_800);
  await animation.getByRole('button', { name: 'Pause payment animation' }).click();
  await expect(animation).not.toHaveAttribute('data-running');
  const progress = () => animation.locator('[data-progress]').evaluateAll(elements => elements.map(element => Number((element as HTMLElement).style.transform.match(/scaleX\((.*)\)/)![1])));
  const first = await progress();
  expect(first[0]).toBeGreaterThan(0);
  expect(first[0]).toBeLessThan(1);
  expect(first).toEqual([first[0], first[0], first[0]]);
  await page.clock.runFor(9_000);
  expect(await progress()).toEqual(first);
  await animation.getByRole('button', { name: 'Resume payment animation' }).click();
  await page.clock.runFor(800);
  expect(await progress()).toEqual([1, 1, 1]);
  expect(await animation.locator('[data-outgoing-pulse]').evaluateAll(elements => elements.map(element => element.getAttribute('opacity')))).toEqual(['1', '1', '0']);
  await page.clock.runFor(1_100);
  await expect(animation).toHaveAttribute('data-phase', 'complete');
  await expect(animation.locator('[data-result]')).toHaveText('30');
  await expect(animation.locator('.outcome')).toHaveText(['Admitted', 'Admitted', 'Excluded']);
  expect(await animation.locator('[data-outgoing-pulse]').evaluateAll(elements => elements.map(element => element.getAttribute('opacity')))).toEqual(['0', '0', '0']);
  await expect(animation.locator('[data-stage]')).toHaveText('One valid outcome: 100 − 30 − 40 = 30');
  await page.locator('.project-footer').scrollIntoViewIfNeeded();
  await expect(animation).not.toHaveAttribute('data-running');
});

for (const width of [320, 1280]) {
  test(`reduced-motion diagram is complete and fits at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(origin);
    const animation = page.locator('shared-state-animation');
    await animation.scrollIntoViewIfNeeded();
    await expect(animation).not.toHaveAttribute('data-running');
    await expect(animation.locator('[data-result]')).toHaveText('30');
    await expect(animation.getByRole('button')).not.toBeVisible();
    const box = await animation.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    await page.screenshot({ path: info.outputPath('shared-state.png') });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect(animation).toHaveAttribute('data-running', '');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(animation).not.toHaveAttribute('data-running');
    await expect(animation.locator('[data-result]')).toHaveText('30');
  });
}

test('the complete diagram remains readable without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto(origin);
    const diagram = page.getByRole('figure', { name: /One possible block: payments/ });
    await expect(diagram.locator('.initial strong')).toHaveText('100');
    await expect(diagram.locator('.changes strong')).toHaveText(['−30', '−40', '−50']);
    await expect(diagram.locator('[data-result]')).toHaveText('30');
    await expect(diagram.locator('.outcome')).toHaveText(['Admitted', 'Admitted', 'Excluded']);
    await expect(diagram.locator('.outcome').last()).toBeVisible();
    await expect(diagram.getByRole('button')).not.toBeVisible();
  } finally { await context.close(); }
});
