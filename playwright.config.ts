import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  workers: 1,
  use: { trace: 'retain-on-failure' },
  webServer: {
    command: 'pnpm build && pnpm preview --ignore-lock --host 127.0.0.1 --port 4322',
    url: 'http://127.0.0.1:4322',
    reuseExistingServer: false,
  },
});
