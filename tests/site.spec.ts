import { test as base, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const origin = 'http://127.0.0.1:4322';
const docs = '/docs/start/build-with-an-agent/';
const onboarding = readFileSync(new URL('../src/content/docs/start/build-with-an-agent.md', import.meta.url), 'utf8');
const prompt = onboarding.match(/```text\r?\n([\s\S]*?)\r?\n```/)![1];
const test = base.extend({
  page: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await use(page);
    expect(errors, 'Browser errors').toEqual([]);
  },
});

test.use({ browserName: 'chromium', viewport: { width: 1280, height: 900 } });

async function checkShell(page: Page) {
  const search = page.locator('site-search > button');
  await expect(search).toHaveAccessibleName('Search documentation');
  const label = search.locator(':scope > span');
  if ((page.viewportSize()?.width ?? 0) >= 1100) {
    await expect(label).toBeVisible();
    await expect(label).toHaveText('Search documentation');
    expect(await label.evaluate(el => {
      const text = document.createRange();
      text.selectNodeContents(el);
      const rect = text.getBoundingClientRect();
      const bounds = el.getBoundingClientRect();
      const button = el.parentElement!.getBoundingClientRect();
      return rect.width <= bounds.width + 1 && rect.left >= button.left && rect.right <= button.right;
    }), 'Full search label fits without clipping').toBe(true);
  } else {
    await expect(label).toBeHidden();
  }
  const geometry = await page.evaluate(() => {
    const controls = [...document.querySelectorAll<HTMLElement>('header a, header button, header select, starlight-menu-button button')]
      .filter(el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
    const overlaps: string[] = [];
    for (let i = 0; i < controls.length; i++) {
      const a = controls[i].getBoundingClientRect();
      for (const other of controls.slice(i + 1)) {
        const b = other.getBoundingClientRect();
        if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
            Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1) {
          overlaps.push(`${controls[i].textContent?.trim()} / ${other.textContent?.trim()}`);
        }
      }
    }
    return { overflow: document.documentElement.scrollWidth - innerWidth, overlaps };
  });
  expect(geometry).toEqual({ overflow: 0, overlaps: [] });
}

