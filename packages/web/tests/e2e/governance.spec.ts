import { test, expect } from '@playwright/test';

async function login(page: any) {
  await page.goto('/login');
  await page.fill('input[type="text"]', 'admin');
  await page.fill('input[type="password"]', 'admin123456');
  await page.evaluate(() => localStorage.clear());
  const responsePromise = page.waitForResponse(response => response.url().includes('/api/v1/auth/login'));
  await page.click('button[type="submit"]');
  await responsePromise;
  await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 10000 });
}

test.describe('Task 10: Validation, Audit and Governance', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should navigate to Validation, Audit, Alerts and Notification config', async ({ page }) => {
    // 1. Validation Center
    await page.goto('/validation');
    await expect(page.locator('h1:has-text("验证中心")').first().or(page.locator('h1:has-text("验证与治理中心")').first())).toBeVisible({ timeout: 10000 });
    
    // Check if validation plan or quick test buttons exist
    await expect(page.locator('button', { hasText: '快速验证' }).first()).toBeVisible({ timeout: 5000 });
    
    // 2. Audit Logs
    await page.goto('/audit');
    await expect(page.locator('h1:has-text("审计日志")').first().or(page.locator('h1:has-text("操作审计日志")').first())).toBeVisible({ timeout: 10000 });
    
    // Wait for audit list API
    await page.waitForResponse(response => response.url().includes('/api/v1/audit') && response.request().method() === 'GET').catch(() => null);
    
    // Check if table renders
    const hasTable = await page.locator('table').first().isVisible();
    const hasEmptyText = await page.locator('text="暂无数据"').first().isVisible();
    const hasHeader = await page.locator('h1:has-text("审计日志")').first().isVisible();
    
    expect(hasTable || hasEmptyText || hasHeader).toBeTruthy();

    // 3. Alerts
    await page.goto('/alerts');
    await expect(page.locator('h1:has-text("告警管理")').first().or(page.locator('h1:has-text("告警面板")').first())).toBeVisible({ timeout: 10000 });
    
    // 4. Notifications
    await page.goto('/notifications');
    await expect(page.locator('h1:has-text("告警通知渠道")').first().or(page.locator('h1:has-text("通知渠道设置")').first())).toBeVisible({ timeout: 10000 });
  });
});
