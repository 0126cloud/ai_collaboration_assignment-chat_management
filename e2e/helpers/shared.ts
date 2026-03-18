import { type Page, expect } from '@playwright/test';

export async function loginAs(page: Page, username: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.getByPlaceholder('帳號').fill(username);
  await page.getByPlaceholder('密碼').fill(password);
  // Ant Design auto-inserts space in 2-char buttons, use CSS selector instead
  await page.locator('button[type="submit"]').click();
  // After login, app navigates to root '/' which renders AdminLayout
  await page.locator('.ant-layout-sider').waitFor({ state: 'visible', timeout: 15000 });
}

export async function navigateTo(page: Page, menuLabel: string): Promise<void> {
  await page.getByRole('menuitem', { name: menuLabel }).click();
}

export async function waitForTable(page: Page): Promise<void> {
  const spinner = page.locator('.ant-spin-spinning');
  const spinnerCount = await spinner.count();
  if (spinnerCount > 0) {
    await spinner.waitFor({ state: 'detached' });
  }
  await expect(page.locator('.ant-table-tbody tr').first()).toBeVisible({
    timeout: 10000,
  });
}

export async function selectOption(
  page: Page,
  placeholder: string,
  optionText: string,
): Promise<void> {
  await page.getByPlaceholder(placeholder).click();
  await page.getByTitle(optionText).click();
}

export async function confirmModal(
  page: Page,
  okText: string | RegExp = '確定',
  dialogName?: string | RegExp,
): Promise<void> {
  const dialog = dialogName
    ? page.getByRole('dialog', { name: dialogName })
    : page.getByRole('dialog');
  await dialog.waitFor({ state: 'visible' });
  await dialog.getByRole('button', { name: okText }).click();
}

export async function expectMessage(page: Page, text: string): Promise<void> {
  await page.locator('.ant-message-notice').filter({ hasText: text }).waitFor({ timeout: 10000 });
}
