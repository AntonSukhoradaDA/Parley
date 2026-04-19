import { test, expect, Page } from '@playwright/test';

const unique = () => Math.random().toString(36).slice(2, 8);

async function registerAndLogin(page: Page): Promise<string> {
  const username = `pw_msg_${unique()}`;
  const email = `${username}@test.com`;

  await page.goto('/register');
  await page.fill('input[placeholder*="somewhere" i]', email);
  await page.fill('input[placeholder*="how others" i]', username);
  await page.fill('input[placeholder*="remember" i]', 'password123');
  await page.click('button:has-text("Open account")');
  await expect(page).toHaveURL(/\/(chats)?$/, { timeout: 10_000 });

  return username;
}

async function createAndSelectRoom(page: Page): Promise<string> {
  const roomName = `msg-room-${unique()}`;

  await page.click('button:has-text("New room"), button:has-text("new room")', { timeout: 5_000 });
  await page.locator('input[placeholder*="general" i], input[placeholder*="room" i], input[placeholder*="name" i]').first().fill(roomName);
  await page.click('button:has-text("Open the room"), button:has-text("Create room"), button[type="submit"]');

  const sidebarItem = page.locator(`aside >> text=${roomName}`).first();
  await expect(sidebarItem).toBeVisible({ timeout: 5_000 });
  await sidebarItem.click();

  await expect(page.getByRole('heading', { name: new RegExp(roomName) })).toBeVisible({ timeout: 5_000 });

  // The socket needs to join the new room's channel. Reload ensures a fresh
  // socket connection that includes this room in its memberships.
  await page.reload();
  await expect(page.getByRole('heading', { name: new RegExp(roomName) }).or(
    page.locator(`aside >> text=${roomName}`).first()
  )).toBeVisible({ timeout: 5_000 });

  // Re-select the room after reload
  await page.locator(`aside >> text=${roomName}`).first().click();
  await expect(page.getByRole('heading', { name: new RegExp(roomName) })).toBeVisible({ timeout: 5_000 });

  // Wait for socket reconnect
  await page.waitForTimeout(2_000);

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

    await expect(page.locator(`text=${messageText}`).first()).toBeVisible({ timeout: 10_000 });
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
      await expect(page.locator(`text=${msg}`).first()).toBeVisible({ timeout: 10_000 });
    }
  });
});
