import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('app serves index page', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.ok()).toBeTruthy();
    await expect(page.locator('body')).toBeVisible();
  });
});
