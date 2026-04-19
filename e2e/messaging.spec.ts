import { test, expect, Page } from '@playwright/test';

const unique = () => Math.random().toString(36).slice(2, 8);

async function registerAndLogin(page: Page): Promise<string> {
  const username = `pw_msg_${unique()}`;
  const email = `${username}@test.com`;

  await page.goto('/register');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: /create account/i }).click();
  await expect(page).toHaveURL(/\/chats$/, { timeout: 10_000 });

  return username;
}

async function createAndSelectRoom(page: Page): Promise<string> {
  const roomName = `msg-room-${unique()}`;

  await page.getByRole('button', { name: /new room/i }).first().click();
  await page.getByPlaceholder(/general.*ledger.*quiet/i).fill(roomName);
  await page.getByRole('button', { name: /open the room/i }).click();

  // Room appears in sidebar; the gateway auto-joins its Socket.IO channel
  // on membership, so a reload isn't needed.
  const sidebarItem = page
    .locator('aside')
    .getByText(roomName)
    .first();
  await expect(sidebarItem).toBeVisible({ timeout: 5_000 });
  await sidebarItem.click();

  await expect(
    page.getByRole('heading', { name: new RegExp(roomName) }),
  ).toBeVisible({ timeout: 5_000 });

  return roomName;
}

test.describe('Messaging', () => {
  test('send a message via Enter key and see it appear', async ({ page }) => {
    await registerAndLogin(page);
    await createAndSelectRoom(page);

    const messageText = `Hello ${unique()}`;
    const textarea = page.locator('textarea').first();
    await textarea.click();
    await textarea.pressSequentially(messageText, { delay: 10 });
    await textarea.press('Enter');

    await expect(page.locator(`text=${messageText}`).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('send multiple messages', async ({ page }) => {
    await registerAndLogin(page);
    await createAndSelectRoom(page);

    const textarea = page.locator('textarea').first();

    for (let i = 1; i <= 3; i++) {
      const msg = `Msg${i}_${unique()}`;
      await textarea.click();
      await textarea.pressSequentially(msg, { delay: 5 });
      await textarea.press('Enter');
      await expect(page.locator(`text=${msg}`).first()).toBeVisible({
        timeout: 10_000,
      });
    }
  });
});
