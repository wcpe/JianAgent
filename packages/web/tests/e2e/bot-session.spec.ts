import { test, expect } from '@playwright/test';

async function login(page: any) {
  await page.goto('/login');
  await page.fill('input[type="text"]', 'admin');
  await page.fill('input[type="password"]', 'admin123456');
  await page.evaluate(() => localStorage.clear());
  const responsePromise = page.waitForResponse(response => response.url().includes('/api/auth/login'));
  await page.click('button[type="submit"]');
  await responsePromise;
  await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 10000 });
}

test.describe('Task 8: Bot and Session Engine', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should navigate to Bots and Sessions pages', async ({ page }) => {
    // 1. Bots Workspace
    await page.goto('/bots');
    await expect(page.locator('h1:has-text("机器人控制台")').first().or(page.locator('h1:has-text("机器人工作台")').first())).toBeVisible({ timeout: 10000 });
    
    // Check if Create Bot Group button is visible
    await expect(page.locator('button:has-text("创建批次")').first().or(page.locator('button:has-text("新建机器组")').first()).or(page.locator('button:has-text("新建")').first())).toBeVisible({ timeout: 5000 });
    
    // 2. Sessions Workspace
    await page.goto('/sessions');
    await expect(page.locator('h1:has-text("压测会话")').first().or(page.locator('h1:has-text("会话管理")').first())).toBeVisible({ timeout: 10000 });
    
    // Check if Create Session button is visible
    await expect(page.locator('a[href="/sessions/new"]').first().or(page.locator('button:has-text("新建会话")').first())).toBeVisible({ timeout: 5000 });
  });
});
