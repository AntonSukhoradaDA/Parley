import { test, expect, Page } from '@playwright/test';

const unique = () => Math.random().toString(36).slice(2, 8);

async function fillRegisterForm(
  page: Page,
  email: string,
  username: string,
  password: string,
) {
  await page.goto('/register');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password').fill(password);
}

test.describe('Authentication', () => {
  const username = `pw_user_${unique()}`;
  const email = `${username}@test.com`;
  const password = 'password123';

  test('register a new account', async ({ page }) => {
    await fillRegisterForm(page, email, username, password);
    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page).toHaveURL(/\/chats$/, { timeout: 10_000 });
  });

  test('logout and login', async ({ page }) => {
    const u2 = `pw_login_${unique()}`;
    const e2 = `${u2}@test.com`;

    // Register -> lands on /chats
    await fillRegisterForm(page, e2, u2, password);
    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page).toHaveURL(/\/chats$/, { timeout: 10_000 });

    // Direct "Sign out" action in the chat header
    await page.getByRole('button', { name: /^sign out$/i }).first().click();
    await expect(page).toHaveURL(/\/login$/, { timeout: 10_000 });

    // Login with the same credentials
    await page.getByLabel('Email').fill(e2);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/chats$/, { timeout: 10_000 });
  });

  test('rejects invalid login', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('nonexistent@test.com');
    await page.getByLabel('Password').fill('wrongpassword');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(
      page.locator('text=/invalid|incorrect|credentials/i'),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('login page links to register', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: /register/i }).click();
    await expect(page).toHaveURL(/\/register$/);
  });
});
