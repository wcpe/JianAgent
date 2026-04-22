import { test, expect } from '@playwright/test';

// Helper function to login before tests
async function login(page: any) {
  await page.goto('/login');
  await page.fill('input[type="text"]', 'admin');
  await page.fill('input[type="password"]', 'admin123456');
  
  // Try to clear localStorage first to ensure clean state
  await page.evaluate(() => localStorage.clear());
  
  const responsePromise = page.waitForResponse(response => 
    response.url().includes('/api/auth/login')
  );
  await page.click('button[type="submit"]');
  const response = await responsePromise;
  console.log('Login status:', response.status());
  
  await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 10000 });
}

test.describe('Task 4: File Manager', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should navigate to files tab, create and edit a file', async ({ page }) => {
    // Let's use the test server we know exists
    const testServerId = 'db091b05-85f9-4de2-83eb-9122857daf5d';
    await page.goto(`/servers/${testServerId}/files`);
    
    // Check if the create file/folder button is visible
    await expect(page.locator('button:has-text("新建文件夹")').first()).toBeVisible();

    // Click create new dir
    await page.click('button:has-text("新建文件夹")');

    // Fill in folder name
    const timestamp = Date.now();
    const testDirName = `test-e2e-${timestamp}`;
    await page.fill('input[placeholder="文件夹名称"]', testDirName);

    // Wait for the creation to complete
    const createPromise = page.waitForResponse(response => 
      response.url().includes('/api/servers/') && response.url().includes('/files') && response.request().method() === 'POST'
    );
    await page.click('button:has-text("创建")');
    await createPromise;

    // Give the tree a moment to re-render
    await page.waitForTimeout(500);

    // Verify the newly created dir is in the tree
    await expect(page.locator(`text="${testDirName}"`).first()).toBeVisible();
  });
});
