import { expect, test, type Page } from '@playwright/test';

const origin = 'http://127.0.0.1:4322';
const sections = [
  ['Get Started', '/get-started/', 'Get Started'],
  ['Understand Stellar Thruput', '/architecture/', 'Introduction'],
  ['CLI', '/cli/', 'CLI'],
  ['Smart Contracts', '/contracts/', 'Smart Contracts'],
  ['TypeScript', '/typescript/', 'TypeScript'],
  ['React', '/react/', 'React'],
  ['Guides', '/guides/', 'Guides'],
] as const;

function sectionGroup(page: Page, label: string) {
  return page.locator('.sidebar .top-level > li > details').filter({
    has: page.locator(':scope > summary').getByText(label, { exact: true }),
  });
}

test('entry pages keep site navigation separate from expandable documentation sections', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const checked = new Set<string>();
  for (const [label, path, title] of [
    ...sections,
    ['Get Started', '/get-started/cli/', 'CLI quickstart'],
    ['Get Started', '/get-started/contract/', 'Contract quickstart'],
    ['Get Started', '/get-started/typescript/', 'TypeScript quickstart'],
    ['Get Started', '/get-started/react/', 'React quickstart'],
    ['CLI', '/cli/install/', 'Install the CLI'],
    ['CLI', '/cli/create-project/', 'Create a project'],
    ['CLI', '/cli/configuration/', 'Profiles and networks'],
    ['CLI', '/cli/wallets/', 'Keys and wallets'],
    ['CLI', '/cli/build-and-test/', 'Build and test'],
    ['CLI', '/cli/local-node/', 'Run a local node'],
    ['CLI', '/cli/deploy-and-call/', 'Deploy and call'],
    ['CLI', '/cli/transactions/', 'Inspect transactions and events'],
    ['CLI', '/cli/codegen/', 'Generate TypeScript bindings'],
    ['CLI', '/cli/automation/', 'Use the CLI in scripts'],
    ['CLI', '/cli/troubleshooting/', 'Troubleshooting'],
    ['CLI', '/cli/reference/', 'Command reference'],
    ['Smart Contracts', '/contracts/methods/', 'Methods and interfaces'],
    ['Smart Contracts', '/contracts/errors/', 'Handle errors'],
    ['Smart Contracts', '/contracts/cross-contract-calls/', 'Cross-Contract Calls'],
    ['Smart Contracts', '/contracts/debugging/', 'Debug a contract'],
    ['Smart Contracts', '/contracts/events/', 'Events'],
    ['Smart Contracts', '/contracts/client-bindings/', 'Generate client bindings'],
    ['Smart Contracts', '/programming-model/nnint/', 'NNInt and concurrent updates'],
    ['Smart Contracts', '/programming-model/storage-types/', 'Storage Types'],
    ['Smart Contracts', '/how-it-works/contracts/', 'Contract artifacts and addresses'],
    ['Guides', '/tutorials/build-a-counter/', 'Build a counter, part 1: Contract'],
    ['Guides', '/tutorials/work-with-groundhog-from-typescript/', 'Build a counter, part 2: TypeScript'],
    ['Guides', '/tutorials/build-a-counter-with-react/', 'Build a counter, part 3: React'],
    ['Guides', '/tutorials/connect-a-wallet-to-your-app/', 'Build a counter, part 4: Connect a wallet'],
    ['Guides', '/tutorials/build-a-token/', 'Build a token'],
    ['Guides', '/tutorials/build-an-amm/', 'Build an AMM'],
    ['TypeScript', '/tools/typescript-bindings/', 'Use contract bindings'],
    ['TypeScript', '/tools/typescript-sdk/', 'Client API reference'],
    ['TypeScript', '/tools/wallet-integration/', 'Connect a wallet'],
    ['TypeScript', '/tools/wallet-provider/', 'Wallet provider reference'],
    ['TypeScript', '/typescript/connect/', 'Connect to a network'],
    ['TypeScript', '/typescript/values/', 'Addresses and amounts'],
    ['TypeScript', '/typescript/reads/', 'Read contract data'],
    ['TypeScript', '/typescript/accounts/', 'Use a signer in scripts'],
    ['TypeScript', '/typescript/wallet-clients/', 'Accounts and wallet clients'],
    ['TypeScript', '/typescript/transactions/', 'Send transactions'],
    ['TypeScript', '/typescript/transaction-status/', 'Track transaction results'],
    ['TypeScript', '/typescript/events/', 'Read events'],
    ['TypeScript', '/typescript/transport/', 'Configure HTTP transport'],
    ['TypeScript', '/typescript/deployment/', 'Deploy a contract'],
    ['React', '/react/setup/', 'Setup'],
    ['React', '/react/providers/', 'Providers and clients'],
    ['React', '/react/reads/', 'Read contract data'],
    ['React', '/react/balances/', 'Read balances'],
    ['React', '/react/queries/', 'Cache and refresh data'],
    ['React', '/react/events/', 'Read events'],
    ['React', '/react/wallets/', 'Connect a wallet'],
    ['React', '/react/transactions/', 'Send transactions'],
    ['React', '/react/transaction-status/', 'Track transaction results'],
    ['React', '/react/reference/', 'React API reference'],
    ['Smart Contracts', '/reference/sdk-macros/', 'SDK Macros'],
    ['TypeScript', '/typescript/setup/', 'Package setup'],
    ['Smart Contracts', '/contracts/project-structure/', 'Project structure'],
    ['Tools', '/tools/faucet/', 'Faucet'],
    ['Tools', '/tools/block-explorer/', 'Explorer'],
    ['Tools', '/tools/wallet-extension/', 'Wallet Extension'],
    ['Understand Stellar Thruput', '/how-it-works/architecture/', 'System Overview'],
    ['Understand Stellar Thruput', '/how-it-works/execution-model/', 'Parallel Execution'],
    ['Understand Stellar Thruput', '/how-it-works/transaction-lifecycle/', 'Transaction Lifecycle'],
    ['Understand Stellar Thruput', '/how-it-works/storage-economics/', 'Compute, Capacity & Storage'],
    ['Understand Stellar Thruput', '/how-it-works/consensus/', 'Consensus'],
    ['Understand Stellar Thruput', '/how-it-works/networking/', 'Networking'],
    ['Understand Stellar Thruput', '/start/for-blockchain-developers/', 'For Blockchain Developers'],
    ['Understand Stellar Thruput', '/start/for-backend-developers/', 'For Backend Developers'],
    ['Smart Contracts', '/programming-model/execution/', 'Contract Execution'],
  ]) {
    const response = await page.goto(origin + path);
    expect(response?.status()).toBe(200);
    await expect(page.locator('main h1')).toHaveText(title);
    const navigation = page.locator('header .site-navigation');
    await expect(navigation.getByRole('link')).toHaveText(['About', 'Get Started', 'Documentation', 'Community']);
    await expect(page.locator('.sidebar .top-level > li > details > summary .large')).toHaveText([
      ...sections.map(([name]) => name), 'Tools', 'Reference',
    ]);
    await expect(sectionGroup(page, label)).toHaveAttribute('open', '');
    await expect(sectionGroup(page, label).locator('a[aria-current="page"]')).toHaveAttribute('href', path);
    await expect(page.locator('main .section-context')).toHaveCount(0);

    const links = await page.locator('main a[href^="/"]').evaluateAll(elements =>
      elements.map(element => element.getAttribute('href')!)
    );
    for (const link of new Set(links)) {
      if (checked.has(link)) continue;
      checked.add(link);
      const target = await page.request.get(origin + link);
      expect(target.status(), link).toBe(200);
      const hash = new URL(origin + link).hash.slice(1);
      if (hash) expect(await target.text(), link).toContain(`id="${hash}"`);
    }
  }
});

