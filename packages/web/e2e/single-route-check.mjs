import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const routeName = process.argv[2];
const routePath = process.argv[3];
if (!routeName || !routePath) {
  console.error('usage: node single-route-check.mjs <name> <path>');
  process.exit(1);
}

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(currentDir, '../test-results/manual/routes');
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const pageErrors = [];
page.on('pageerror', (err) => {
  pageErrors.push(String(err?.message ?? err));
});

const result = {
  name: routeName,
  path: routePath,
  url: '',
  status: 'ok',
  buttons: 0,
  clicked: 0,
  error: '',
};

try {
  console.log(`[single-route] start ${routeName}`);
  console.log('[single-route] step goto-login');
  await page.goto('http://127.0.0.1:5173/login', { waitUntil: 'domcontentloaded', timeout: 8000 });
  console.log('[single-route] step fill-username');
  await page.fill('input[type="text"]', 'admin', { timeout: 3000 });
  console.log('[single-route] step fill-password');
  await page.fill('input[type="password"]', 'admin123456', { timeout: 3000 });
  console.log('[single-route] step submit-login');
  await page.click('button[type="submit"]');
  console.log('[single-route] step wait-dashboard');
  await page.waitForURL('**/dashboard', { timeout: 5000 });

  console.log('[single-route] step goto-route');
  await page.goto(`http://127.0.0.1:5173${routePath}`, { waitUntil: 'domcontentloaded', timeout: 10000 });
  console.log('[single-route] step after-goto-route');
  await page.waitForTimeout(500);
  console.log('[single-route] step after-short-wait');
  await page.locator('text=Dashboard').first().waitFor({ state: 'visible', timeout: 5000 });
  console.log('[single-route] step app-shell-visible');
  result.url = page.url();

  const loginVisible = await page.locator('h1').filter({ hasText: 'JianAgent 登录' }).isVisible().catch(() => false);
  const loginUrl = result.url.includes('/login');
  if (loginVisible || loginUrl) {
    throw new Error('redirected to login page');
  }

  console.log('[single-route] step screenshot-before-click');
  await page.screenshot({ path: `${outDir}/${routeName}.png`, fullPage: false });

  console.log('[single-route] step collect-buttons');
  const buttons = page.locator('button');
  const count = await buttons.count();
  result.buttons = count;
  for (let i = 0; i < Math.min(count, 8); i++) {
    const b = buttons.nth(i);
    const visible = await b.isVisible().catch(() => false);
    if (!visible) continue;
    const text = ((await b.textContent().catch(() => '')) ?? '').trim();
    if (text.includes('退出登录') || text.includes('登录')) continue;
    const disabled = await b.isDisabled().catch(() => true);
    if (disabled) continue;
    await b.click({ timeout: 2000, noWaitAfter: true }).catch(() => {});
    result.clicked++;
  }

  console.log('[single-route] step screenshot-after-click');
  await page.screenshot({ path: `${outDir}/${routeName}-after-click.png`, fullPage: false }).catch(() => {});
} catch (error) {
  result.status = 'error';
  result.error = String(error instanceof Error ? error.message : error);
  if (pageErrors.length > 0) {
    result.error += ` | pageErrors=${pageErrors.join(' || ')}`;
  }
  await page.screenshot({ path: `${outDir}/${routeName}-error.png`, fullPage: true }).catch(() => {});
}

await browser.close();
console.log(`[single-route] done ${routeName} status=${result.status} url=${result.url}`);
console.log(JSON.stringify(result));
