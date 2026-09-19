import { test, expect } from '@playwright/test';
// These are honest unconfigured-deployment tests, not simulated live authentication.
test('root leads to explicit configuration state', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/configuration$/);
  await expect(page.getByText('Configuration Required', { exact: true })).toBeVisible();
});
test('protected workspace never renders without a backend', async ({ page }) => {
  await page.goto('/app/members');
  await expect(page).toHaveURL(/\/configuration$/);
  await expect(
    page.getByRole('heading', { name: 'Connect your ministry’s foundation.' }),
  ).toBeVisible();
});
test('onboarding is protected', async ({ page }) => {
  await page.goto('/onboarding');
  await expect(page).toHaveURL(/\/configuration$/);
});
test('login cannot fabricate authentication', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeDisabled();
  await expect(page.getByLabel('Email address')).toBeVisible();
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Forgot your password?' }).click();
  await expect(page).toHaveURL(/\/reset-password$/);
  await expect(page.getByRole('button', { name: 'Send reset link' })).toBeDisabled();
});
test('registration reports missing integration instead of success', async ({ page }) => {
  await page.goto('/register');
  await expect(page.getByRole('button', { name: 'Create account' })).toBeDisabled();
  await expect(page.getByText('Configuration Required', { exact: true })).toBeVisible();
});
test('health reports configuration not readiness', async ({ request }) => {
  const response = await request.get('/api/health');
  expect(response.status()).toBe(503);
  expect(await response.json()).toMatchObject({
    status: 'configuration_required',
    database: 'not_probed',
  });
  expect(response.headers()['cache-control']).toContain('no-store');
});
test('auth callback cannot claim success without canonical URL', async ({ request }) => {
  const response = await request.get('/auth/callback?code=invalid&next=https://evil.example');
  expect(response.status()).toBe(503);
  expect(await response.text()).toContain('Configuration Required');
});
test('mobile configuration and auth pages fit the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ['/configuration', '/login', '/register']) {
    await page.goto(path);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
});
test('standard security headers are present', async ({ request }) => {
  const response = await request.get('/login');
  expect(response.headers()['x-content-type-options']).toBe('nosniff');
  expect(response.headers()['content-security-policy']).toContain("object-src 'none'");
  expect(response.headers()['referrer-policy']).toBe('strict-origin-when-cross-origin');
});

test('public setup and auth pages pass automated WCAG A/AA checks', async ({ page }) => {
  const { default: AxeBuilder } = await import('@axe-core/playwright');
  for (const path of ['/configuration', '/login', '/register']) {
    await page.goto(path);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(
      results.violations,
      JSON.stringify(
        results.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
      ),
    ).toEqual([]);
  }
});
