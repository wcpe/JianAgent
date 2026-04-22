import { test, expect } from './fixtures.js';

test.describe('Monitoring Page', () => {
  test('loads monitoring page with server selector', async ({ authedPage: page }) => {
    await page.goto('/monitoring');
    await expect(page.getByRole('heading', { name: '服务器监控' })).toBeVisible({ timeout: 10000 });

    // Server selector
    const select = page.locator('select').first();
    await expect(select).toBeVisible();
  });

  test('has time range buttons', async ({ authedPage: page }) => {
    await page.goto('/monitoring');
    await expect(page.getByRole('heading', { name: '服务器监控' })).toBeVisible({ timeout: 10000 });

    await expect(page.getByRole('button', { name: '1 小时' })).toBeVisible();
    await expect(page.getByRole('button', { name: '6 小时' })).toBeVisible();
    await expect(page.getByRole('button', { name: '24 小时' })).toBeVisible();
    await expect(page.getByRole('button', { name: '7 天' })).toBeVisible();
    await expect(page.getByRole('button', { name: '刷新' })).toBeVisible();
  });

  test('shows metric cards', async ({ authedPage: page }) => {
    await page.goto('/monitoring');
    await expect(page.getByRole('heading', { name: '服务器监控' })).toBeVisible({ timeout: 10000 });

    await expect(page.getByText('TPS', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('MSPT', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('CPU', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('在线玩家', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/内存/).first()).toBeVisible();
    await expect(page.getByText('世界数', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('插件数', { exact: true }).first()).toBeVisible();
  });

  test('has data retention controls', async ({ authedPage: page }) => {
    await page.goto('/monitoring');
    await expect(page.getByRole('heading', { name: '服务器监控' })).toBeVisible({ timeout: 10000 });

    await expect(page.getByText('保留')).toBeVisible();
    await expect(page.getByRole('button', { name: /清理/ })).toBeVisible();
  });
});

test.describe('Servers Page', () => {
  test('loads server management page', async ({ authedPage: page }) => {
    await page.goto('/servers');
    // h1 should contain server-related heading
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Sessions Page', () => {
  test('loads sessions list', async ({ authedPage: page }) => {
    await page.goto('/sessions');
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Logs Page', () => {
  test('loads logs page', async ({ authedPage: page }) => {
    await page.goto('/logs');
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Alerts Page', () => {
  test('loads alerts page', async ({ authedPage: page }) => {
    await page.goto('/alerts');
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Audit Page', () => {
  test('loads audit page', async ({ authedPage: page }) => {
    await page.goto('/audit');
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });
  });
});
