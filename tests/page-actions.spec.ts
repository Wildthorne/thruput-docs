import { expect, test } from '@playwright/test';

const origin = 'http://127.0.0.1:4322';
const path = '/tutorials/work-with-groundhog-from-typescript/';
const markdown = '/markdown/pages/tutorials/work-with-groundhog-from-typescript.md';

for (const name of ['cli', 'contract', 'typescript', 'react']) {
  test(`copies the ${name} quickstart prompt from its coding-agent section`, async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto(`${origin}/get-started/${name}/`);
    const prompt = await page.locator('#use-a-coding-agent').evaluate(heading => {
      const section = heading.closest('.sl-heading-wrapper') ?? heading;
      for (let node = section.nextElementSibling; node; node = node.nextElementSibling) {
        const code = node.querySelector('pre code');
        if (code) return [...code.querySelectorAll('.ec-line .code')].map(line => line.textContent).join('\n');
      }
      return '';
    });
    expect(prompt).toContain(`/get-started/${name}/`);
    await page.locator('page-actions summary').click();
    await page.getByRole('button', { name: 'Copy task prompt' }).click();
    await expect(page.locator('page-actions').getByRole('status')).toHaveText('Copied');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(prompt);
  });
}

test('copies the exported page, Markdown link, and existing task prompt', async ({ page, context, request }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto(origin + path);
  const actions = page.locator('page-actions');
  const response = await request.get(origin + markdown);
  expect(response.ok()).toBe(true);
  const exported = await response.text();
  expect(exported).toContain('Source: <https://docs.groundhog.dev' + path + '>');
  expect(exported).toContain('groundhog codegen ts');
  expect(exported).not.toContain('Copy page');
  const more = actions.locator('summary');
  await expect(more).toHaveAccessibleName('Agent tools');
  const article = page.locator('.sl-markdown-content');
  const before = await article.boundingBox();
  await more.click();
  const menuBefore = await actions.locator('.options').boundingBox();
  await actions.getByRole('button', { name: 'Copy page', exact: true }).click();
  await expect(actions.getByRole('status')).toHaveText('Copied');
  await expect(actions.locator('[data-copy="page"]')).toHaveText('Copied');
  expect((await actions.locator('.options').boundingBox())!.height).toBe(menuBefore!.height);
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(exported);
  expect((await article.boundingBox())!.y).toBe(before!.y);
  await actions.getByRole('button', { name: 'Copy link for an agent' }).click();
  await expect(actions.getByRole('status')).toHaveText('Copied');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(origin + markdown);
  await expect(actions.locator('[data-copy="link"]')).toBeFocused();
  await expect(actions.locator('[data-copy="link"]')).toHaveText('Copied');
  await expect(actions.locator('[data-copy="page"]')).toHaveText('Copy page');
  await actions.getByRole('button', { name: 'Copy task prompt' }).click();
  await expect(actions.getByRole('status')).toHaveText('Copied');
  const prompt = await page.locator('#work-with-an-agent').evaluate(heading => {
    const section = heading.closest('.sl-heading-wrapper') ?? heading;
    const code = section.nextElementSibling!.querySelector('code')!;
    return [...code.querySelectorAll('.ec-line .code')].map(line => line.textContent).join('\n');
  });
  expect(prompt).toContain('Generate the binding from my part-1 contract spec');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(prompt);
  await expect(actions.locator('[data-copy="prompt"]')).toHaveText('Copied');
  await expect(actions.locator('[data-copy="prompt"]')).toHaveText('Copy task prompt');
  await expect(actions.getByRole('link', { name: 'View Markdown' })).toHaveAttribute('href', markdown);
  await expect(actions.getByRole('link', { name: 'Set up your agent' })).toHaveAttribute('href', '/start/build-with-an-agent/');
  await page.goto(origin + '/typescript/reads/');
  await page.locator('page-actions summary').click();
  await expect(page.getByRole('button', { name: 'Copy task prompt' })).toHaveCount(0);
});

test('clipboard denial offers selected text and restores focus after closing', async ({ page, context, request }) => {
  const session = await context.newCDPSession(page);
  await session.send('Browser.setPermission', { permission: { name: 'clipboard-write' }, setting: 'denied', origin });
  await page.goto(origin + path);
  await page.locator('page-actions summary').click();
  const copy = page.getByRole('button', { name: 'Copy page', exact: true });
  await copy.click();
  const dialog = page.getByRole('dialog', { name: 'Copy manually' });
  await expect(dialog).toBeVisible();
  const text = dialog.getByRole('textbox', { name: 'Text to copy' });
  const exported = await (await request.get(origin + markdown)).text();
  await expect(text).toBeFocused();
  await expect(text).toHaveValue(exported);
  expect(await text.evaluate((element: HTMLTextAreaElement) => element.value.slice(element.selectionStart, element.selectionEnd))).toBe(exported);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('page-actions summary')).toBeFocused();
});

test('failed Markdown fetch reports an error and allows retry', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto(origin + path);
  await page.route('**' + markdown, route => route.fulfill({ status: 503, body: 'Unavailable' }));
  const actions = page.locator('page-actions');
  await actions.locator('summary').click();
  await actions.getByRole('button', { name: 'Copy page', exact: true }).click();
  await expect(actions.getByRole('status')).toContainText('Could not load Markdown');
  await expect(actions.getByRole('dialog')).not.toBeVisible();
  await page.unroute('**' + markdown);
  await actions.getByRole('button', { name: 'Copy page', exact: true }).click();
  await expect(actions.getByRole('status')).toHaveText('Copied');
});

for (const width of [320, 1280]) {
  for (const theme of ['light', 'dark'] as const) {
    test(`page actions at ${width}px in ${theme} support keyboard and fit the viewport`, async ({ page, context }, info) => {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme });
      await page.goto(origin + path);
      const actions = page.locator('page-actions');
      const more = actions.locator('summary');
      const before = await page.locator('.sl-markdown-content').boundingBox();
      await more.focus();
      await page.keyboard.press('Enter');
      await expect(actions.getByRole('link', { name: 'View Markdown' })).toBeVisible();
      await page.keyboard.press('Tab');
      await expect(actions.getByRole('button', { name: 'Copy page', exact: true })).toBeFocused();
      const box = await actions.locator('.options').boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      await page.screenshot({ path: info.outputPath('page-actions.png') });
      await actions.getByRole('button', { name: 'Copy page', exact: true }).click();
      await expect(actions.getByRole('status')).toHaveText('Copied');
      expect((await page.locator('.sl-markdown-content').boundingBox())!.y).toBe(before!.y);
      await page.keyboard.press('Escape');
      await expect(more).toBeFocused();
      await expect(actions.getByRole('link', { name: 'View Markdown' })).not.toBeVisible();
      await more.click();
      await page.locator('h1').click();
      await expect(actions.getByRole('link', { name: 'View Markdown' })).not.toBeVisible();
    });
  }
}

test('Markdown and setup links work without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto(origin + path);
    const actions = page.locator('page-actions');
    await expect(actions.getByRole('button', { name: 'Copy page', exact: true })).not.toBeVisible();
    await actions.locator('summary').click();
    await expect(actions.getByRole('button', { name: 'Copy link for an agent' })).not.toBeVisible();
    await expect(actions.getByRole('link', { name: 'View Markdown' })).toBeVisible();
    await actions.getByRole('link', { name: 'Set up your agent' }).click();
    await expect(page).toHaveURL(origin + '/start/build-with-an-agent/');
  } finally { await context.close(); }
});