test('deep links open their section and tutorials belong to Guides', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  for (const [path, label] of [
    ['/reference/storage-types/', 'Smart Contracts'],
    ['/tools/typescript-bindings/', 'TypeScript'],
    ['/tutorials/build-a-counter/', 'Guides'],
    ['/tutorials/build-an-amm/', 'Guides'],
    ['/start/build-with-an-agent/', 'Get Started'],
    ['/tutorials/connect-a-wallet-to-your-app/', 'Guides'],
    ['/start/for-blockchain-developers/', 'Understand Stellar Thruput'],
    ['/tools/faucet/', 'Tools'],
    ['/tools/block-explorer/', 'Tools'],
  ]) {
    await page.goto(origin + path);
    await expect(sectionGroup(page, label)).toHaveAttribute('open', '');
    await expect(page.locator('.sidebar a[aria-current="page"]')).toHaveAttribute('href', path);
    await expect(page.locator('.sidebar a[aria-current="page"]')).toBeVisible();
  }

  const typescript = sectionGroup(page, 'TypeScript');
  await expect(typescript.locator('a[href="/tutorials/connect-a-wallet-to-your-app/"]')).toHaveCount(0);
  await expect(sectionGroup(page, 'CLI').locator('details')).toHaveCount(0);
  await expect(sectionGroup(page, 'Get Started').locator('a[href="/tools/faucet/"], a[href="/tools/block-explorer/"]')).toHaveCount(0);
  await expect(sectionGroup(page, 'Understand Stellar Thruput').getByRole('link', { name: 'Introduction', exact: true, includeHidden: true })).toHaveCount(1);
  await expect(page.locator('.sidebar .top-level a[href="/start/"]')).toHaveCount(0);

  await page.goto(origin + '/react/');
  await expect(page.locator('.pagination-links a')).toHaveCount(1);
  await expect(page.locator('.pagination-links a')).toHaveAttribute('href', '/react/setup/');
  await page.goto(origin + '/reference/json-rpc-api/');
  await expect(page.locator('.sidebar a[aria-current="page"]')).toHaveAttribute('href', '/reference/json-rpc-api/');
  await expect(page.locator('.sidebar a[aria-current="page"]')).toBeVisible();
  const reference = sectionGroup(page, 'Reference');
  await expect(reference.getByRole('link', { name: 'TypeScript Client API', exact: true }))
    .toHaveAttribute('href', 'https://client-ts.thruput.network/');
  await expect(reference.getByRole('link', { name: 'TypeScript Protocol API', exact: true }))
    .toHaveAttribute('href', 'https://protocol-ts.thruput.network/');
});

