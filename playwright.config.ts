import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
    testDir: './e2e', timeout: 40000, expect: { timeout: 8000 }, fullyParallel: false,
    forbidOnly: !!process.env.CI, retries: process.env.CI ? 1 : 0, workers: 1,
    reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
    use: { launchOptions: { executablePath: process.env.CHROMIUM_PATH || undefined }, baseURL: 'http://127.0.0.1:4173/formula-alchemy/', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
    projects: [{ name: 'desktop-chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }, { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } }],
    webServer: process.env.FA_OFFLINE_QA === '1' ? undefined : { command: 'npm run preview:pages', url: 'http://127.0.0.1:4173/formula-alchemy/', reuseExistingServer: !process.env.CI, timeout: 60000 },
});
