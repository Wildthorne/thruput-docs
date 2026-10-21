import { expect, test, type Page } from '@playwright/test';

const origin = 'http://127.0.0.1:4322';
const sections = [
  ['Get Started', '/docs/get-started/', 'Get Started'],
  ['Understand Stellar Thruput', '/docs/architecture/', 'Introduction'],
  ['CLI', '/docs/cli/', 'CLI'],
  ['Smart Contracts', '/docs/contracts/', 'Smart Contracts'],
  ['TypeScript', '/docs/typescript/', 'TypeScript'],
  ['React', '/docs/react/', 'React'],
  ['Tutorials', '/docs/tutorials/', 'Tutorials'],
  ['Guides', '/docs/guides/', 'Guides'],
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
    ['Get Started', '/docs/get-started/cli/', 'CLI quickstart'],
    ['Get Started', '/docs/get-started/contract/', 'Contract quickstart'],
    ['Get Started', '/docs/get-started/typescript/', 'TypeScript quickstart'],
    ['Get Started', '/docs/get-started/react/', 'React quickstart'],
    ['CLI', '/docs/cli/install/', 'Install the CLI'],
    ['CLI', '/docs/cli/create-project/', 'Create a project'],
    ['CLI', '/docs/cli/configuration/', 'Profiles and networks'],
    ['CLI', '/docs/cli/wallets/', 'Keys and wallets'],
    ['CLI', '/docs/cli/build-and-test/', 'Build and test'],
    ['CLI', '/docs/cli/local-node/', 'Run a local node'],
    ['CLI', '/docs/cli/deploy-and-call/', 'Deploy and call'],
    ['CLI', '/docs/cli/transactions/', 'Inspect transactions and events'],
    ['CLI', '/docs/cli/codegen/', 'Generate TypeScript bindings'],
    ['CLI', '/docs/cli/automation/', 'Use the CLI in scripts'],
    ['CLI', '/docs/cli/troubleshooting/', 'Troubleshooting'],
    ['CLI', '/docs/cli/reference/', 'Command reference'],
    ['Smart Contracts', '/docs/contracts/methods/', 'Methods and interfaces'],
    ['Smart Contracts', '/docs/contracts/errors/', 'Handle errors'],
    ['Smart Contracts', '/docs/contracts/cross-contract-calls/', 'Cross-Contract Calls'],
    ['Smart Contracts', '/docs/contracts/debugging/', 'Debug a contract'],
    ['Smart Contracts', '/docs/contracts/events/', 'Events'],
    ['Smart Contracts', '/docs/contracts/client-bindings/', 'Generate client bindings'],
    ['Smart Contracts', '/docs/programming-model/nnint/', 'NNInt and concurrent updates'],
    ['Smart Contracts', '/docs/programming-model/storage-types/', 'Storage Types'],
    ['Smart Contracts', '/docs/how-it-works/contracts/', 'Contract artifacts and addresses'],
    ['Tutorials', '/docs/tutorials/build-a-counter/', 'Build a counter, part 1: Contract'],
    ['Tutorials', '/docs/tutorials/work-with-thruput-from-typescript/', 'Build a counter, part 2: TypeScript'],
    ['Tutorials', '/docs/tutorials/build-a-counter-with-react/', 'Build a counter, part 3: React'],
    ['Tutorials', '/docs/tutorials/connect-a-wallet-to-your-app/', 'Build a counter, part 4: Connect a wallet'],
    ['Guides', '/docs/guides/build-a-token/', 'Build a token'],
    ['Guides', '/docs/guides/build-an-amm/', 'Build an AMM'],
    ['Guides', '/docs/guides/consume-the-firehose/', 'Consume the Firehose'],
    ['TypeScript', '/docs/tools/typescript-bindings/', 'Use contract bindings'],
    ['TypeScript', '/docs/tools/typescript-sdk/', 'Client API reference'],
    ['TypeScript', '/docs/tools/wallet-integration/', 'Connect a wallet'],
    ['TypeScript', '/docs/tools/wallet-provider/', 'Wallet provider reference'],
    ['TypeScript', '/docs/typescript/connect/', 'Connect to a network'],
    ['TypeScript', '/docs/typescript/values/', 'Addresses and amounts'],
    ['TypeScript', '/docs/typescript/reads/', 'Read contract data'],
    ['TypeScript', '/docs/typescript/accounts/', 'Use a signer in scripts'],
    ['TypeScript', '/docs/typescript/wallet-clients/', 'Accounts and wallet clients'],
    ['TypeScript', '/docs/typescript/transactions/', 'Send transactions'],
    ['TypeScript', '/docs/typescript/transaction-status/', 'Track transaction results'],
    ['TypeScript', '/docs/typescript/events/', 'Read events'],
    ['TypeScript', '/docs/typescript/transport/', 'Configure HTTP transport'],
    ['TypeScript', '/docs/typescript/deployment/', 'Deploy a contract'],
    ['React', '/docs/react/setup/', 'Setup'],
    ['React', '/docs/react/providers/', 'Providers and clients'],
    ['React', '/docs/react/reads/', 'Read contract data'],
    ['React', '/docs/react/balances/', 'Read balances'],
    ['React', '/docs/react/queries/', 'Cache and refresh data'],
    ['React', '/docs/react/events/', 'Read events'],
    ['React', '/docs/react/wallets/', 'Connect a wallet'],
    ['React', '/docs/react/transactions/', 'Send transactions'],
    ['React', '/docs/react/transaction-status/', 'Track transaction results'],
    ['React', '/docs/react/reference/', 'React API reference'],
    ['Smart Contracts', '/docs/reference/sdk-macros/', 'SDK Macros'],
    ['TypeScript', '/docs/typescript/setup/', 'Package setup'],
    ['Smart Contracts', '/docs/contracts/project-structure/', 'Project structure'],
    ['Tools', '/docs/tools/faucet/', 'Faucet'],
    ['Tools', '/docs/tools/block-explorer/', 'Explorer'],
    ['Tools', '/docs/tools/wallet-extension/', 'Wallet Extension'],
    ['Understand Stellar Thruput', '/docs/how-it-works/architecture/', 'System Overview'],
    ['Understand Stellar Thruput', '/docs/how-it-works/execution-model/', 'Parallel Execution'],
    ['Understand Stellar Thruput', '/docs/how-it-works/transaction-lifecycle/', 'Transaction Lifecycle'],
    ['Understand Stellar Thruput', '/docs/how-it-works/storage-economics/', 'Compute, Capacity & Storage'],
    ['Understand Stellar Thruput', '/docs/how-it-works/consensus/', 'Consensus'],
    ['Understand Stellar Thruput', '/docs/how-it-works/networking/', 'Networking'],
    ['Understand Stellar Thruput', '/docs/start/for-blockchain-developers/', 'For Blockchain Developers'],
    ['Understand Stellar Thruput', '/docs/start/for-backend-developers/', 'For Backend Developers'],
    ['Smart Contracts', '/docs/programming-model/execution/', 'Contract Execution'],
  ]) {
    const response = await page.goto(origin + path);
    expect(response?.status()).toBe(200);
    await expect(page.locator('main h1')).toHaveText(title);
    const navigation = page.locator('header .site-navigation');
    await expect(navigation.getByRole('link')).toHaveText(['About', 'Documentation', 'Community']);
    await expect(navigation.getByRole('link', { name: 'Community', exact: true })).toHaveAttribute('href', 'https://github.com/thruputchain');
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

test('deep links open their section and tutorials and guides have separate sections', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  for (const [path, label] of [
    ['/docs/reference/storage-types/', 'Smart Contracts'],
    ['/docs/tools/typescript-bindings/', 'TypeScript'],
    ['/docs/tutorials/build-a-counter/', 'Tutorials'],
    ['/docs/guides/build-an-amm/', 'Guides'],
    ['/docs/start/build-with-an-agent/', 'Get Started'],
    ['/docs/tutorials/connect-a-wallet-to-your-app/', 'Tutorials'],
    ['/docs/start/for-blockchain-developers/', 'Understand Stellar Thruput'],
    ['/docs/tools/faucet/', 'Tools'],
    ['/docs/tools/block-explorer/', 'Tools'],
  ]) {
    await page.goto(origin + path);
    await expect(sectionGroup(page, label)).toHaveAttribute('open', '');
    await expect(page.locator('.sidebar a[aria-current="page"]')).toHaveAttribute('href', path);
    await expect(page.locator('.sidebar a[aria-current="page"]')).toBeVisible();
  }

  const typescript = sectionGroup(page, 'TypeScript');
  await expect(typescript.locator('a[href="/docs/tutorials/connect-a-wallet-to-your-app/"]')).toHaveCount(0);
  await expect(sectionGroup(page, 'CLI').locator('details')).toHaveCount(0);
  await expect(sectionGroup(page, 'Get Started').locator('a[href="/docs/tools/faucet/"], a[href="/docs/tools/block-explorer/"]')).toHaveCount(0);
  await expect(sectionGroup(page, 'Understand Stellar Thruput').getByRole('link', { name: 'Introduction', exact: true, includeHidden: true })).toHaveCount(1);
  await expect(page.locator('.sidebar .top-level a[href="/docs/start/"]')).toHaveCount(0);

  await page.goto(origin + '/docs/react/');
  await expect(page.locator('.pagination-links a')).toHaveCount(1);
  await expect(page.locator('.pagination-links a')).toHaveAttribute('href', '/docs/react/setup/');
  await page.goto(origin + '/docs/reference/json-rpc-api/');
  await expect(page.locator('.sidebar a[aria-current="page"]')).toHaveAttribute('href', '/docs/reference/json-rpc-api/');
  await expect(page.locator('.sidebar a[aria-current="page"]')).toBeVisible();
  const reference = sectionGroup(page, 'Reference');
  await expect(reference.getByRole('link', { name: 'TypeScript Client API', exact: true }))
    .toHaveAttribute('href', 'https://client-ts.thruput.network/');
  await expect(reference.getByRole('link', { name: 'TypeScript Protocol API', exact: true }))
    .toHaveAttribute('href', 'https://protocol-ts.thruput.network/');
});