for (const width of [320, 375, 701, 800, 1024, 1280, 1920]) {
  test(`homepage shell at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(origin);
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('h1')).toContainText('Blockchain technology built for');
    await expect(page.locator('h1')).toContainText('abundance');
    await expect(page.locator('[id="_top"]')).toHaveCount(1);
    for (const title of ['Payments need rules. Do they need an order?', 'More compute. More throughput.', 'One validator. Many machines.', 'Write Rust. Build something you can use.']) {
      await expect(page.getByRole('heading', { name: title, level: 2 })).toBeVisible();
    }
    await expect(page.locator('.workflow a')).toHaveCount(5);
    await expect(page.locator('header .release-badge')).toHaveText('alpha-pre.1');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#_top$/);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: testInfo.outputPath(`home-${width}.png`), fullPage: true });
    await checkShell(page);
    await expect(page.locator('site-theme-toggle')).toHaveCount(0);
  });
}

for (const route of ['/', docs]) {
  test(`real Pagefind search and Escape focus on ${route}`, async ({ page }) => {
    await page.goto(origin + route);
    const trigger = page.locator('site-search > button');
    await trigger.focus();
    await page.keyboard.press('Control+k');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAccessibleName('Search documentation');
    await dialog.getByRole('textbox', { name: /^Search/ }).fill('contract');
    const results = dialog.locator('.pagefind-ui__result-link');
    await expect(results.first()).toBeVisible();
    expect(await results.count()).toBeGreaterThan(0);
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
    await page.keyboard.press('Control+k');
    await dialog.getByRole('textbox', { name: /^Search/ }).fill('contract');
    await results.first().click();
    await expect(page).not.toHaveURL(origin + route);
    await expect(page.locator('main h1')).toBeVisible();
  });
}

test('mobile homepage navigation and docs sidebar/theme', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ colorScheme: 'dark' });
  const links = [
    ['About', '/docs/architecture/'],
    ['Documentation', '/docs/get-started/'],
  ];
  for (const [name, href] of links) {
    await page.goto(origin);
    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    const link = page.locator('.sidebar .site-navigation').getByRole('link', { name, exact: true });
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(origin + href);
    if (name === 'About') await page.screenshot({ path: testInfo.outputPath('architecture-menu.png') });
    await expect.soft(page.locator('body'), `${name}: navigation closes the menu`).not.toHaveAttribute('data-mobile-menu-expanded', '');
  }
  await page.goto(origin);
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await expect(page.locator('.sidebar .site-navigation').getByRole('link', { name: 'Community', exact: true }))
    .toHaveAttribute('href', 'https://github.com/thruputchain');
  await page.locator('.sidebar').getByRole('link', { name: 'Start Building', exact: true }).click();
  await expect(page).toHaveURL(origin + '/docs/get-started/');
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  const sidebar = page.locator('.sidebar');
  await expect(sidebar.getByRole('link', { name: 'Build with an Agent', exact: true })).toBeVisible();
  await sidebar.getByRole('button', { name: 'Switch to light mode', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await sidebar.getByRole('link', { name: 'Contract quickstart', exact: true }).click();
  await expect(page).toHaveURL(origin + '/docs/get-started/contract/');
  await expect(page.locator('body')).not.toHaveAttribute('data-mobile-menu-expanded', '');
});

test('mobile menu exposes its expanded state and centers both icons', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  for (const route of ['/', docs]) {
    await page.goto(origin + route);
    const button = page.getByRole('button', { name: 'Menu', exact: true });
    for (const expanded of [false, true]) {
      if (expanded) await button.click();
      await expect.soft(button, `${route}: accessible expanded state`).toHaveAttribute('aria-expanded', String(expanded));
      const offset = await button.evaluate(el => {
        const button = el.getBoundingClientRect();
        const icon = [...el.querySelectorAll('svg')].find(svg => svg.getBoundingClientRect().width)!;
        const rect = icon.getBoundingClientRect();
        return { x: rect.x + rect.width / 2 - button.x - button.width / 2,
          y: rect.y + rect.height / 2 - button.y - button.height / 2 };
      });
      expect.soft(offset, `${route}: ${expanded ? 'close' : 'menu'} icon center`).toEqual({ x: 0, y: 0 });
    }
  }
});

test('mobile menu keeps covered content out of keyboard navigation', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(origin);
  const button = page.getByRole('button', { name: 'Menu', exact: true });
  await button.click();
  await expect(page.locator('.main-frame')).toHaveAttribute('inert', '');
  await page.locator('.sidebar').getByRole('link', { name: 'Start Building' }).focus();
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement?.closest('.main-frame') !== null)).toBe(false);
  }
  await page.keyboard.press('Escape');
  await expect(button).toBeFocused();
  await expect(button).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.main-frame')).not.toHaveAttribute('inert', '');
  await button.click();
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.locator('body')).not.toHaveAttribute('data-mobile-menu-expanded', '');
  await expect(page.locator('.main-frame')).not.toHaveAttribute('inert', '');
});

test('system theme follows docs until a manual toggle persists across the dark homepage', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto(origin + docs);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(await page.evaluate(() => localStorage.getItem('starlight-theme'))).toBeNull();
  await page.getByRole('link', { name: 'Stellar Thruput homepage' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('link', { name: 'Start Building', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Switch to light mode', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(await page.evaluate(() => localStorage.getItem('starlight-theme'))).toBe('light');
  await page.emulateMedia({ colorScheme: 'light' });
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('link', { name: 'Stellar Thruput homepage' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(() => localStorage.getItem('starlight-theme'))).toBe('light');
  await page.getByRole('link', { name: 'Start Building', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('theme buttons show one matching icon and stay synchronized across desktop and mobile', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto(origin + docs);
  const buttons = page.locator('site-theme-toggle button');
  await expect(buttons).toHaveCount(2);
  for (const width of [1280, 375, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    if (width === 375) await page.getByRole('button', { name: 'Menu', exact: true }).click();
    for (const theme of ['dark', 'light']) {
      const label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      for (const button of await buttons.all()) {
        await expect(button).toHaveAttribute('aria-label', label);
        await expect(button).toHaveAttribute('title', label);
      }
      const visible = page.locator('site-theme-toggle button:visible');
      await expect(visible).toHaveCount(1);
      await expect(visible.locator('svg:visible')).toHaveCount(1);
      await expect(visible.locator(theme === 'dark' ? 'svg.sun' : 'svg.moon')).toBeVisible();
      await visible.click();
      const nextTheme = theme === 'dark' ? 'light' : 'dark';
      await expect(page.locator('html')).toHaveAttribute('data-theme', nextTheme);
      expect(await page.evaluate(() => localStorage.getItem('starlight-theme'))).toBe(nextTheme);
    }
  }
});

test('header is centered on homepage and full-width with 20px gutters on docs', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  for (const route of ['/', docs]) {
    await page.goto(origin + route);
    const geometry = await page.locator('.site-header').evaluate(el => {
      const rect = el.getBoundingClientRect();
      const header = el.closest('header')!;
      const bounds = header.getBoundingClientRect();
      const style = getComputedStyle(header);
      return { width: rect.width, center: rect.left + rect.width / 2, paddingLeft: style.paddingLeft, paddingRight: style.paddingRight,
        contentWidth: bounds.width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) };
    });
    expect(geometry.center).toBeCloseTo(960, 0);
    if (route === '/') {
      expect(geometry.width).toBeCloseTo(1420, 0);
      expect(geometry.width).toBeLessThan(geometry.contentWidth);
    } else {
      expect(geometry.paddingLeft).toBe('20px');
      expect(geometry.paddingRight).toBe('20px');
      expect(geometry.width).toBeCloseTo(1880, 0);
      expect(geometry.width).toBeCloseTo(geometry.contentWidth, 0);
    }
    const lastControl = page.locator(route === '/' ? '.header-actions .build-link' : '.desktop-theme button');
    const bounds = await lastControl.boundingBox();
    expect(bounds!.x + bounds!.width).toBeCloseTo(route === '/' ? 1670 : 1900, 0);
  }
});

test('header and page titles use Stellar Thruput while preserving the exact CLI install prompt', async ({ page }) => {
  for (const route of ['/', docs]) {
    await page.goto(origin + route);
    const brand = page.locator('header').getByRole('link', { name: 'Stellar Thruput homepage', exact: true });
    await expect(brand).toHaveText('STELLAR THRUPUT');
    await expect(brand).toHaveAttribute('href', '/');
    await expect(page).toHaveTitle(/Stellar Thruput/);
    await expect(page.locator('header').getByRole('link', { name: 'About', exact: true }))
      .toHaveAttribute('href', '/docs/architecture/');
    if (route === '/') {
      await expect(page.locator('#install-label')).toHaveText('Start with your coding agent');
      await expect(page.locator('[data-preview-text]')).toHaveText(prompt);
      await expect(page.getByRole('textbox', { name: 'Full agent prompt', includeHidden: true })).toHaveValue(prompt);
    }
  }
});

test('homepage learn-more links navigate to real docs and valid anchors', async ({ page }) => {
  for (const [feature, href, title] of [
    ['Explore the execution model', '/docs/how-it-works/execution-model/', 'Parallel Execution'],
    ['Understand gas limits', '/docs/programming-model/execution/#gas', 'Contract Execution'],
    ['Choose your storage', '/docs/programming-model/storage-types/', 'Storage Types'],
    ['Build a counter, step by step', '/docs/tutorials/build-a-counter/', 'Build a counter, part 1: Contract'],
  ]) {
    await page.goto(origin);
    const link = page.getByRole('link', { name: feature, exact: true });
    await expect(link).toHaveAttribute('href', href);
    await expect(link.locator('a')).toHaveCount(0);
    await link.click();
    await expect(page).toHaveURL(origin + href);
    await expect(page.locator('main h1')).toHaveText(title);
    const hash = new URL(page.url()).hash;
    if (hash) {
      const target = page.locator(`[id="${decodeURIComponent(hash.slice(1))}"]`);
      await expect(target).toHaveCount(1);
      await expect(target).toBeInViewport();
    }
  }
});

for (const theme of ['light', 'dark'] as const) {
  test(`search ${theme}: accent input and heading hover retain keyboard focus styles`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    await page.goto(origin + docs);
    const searchButton = page.getByRole('button', { name: 'Search documentation', exact: true });
    const border = await searchButton.evaluate(el => getComputedStyle(el).borderColor);
    await searchButton.hover();
    await expect(searchButton).toHaveCSS('border-color', border);
    await searchButton.click();
    const dialog = page.getByRole('dialog', { name: 'Search documentation' });
    const input = dialog.getByRole('textbox', { name: /^Search/ });
    await expect(input).toHaveAttribute('placeholder', 'Search documentation');
    const emptyHeight = await dialog.evaluate(el => el.getBoundingClientRect().height);
    expect(emptyHeight).toBeLessThan(150);
    await input.fill('contract');
    await expect(input).toBeFocused();
    await expect(input).toHaveCSS('outline-style', 'none');
    await expect(input).toHaveCSS('box-shadow', 'none');
    const accent = theme === 'light' ? 'rgb(89, 101, 0)' : 'rgb(233, 239, 100)';
    await expect(input).toHaveCSS('border-color', accent);
    for (const selector of ['.pagefind-ui__result-inner > .pagefind-ui__result-title', '.pagefind-ui__result-nested']) {
      const row = dialog.locator(selector).first();
      const link = row.locator('.pagefind-ui__result-link');
      await expect(row).toBeVisible();
      await row.hover();
      await expect(link).toHaveCSS('color', accent);
      await expect(row).toHaveCSS('outline-style', 'none');
      await input.hover();
      await page.keyboard.press('Tab');
      await link.focus();
      await expect(link).toBeFocused();
      await expect(row).toHaveCSS('outline-style', 'solid');
      await expect(row).toHaveCSS('outline-width', '1px');
      await input.focus();
    }
    await input.fill('');
    await expect(dialog.locator('.pagefind-ui__result-link')).toHaveCount(0);
    await expect.poll(() => dialog.evaluate(el => el.getBoundingClientRect().height)).toBeLessThan(150);
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Search documentation', exact: true })).toBeFocused();
  });
}

test('copies exact full prompt to real clipboard', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto(origin);
  await page.getByRole('button', { name: 'Copy prompt', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Prompt copied to clipboard.');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(prompt);
});

test('logo stays yellow in both themes and toggle follows Start Building', async ({ page }) => {
  for (const theme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: theme });
    await page.goto(origin + docs);
    await expect(page.locator('.site-brand svg:visible')).toHaveCSS('color', 'rgb(233, 239, 100)');
    const build = await page.locator('.header-actions .build-link').boundingBox();
    const toggle = await page.locator('.desktop-theme button').boundingBox();
    expect(build).not.toBeNull();
    expect(toggle).not.toBeNull();
    expect(toggle!.x).toBeGreaterThan(build!.x + build!.width);
  }
});

test('clipboard denial exposes and selects the exact manual prompt', async ({ page, context }) => {
  const session = await context.newCDPSession(page);
  await session.send('Browser.setPermission', {
    permission: { name: 'clipboard-write' }, setting: 'denied', origin,
  });
  await page.goto(origin);
  await page.getByRole('button', { name: 'Copy prompt', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Deploy your first counter' }).getByRole('status')).toContainText('Clipboard access was blocked.');
  const textarea = page.getByRole('textbox', { name: 'Full agent prompt' });
  await expect(textarea).toBeVisible();
  await expect(textarea).toBeFocused();
  await expect(textarea).toHaveValue(prompt);
  expect(await textarea.evaluate((el: HTMLTextAreaElement) => el.value.slice(el.selectionStart, el.selectionEnd))).toBe(prompt);
});

test('no JavaScript homepage is dark and offers manual copying', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, colorScheme: 'light', viewport: { width: 375, height: 812 } });
  const page = await context.newPage();
  try {
    await page.goto(origin);
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(16, 17, 15)');
    await expect(page.getByRole('button', { name: 'Copy prompt', exact: true })).toBeHidden();
    await page.getByText('View full prompt to copy manually', { exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Full agent prompt' })).toHaveValue(prompt);
    await expect(page.getByRole('textbox', { name: 'Full agent prompt' })).toBeVisible();
    await expect(page.locator('[id="_top"]')).toHaveCount(1);
    await page.getByRole('navigation', { name: 'Site navigation', exact: true }).getByRole('link', { name: 'Documentation' }).click();
    await expect(page).toHaveURL(origin + '/docs/get-started/');
  } finally {
    await context.close();
  }
});

for (const width of [320, 375, 701, 800, 1024, 1280, 1920]) {
  for (const theme of ['light', 'dark']) {
    test(`docs ${theme} at ${width}px: shell and anchors`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript(value => localStorage.setItem('starlight-theme', value), theme);
      await page.goto(origin + docs);
      await page.evaluate(() => document.fonts.ready);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await expect(page.locator('[id="_top"]')).toHaveCount(1);
      await page.screenshot({ path: testInfo.outputPath(`docs-${theme}-${width}.png`), fullPage: true });
      await checkShell(page);
      const ids = await page.locator('.sl-markdown-content h2[id]').evaluateAll(headings => headings.map(el => el.id));
      expect(ids.length).toBeGreaterThan(0);
      for (const id of ids) {
        await page.goto(origin + docs + '#' + id);
        const heading = page.locator(`[id="${id}"]`);
        await expect(heading).toBeInViewport();
        const top = await heading.evaluate(el => el.getBoundingClientRect().top);
        const headerBottom = await page.locator('header').evaluate(el => el.getBoundingClientRect().bottom);
        expect(top, `${id}: anchor must clear the fixed header`).toBeGreaterThanOrEqual(headerBottom);
      }
    });
  }
}
