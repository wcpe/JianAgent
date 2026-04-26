import { test, expect } from '@playwright/test';

// Helper function to login before tests
async function login(page: any) {
  await page.goto('/login');
  await page.fill('input[type="text"]', 'admin');
  await page.fill('input[type="password"]', 'admin123456');
  
  await page.evaluate(() => localStorage.clear());
  
  const responsePromise = page.waitForResponse(response => 
    response.url().includes('/api/v1/auth/login')
  );
  await page.click('button[type="submit"]');
  await responsePromise;
  await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 10000 });
}

test.describe('Task 5: Plugin Manager', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should navigate to plugins tab and trigger plugin actions', async ({ page }) => {
    // Navigate to server workspace first to make sure the state is fully hydrated
    await page.goto('/servers');
    
    // Wait for the servers API to load the list
    await page.waitForResponse(response => response.url().includes('/api/v1/servers') && response.request().method() === 'GET');
    await page.waitForTimeout(1000);
    
    // Now pick the server from the list and navigate to plugins
    const serverCard = page.locator('.animate-card-enter').first();
    
    if (!(await serverCard.isVisible())) {
      throw new Error('No server found in the workspace');
    }
    
    // Double click the card to navigate to its workspace
    await serverCard.dblclick();
    await page.waitForURL(/\/servers\/.*\/terminal/);
    
    // Go to plugins tab
    const targetUrl = page.url().replace('/terminal', '');
    await page.goto(`${targetUrl}/plugins`);
    
    // Give it a moment to load
    await page.waitForTimeout(2000);

    console.log('Current URL:', page.url());
    console.log('Page Title:', await page.title());
    console.log('Body Text:', await page.locator('body').innerText());
    
    // Try to find the tab link itself and click it if visible
    if (await page.locator('button:has-text("插件")').first().isVisible()) {
      await page.click('button:has-text("插件")');
    } else if (await page.locator('a:has-text("插件")').first().isVisible()) {
      await page.click('a:has-text("插件")');
    }
    
    // Check for the header text we know is in the component
    await expect(page.locator('h3:has-text("插件管理")').first()).toBeVisible({ timeout: 10000 });

    // Let's verify if any plugin row exists, if so try clicking hot load
    const pluginRows = page.locator('tbody tr');
    const count = await pluginRows.count();
    
    if (count > 0) {
      // Find the hot load button
      const hotLoadBtn = page.locator('button:has-text("热加载")').first();
      if (await hotLoadBtn.isVisible()) {
        const operationPromise = page.waitForResponse(response => 
          response.url().includes('/api/v1/servers/') && response.url().includes('/plugins/') && response.url().includes('/hot-load') && response.request().method() === 'POST'
        );
        await hotLoadBtn.click();
        await operationPromise;
        
        // Wait for the success banner/toast (could be a notification)
        await expect(page.locator('text="热加载请求已提交"').first().or(page.locator('.toast-success').first())).toBeVisible({ timeout: 5000 });
      }
    }
  });
});
