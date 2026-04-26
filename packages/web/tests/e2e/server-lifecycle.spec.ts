import { test, expect } from '@playwright/test';

// Helper function to login before tests
async function login(page: any) {
  await page.goto('/login');
  await page.fill('input[type="text"]', 'admin');
  await page.fill('input[type="password"]', 'admin123456');
  
  const responsePromise = page.waitForResponse(response => 
    response.url().includes('/api/v1/auth/login')
  );
  await page.click('button[type="submit"]');
  await responsePromise;
  await page.waitForURL(/.*\/dashboard/);
}

test.describe('Task 2: Server Lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should navigate to servers page and see server list', async ({ page }) => {
    await page.click('text="服务器工作台"');
    await expect(page).toHaveURL(/.*\/servers/);
    
    // Check if the add server button is present
    await expect(page.locator('text="新建服务器"').first()).toBeVisible();
  });

  test('should open create server drawer', async ({ page }) => {
    await page.click('text="服务器工作台"');
    await page.click('text="新建服务器"');
    
    // Ensure drawer appears
    await expect(page.locator('h2:has-text("新建服务器")')).toBeVisible();
    
    // Fill basic info (just verifying form renders)
    await page.fill('input:below(label:has-text("名称 *"))', 'E2E Test Server');
    
    // Close drawer
    await page.click('button:has-text("×")');
    await expect(page.locator('h2:has-text("新建服务器")')).toBeHidden();
  });
});