test('sidebar disclosures work with keyboard and mobile links close the menu', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 800, height: 900 });
  await page.goto(origin + '/docs/cli/');
  const contracts = sectionGroup(page, 'Smart Contracts');
  await expect(contracts).not.toHaveAttribute('open', '');
  await contracts.locator(':scope > summary').focus();
  await page.keyboard.press('Enter');
  await expect(contracts).toHaveAttribute('open', '');
  await expect(page).toHaveURL(origin + '/docs/cli/');
  await page.keyboard.press('Tab');
  await expect(contracts.getByRole('link', { name: 'Overview', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(origin + '/docs/contracts/');
  await page.screenshot({ path: testInfo.outputPath('sidebar-desktop.png'), fullPage: false });

  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  const typescript = sectionGroup(page, 'TypeScript');
  await typescript.locator(':scope > summary').click();
  await expect(typescript).toHaveAttribute('open', '');
  await typescript.getByRole('link', { name: 'Overview', exact: true }).click();
  await expect(page).toHaveURL(origin + '/docs/typescript/');
  await expect(page.getByRole('button', { name: 'Menu', exact: true })).toHaveAttribute('aria-expanded', 'false');
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await expect(sectionGroup(page, 'TypeScript')).toHaveAttribute('open', '');
  await expect(sectionGroup(page, 'TypeScript').locator('a[aria-current="page"]')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('sidebar-mobile.png'), fullPage: false });
});

