import { test, expect } from './fixtures.js';

test.describe('Login Page', () => {
  test('renders login form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('h1')).toHaveText('JianAgent 登录');
    await expect(page.locator('input[type="text"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toHaveText('登录');
  });

  test('redirects to login when not authenticated', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/login/);
  });

  test('shows error on wrong credentials', async ({ page }) => {
    await page.route('**/api/auth/login', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, message: 'invalid credentials' }),
      });
    });

    await page.goto('/login');
    await page.locator('input[type="text"]').fill('wrong');
    await page.locator('input[type="password"]').fill('wrong');
    await page.locator('button[type="submit"]').click();
    // Wait for error message
    await expect(page.locator('.bg-red-50, .bg-red-900\\/50')).toBeVisible({ timeout: 5000 });
  });

  test('successful login redirects to dashboard', async ({ page }) => {
    await page.route('**/api/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, token: 'e2e-token' }),
      });
    });

    await page.goto('/login');
    await page.locator('input[type="text"]').fill('admin');
    await page.locator('input[type="password"]').fill('admin123456');
    await page.locator('button[type="submit"]').click();
    await expect(page).not.toHaveURL(/login/, { timeout: 5000 });
  });

  test('logout returns to login', async ({ authedPage: page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('h1')).toHaveText('Dashboard', { timeout: 10000 });

    // Click logout — button text is '退出登录' in the sidebar
    await page.getByRole('button', { name: '退出登录' }).click();
    await expect(page).toHaveURL(/login/);
  });
});
