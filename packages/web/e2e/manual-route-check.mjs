import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const routes = [
  ['dashboard', '/dashboard'],
  ['servers', '/servers'],
  ['terminals', '/terminals'],
  ['bots', '/bots'],
  ['quick-tests', '/quick-tests'],
  ['sessions', '/sessions'],
  ['session-templates', '/session-templates'],
  ['monitoring', '/monitoring'],
  ['population', '/population'],
  ['diagnostics', '/diagnostics'],
  ['logs', '/logs'],
  ['alerts', '/alerts'],
  ['audit', '/audit'],
  ['workers', '/workers'],
  ['jvm-observability', '/jvm-observability'],
];

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(currentDir, '../test-results/manual/routes');
fs.mkdirSync(outDir, { recursive: true });

const report = [];

const browser = await chromium.launch({ headless: true });

async function ensureAuth(page) {
  await page.goto('http://127.0.0.1:5173/login', { waitUntil: 'domcontentloaded', timeout: 8000 });
  await page.fill('input[type="text"]', 'admin', { timeout: 3000 });
  await page.fill('input[type="password"]', 'admin123456', { timeout: 3000 });
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 5000 });
}

for (const [name, path] of routes) {
  const item = { name, path, url: '', buttons: 0, clicked: 0, status: 'ok', error: '' };
  const page = await browser.newPage();
  try {
    console.log(`[route-check] start ${name}`);
    await ensureAuth(page);
    await page.goto(`http://127.0.0.1:5173${path}`, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.waitForTimeout(600);
    item.url = page.url();

    const isLoginPageByUrl = item.url.includes('/login');
    const isLoginPageByDom = await page.locator('h1').filter({ hasText: 'JianAgent 登录' }).isVisible().catch(() => false);
    const isLoginPage = isLoginPageByUrl || isLoginPageByDom;
    if (isLoginPage) {
      throw new Error('route redirected to login page');
    }

    await page.screenshot({ path: `${outDir}/${name}.png`, fullPage: true });

    const buttons = page.locator('button');
    const count = await buttons.count();
    item.buttons = count;
    const maxClicks = Math.min(count, 8);

    for (let i = 0; i < maxClicks; i++) {
      const btn = buttons.nth(i);
      const visible = await btn.isVisible().catch(() => false);
      if (!visible) continue;
      const text = ((await btn.textContent().catch(() => '')) ?? '').trim();
      if (text.includes('退出登录') || text.includes('登录')) continue;
      const disabled = await btn.isDisabled().catch(() => true);
      if (disabled) continue;
      await btn.click({ timeout: 2000, noWaitAfter: true }).catch(() => {});
      if (page.isClosed()) break;
      item.clicked++;
    }

    if (!page.isClosed()) {
      await page.screenshot({ path: `${outDir}/${name}-after-click.png`, fullPage: true }).catch(() => {});
    }
  } catch (error) {
    item.status = 'error';
    item.error = String(error instanceof Error ? error.message : error);
    console.log(`[route-check] failed ${name}: ${item.error}`);
    await page.screenshot({ path: `${outDir}/${name}-error.png`, fullPage: true }).catch(() => {});
  }
  if (item.status === 'ok') {
    console.log(`[route-check] ok ${name} clicked=${item.clicked}/${item.buttons}`);
  }
  await page.close().catch(() => {});
  report.push(item);
}

fs.writeFileSync(`${outDir}/report.json`, JSON.stringify(report, null, 2));
await browser.close();
console.log('route-report-ready');
