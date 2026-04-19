import { test, expect } from '@playwright/test';

const unique = () => Math.random().toString(36).slice(2, 8);

async function fillRegisterForm(page: any, email: string, username: string, password: string) {
  await page.goto('/register');
  await page.fill('input[placeholder*="somewhere" i]', email);
  await page.fill('input[placeholder*="how others" i]', username);
  await page.fill('input[placeholder*="remember" i]', password);
}

test.describe('Authentication', () => {
  const username = `pw_user_${unique()}`;
  const email = `${username}@test.com`;
  const password = 'password123';

  test('register a new account', async ({ page }) => {
    await fillRegisterForm(page, email, username, password);
    await page.click('button:has-text("Open account")');
    await expect(page).toHaveURL(/\/(chats)?$/, { timeout: 10_000 });
  });

  test('logout and login', async ({ page }) => {
    const u2 = `pw_login_${unique()}`;
    const e2 = `${u2}@test.com`;

    // Register
    await fillRegisterForm(page, e2, u2, password);
    await page.click('button:has-text("Open account")');
    await expect(page).toHaveURL(/\/(chats)?$/, { timeout: 10_000 });

    // Sign out via user menu
    const sessionBtn = page.locator('button:has-text("In session"), button:has-text("session")').first();
    if (await sessionBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await sessionBtn.click();
    }
    await page.click('button:has-text("Sign out"), button:has-text("sign out")', { timeout: 5_000 });
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });

    // Login
    await page.fill('input[placeholder*="somewhere" i], input[type="email"]', e2);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/(chats)?$/, { timeout: 10_000 });
  });

  test('rejects invalid login', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[placeholder*="somewhere" i], input[type="email"]', 'nonexistent@test.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=/invalid|incorrect|credentials/i')).toBeVisible({ timeout: 5_000 });
  });

  test('login page links to register', async ({ page }) => {
    await page.goto('/login');
    await page.click('a:has-text("account"), a:has-text("register"), a:has-text("Open")');
    await expect(page).toHaveURL(/\/register/);
  });
});
