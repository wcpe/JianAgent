import { test, expect } from '@playwright/test';

// Define a simple fixture to auto-login if needed
const testWithAuth = test.extend<{ authedPage: any }>({
  authedPage: async ({ page }, use) => {
    // Login if needed (simplified for the test)
    await page.goto('/login');
    await page.evaluate(() => localStorage.setItem('token', 'fake-token'));
    await use(page);
  }
});

testWithAuth.describe('Server Workspace Navigation', () => {
  testWithAuth('double clicking a server card should navigate to /servers/:id/terminal', async ({ authedPage: page }) => {
    await page.goto('/servers');
    
    // Wait for page to load and at least one card to be visible
    await expect(page.locator('h1')).toHaveText('服务器工作台', { timeout: 10000 });
    
    // Switch to card view if not already
    const cardViewBtn = page.getByRole('button', { name: '卡片' });
    if (await cardViewBtn.isVisible()) {
      await cardViewBtn.click();
    }
    
    // Find the first server card
    const firstCard = page.locator('.animate-card-enter').first();
    
    // Make sure we have at least one server for the test
    if (await firstCard.isVisible()) {
      // Double click the card
      await firstCard.dblclick();
      
      // Wait for navigation
      await page.waitForURL(/\/servers\/.*\/terminal/);
      
      // Verify we are on the terminal tab
      await expect(page).toHaveURL(/\/servers\/.*\/terminal/);
    }
  });
});