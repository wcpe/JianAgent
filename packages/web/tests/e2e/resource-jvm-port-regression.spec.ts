import { test, expect } from '@playwright/test';

async function login(page: any) {
  await page.goto('/login');
  await page.fill('input[type="text"]', 'admin');
  await page.fill('input[type="password"]', 'admin123456');
  const responsePromise = page.waitForResponse((response) =>
    response.url().includes('/api/v1/auth/login'),
  );
  await page.click('button[type="submit"]');
  await responsePromise;
  await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 10000 });
}

test.describe('Resource/JVM/Port Regression', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('resource card opens detail and jvm/port endpoints are not 404', async ({ page }) => {
    const watchedResponses: Array<{ url: string; status: number }> = [];
    page.on('response', (response) => {
      const url = response.url();
      if (url.includes('/api/v1/jvm/') || url.includes('/api/v1/ports')) {
        watchedResponses.push({ url, status: response.status() });
      }
    });

    await page.goto('/resources');
    const targetCard = page.getByRole('button', {
      name: /Paper1201 Real 100 Bots/,
    });
    await expect(targetCard).toBeVisible({ timeout: 15000 });
    await targetCard.click();
    await expect(page).toHaveURL(/\/resources\/[\w-]+$/);

    await page.goto('/jvm');
    const jvmResponse = await page.waitForResponse((response) =>
      response.url().includes('/api/v1/jvm/processes'),
    );
    expect(jvmResponse.status()).not.toBe(404);
    const jvmRefreshSelect = page.getByLabel('刷新间隔');
    await expect(jvmRefreshSelect).toBeVisible();
    await jvmRefreshSelect.selectOption('0');
    await expect(jvmRefreshSelect).toHaveValue('0');

    await page.goto('/ports');
    const portResponse = await page.waitForResponse((response) =>
      response.url().includes('/api/v1/ports'),
    );
    expect(portResponse.status()).not.toBe(404);
    const portRefreshSelect = page.getByLabel('刷新间隔');
    await expect(portRefreshSelect).toBeVisible();
    await portRefreshSelect.selectOption('0');
    await expect(portRefreshSelect).toHaveValue('0');

    const duplicatedPrefixCalls = watchedResponses.filter((entry) =>
      entry.url.includes('/api/v1/api/v1/'),
    );
    expect(duplicatedPrefixCalls).toHaveLength(0);

    const gotNotFoundOnWatchedEndpoints = watchedResponses.filter(
      (entry) => entry.status === 404,
    );
    expect(gotNotFoundOnWatchedEndpoints).toHaveLength(0);
  });
});