test('sidebar disclosures work with keyboard and mobile links close the menu', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 800, height: 900 });
  await page.goto(origin + '/cli/');
  const contracts = sectionGroup(page, 'Smart Contracts');
  await expect(contracts).not.toHaveAttribute('open', '');
  await contracts.locator(':scope > summary').focus();
  await page.keyboard.press('Enter');
  await expect(contracts).toHaveAttribute('open', '');
  await expect(page).toHaveURL(origin + '/cli/');
  await page.keyboard.press('Tab');
  await expect(contracts.getByRole('link', { name: 'Overview', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(origin + '/contracts/');
  await page.screenshot({ path: testInfo.outputPath('sidebar-desktop.png'), fullPage: false });

  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  const typescript = sectionGroup(page, 'TypeScript');
  await typescript.locator(':scope > summary').click();
  await expect(typescript).toHaveAttribute('open', '');
  await typescript.getByRole('link', { name: 'Overview', exact: true }).click();
  await expect(page).toHaveURL(origin + '/typescript/');
  await expect(page.getByRole('button', { name: 'Menu', exact: true })).toHaveAttribute('aria-expanded', 'false');
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await expect(sectionGroup(page, 'TypeScript')).toHaveAttribute('open', '');
  await expect(sectionGroup(page, 'TypeScript').locator('a[aria-current="page"]')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('sidebar-mobile.png'), fullPage: false });
});

test('the old Start Here URL reaches the single introduction', async ({ page }) => {
  await page.goto(origin + '/start/');
  await expect(page).toHaveURL(origin + '/architecture/');
  await expect(page.locator('main h1')).toHaveText('Introduction');
});

test('the old getting-started URL reaches the contract quickstart', async ({ page }) => {
  await page.goto(origin + '/start/getting-started/');
  await expect(page).toHaveURL(origin + '/get-started/contract/');
  await expect(page.locator('main h1')).toHaveText('Contract quickstart');
});

test('migrated guides preserve old URLs and fragments', async ({ page }) => {
  for (const [oldPath, newPath, fragment] of [
    ['/tools/groundhog-cli/', '/cli/reference/', 'configuration'],
    ['/reference/error-handling/', '/contracts/errors/', 'defining-errors'],
    ['/reference/cross-contract-calls/', '/contracts/cross-contract-calls/', 'gas-limits'],
    ['/programming-model/advanced/', '/programming-model/storage-types/', 'exclusive-writes'],
    ['/programming-model/advanced/', '/programming-model/storage-types/', 'lock-requests'],
    ['/programming-model/advanced/', '/programming-model/nnint/', 'negative-set-values'],
  ]) {
    await page.goto(origin + oldPath + '#' + fragment);
    await expect(page).toHaveURL(origin + newPath + '#' + fragment);
    await expect(page.locator(`[id="${fragment}"]`)).toBeVisible();
  }
});

test('a deep link reveals its active page after another section was collapsed', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(origin + '/typescript/');
  await sectionGroup(page, 'TypeScript').locator(':scope > summary').click();
  await expect(sectionGroup(page, 'TypeScript')).not.toHaveAttribute('open', '');
  await page.goto(origin + '/tools/typescript-bindings/');
  await expect(page.locator('.sidebar a[aria-current="page"]')).toBeVisible();
});

test('retired tutorial links reach the matching task and mapped heading', async ({ page }) => {
  for (const [oldPath, destination] of [
    ['/tutorials/develop-locally/?via=guide#4-start-the-local-node', '/cli/local-node/?via=guide#start-the-node'],
    ['/tutorials/develop-locally/#6-dry-run-and-deploy', '/cli/deploy-and-call/#deploy-an-artifact'],
    ['/tutorials/develop-on-devnet/#2-configure-devnet-identity', '/cli/configuration/#devnet'],
    ['/tutorials/add-events-to-a-contract/#step-1-define-the-event', '/contracts/events/#define-an-event'],
    ['/tutorials/add-events-to-a-contract/#resume-without-missing-events', '/typescript/events/#resume-without-missing-events'],
    ['/tutorials/design-a-swap/#the-problem', '/tutorials/build-an-amm/#understand-acceptance-and-execution'],
  ]) {
    await page.goto(origin + oldPath);
    await expect(page).toHaveURL(origin + destination);
    const hash = new URL(origin + destination).hash.slice(1);
    await expect(page.locator(`[id="${hash}"]`)).toBeVisible();
  }
});
