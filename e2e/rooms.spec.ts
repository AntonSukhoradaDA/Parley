import { test, expect, Page } from '@playwright/test';

const unique = () => Math.random().toString(36).slice(2, 8);

async function registerAndLogin(page: Page): Promise<string> {
  const username = `pw_room_${unique()}`;
  const email = `${username}@test.com`;

  await page.goto('/register');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: /create account/i }).click();
  await expect(page).toHaveURL(/\/chats$/, { timeout: 10_000 });

  return username;
}

test.describe('Rooms', () => {
  test('create a room and see it in the sidebar', async ({ page }) => {
    await registerAndLogin(page);

    // Empty-state "New room" button opens the create-room modal
    await page.getByRole('button', { name: /new room/i }).first().click();

    const roomName = `test-room-${unique()}`;
    await page
      .getByPlaceholder(/general.*ledger.*quiet/i)
      .fill(roomName);

    await page.getByRole('button', { name: /open the room/i }).click();

    // The freshly created room shows up in the sidebar
    await expect(
      page.locator('aside').getByText(roomName).first(),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('browse public rooms', async ({ page }) => {
    await registerAndLogin(page);

    // Empty-state "Browse public rooms" opens the catalog modal
    await page.getByRole('button', { name: /browse public rooms/i }).click();

    await expect(
      page.getByRole('heading', { name: /browse the floor/i }),
    ).toBeVisible({ timeout: 5_000 });
  });
});
