import { test, expect } from '@playwright/test';

test.describe('Task 1: Auth & Navigation', () => {
  test('should redirect unauthenticated user to login', async ({ page }) => {
    // Attempt to access dashboard without login
    await page.goto('/dashboard');
    
    // Should be redirected to login page
    await expect(page).toHaveURL(/.*\/login/);
  });

  test('should login successfully and redirect to dashboard', async ({ page }) => {
    await page.goto('/login');

    // Fill the login form
    // The default mocked test account in development is admin/admin123456
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'admin123456');
    
    // Set up response listener before clicking
    const responsePromise = page.waitForResponse(response => 
      response.url().includes('/api/v1/auth/login')
    );
    await page.click('button[type="submit"]');

    // Wait for the login API to complete
    const response = await responsePromise;
    console.log('Login status:', response.status());

    await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 10000 });

    // Verify token persistence (localStorage)
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeTruthy();
  });
});