test('the old Start Here URL reaches the single introduction', async ({ page }) => {
  await page.goto(origin + '/docs/start/');
  await expect(page).toHaveURL(origin + '/docs/architecture/');
  await expect(page.locator('main h1')).toHaveText('Introduction');
});

test('the old getting-started URL reaches the contract quickstart', async ({ page }) => {
  await page.goto(origin + '/docs/start/getting-started/');
  await expect(page).toHaveURL(origin + '/docs/get-started/contract/');
  await expect(page.locator('main h1')).toHaveText('Contract quickstart');
});

test('migrated guides preserve old URLs and fragments', async ({ page }) => {
  for (const [oldPath, newPath, fragment] of [
    ['/docs/reference/error-handling/', '/docs/contracts/errors/', 'defining-errors'],
    ['/docs/reference/cross-contract-calls/', '/docs/contracts/cross-contract-calls/', 'gas-limits'],
    ['/docs/programming-model/advanced/', '/docs/programming-model/storage-types/', 'exclusive-writes'],
    ['/docs/programming-model/advanced/', '/docs/programming-model/storage-types/', 'lock-requests'],
    ['/docs/programming-model/advanced/', '/docs/programming-model/nnint/', 'negative-set-values'],
  ]) {
    await page.goto(origin + oldPath + '#' + fragment);
    await expect(page).toHaveURL(origin + newPath + '#' + fragment);
    await expect(page.locator(`[id="${fragment}"]`)).toBeVisible();
  }
});

test('a deep link reveals its active page after another section was collapsed', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(origin + '/docs/typescript/');
  await sectionGroup(page, 'TypeScript').locator(':scope > summary').click();
  await expect(sectionGroup(page, 'TypeScript')).not.toHaveAttribute('open', '');
  await page.goto(origin + '/docs/tools/typescript-bindings/');
  await expect(page.locator('.sidebar a[aria-current="page"]')).toBeVisible();
});

test('retired tutorial links reach the matching task and mapped heading', async ({ page }) => {
  for (const [oldPath, destination] of [
    ['/docs/tutorials/develop-locally/?via=guide#4-start-the-local-node', '/docs/cli/local-node/?via=guide#start-the-node'],
    ['/docs/tutorials/develop-locally/#6-dry-run-and-deploy', '/docs/cli/deploy-and-call/#deploy-an-artifact'],
    ['/docs/tutorials/develop-on-devnet/#2-configure-devnet-identity', '/docs/cli/configuration/#devnet'],
    ['/docs/tutorials/add-events-to-a-contract/#step-1-define-the-event', '/docs/contracts/events/#define-an-event'],
    ['/docs/tutorials/add-events-to-a-contract/#resume-without-missing-events', '/docs/typescript/events/#resume-without-missing-events'],
    ['/docs/tutorials/design-a-swap/#the-problem', '/docs/guides/build-an-amm/#understand-acceptance-and-execution'],
  ]) {
    await page.goto(origin + oldPath);
    await expect(page).toHaveURL(origin + destination);
    const hash = new URL(origin + destination).hash.slice(1);
    await expect(page.locator(`[id="${hash}"]`)).toBeVisible();
  }
});
