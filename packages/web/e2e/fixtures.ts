import { test as base, expect, type Page } from '@playwright/test';

const API_BASE = 'http://localhost:3400';
const CREDENTIALS = { username: 'admin', password: 'admin123' };

/**
 * Authenticated test fixture.
 * Logs in via API, injects the token into localStorage,
 * then navigates so the app picks up the auth state.
 */
export const test = base.extend<{ authedPage: Page }>({
  authedPage: async ({ page }, use) => {
    let token = 'e2e-local-token';

    // Prefer real login flow when backend is available.
    try {
      const res = await page.request.post(`${API_BASE}/api/v1/auth/login`, {
        data: CREDENTIALS,
      });
      if (res.ok()) {
        const body = await res.json();
        token = body.token ?? body.data?.token ?? token;
      }
    } catch {
      // Fallback for UI-only E2E runs without backend services.
    }

    // Inject token into localStorage before navigating
    await page.goto('/login');
    await page.evaluate((t) => sessionStorage.setItem('token', t), token);

    await use(page);
  },
});

export { expect };
