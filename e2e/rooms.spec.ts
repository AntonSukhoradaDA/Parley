import { test, expect, Page } from '@playwright/test';

const unique = () => Math.random().toString(36).slice(2, 8);

async function registerAndLogin(page: Page): Promise<string> {
  const username = `pw_room_${unique()}`;
  const email = `${username}@test.com`;

  await page.goto('/register');
  await page.fill('input[placeholder*="somewhere" i]', email);
  await page.fill('input[placeholder*="how others" i]', username);
  await page.fill('input[placeholder*="remember" i]', 'password123');
  await page.click('button:has-text("Open account")');
  await expect(page).toHaveURL(/\/(chats)?$/, { timeout: 10_000 });

  return username;
}

test.describe('Rooms', () => {
  test('create a room and see it in the sidebar', async ({ page }) => {
    await registerAndLogin(page);

    await page.click('button:has-text("New room"), button:has-text("new room")', { timeout: 5_000 });

    const roomName = `test-room-${unique()}`;
    await page.locator('input[placeholder*="general" i], input[placeholder*="room" i], input[placeholder*="name" i]').first().fill(roomName);

    await page.click('button:has-text("Open the room"), button:has-text("Create room"), button[type="submit"]');

    // Room should appear in sidebar (use aside to scope to sidebar only)
    await expect(page.locator(`aside >> text=${roomName}`).first()).toBeVisible({ timeout: 5_000 });
  });

  test('browse public rooms', async ({ page }) => {
    await registerAndLogin(page);

    await page.click('button:has-text("Browse"):not(:has-text("public"))', { timeout: 5_000 });

    // The heading "Browse the floor" should be visible
    await expect(page.getByRole('heading', { name: /browse the floor/i })).toBeVisible({ timeout: 5_000 });
  });
});
