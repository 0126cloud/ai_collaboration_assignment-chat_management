import { test, expect } from '@playwright/test';
import {
  loginAs,
  navigateTo,
  waitForTable,
  confirmModal,
  expectMessage,
} from '../helpers/shared';
import { resetDb } from '../helpers/db';

test.describe('聊天監控模組', () => {
  test.beforeAll(() => {
    resetDb();
  });

  test('訊息列表載入並顯示最新訊息', async ({ page }) => {
    await loginAs(page, 'admin01', '123456');
    await navigateTo(page, '聊天監控');
    await waitForTable(page);
    await expect(page.locator('.ant-table-tbody tr').first()).toBeVisible();
  });

  test('依玩家帳號篩選訊息', async ({ page }) => {
    await loginAs(page, 'admin01', '123456');
    await navigateTo(page, '聊天監控');
    await waitForTable(page);
    await page.getByPlaceholder('玩家帳號').fill('player001');
    await page.getByRole('button', { name: '查詢' }).click();
    await waitForTable(page);
    const rows = page.locator('.ant-table-tbody tr');
    const count = await rows.count();
    for (let i = 0; i < count; i++) {
      await expect(rows.nth(i)).toContainText('player001');
    }
  });

  test('依聊天室篩選訊息', async ({ page }) => {
    await loginAs(page, 'admin01', '123456');
    await navigateTo(page, '聊天監控');
    await waitForTable(page);
    // Ant Design Select: click the selector then pick option
    await page.locator('.ant-select').first().click();
    await page.getByTitle('Baccarat Room 1').click();
    await page.getByRole('button', { name: '查詢' }).click();
    await waitForTable(page);
    await expect(page.locator('.ant-table-tbody tr').first()).toBeVisible();
  });

  test('刪除訊息後顯示成功提示', async ({ page }) => {
    await loginAs(page, 'admin01', '123456');
    await navigateTo(page, '聊天監控');
    await waitForTable(page);
    // Ant Design Button type="link" with icon renders as <button>
    await page.locator('.ant-table-tbody tr').first().locator('button').filter({ hasText: /刪/ }).click();
    await confirmModal(page, '確定刪除');
    await expectMessage(page, '訊息已刪除');
  });

  test('封鎖玩家 Modal 正確帶入玩家帳號', async ({ page }) => {
    await loginAs(page, 'admin01', '123456');
    await navigateTo(page, '聊天監控');
    await waitForTable(page);
    const firstRow = page.locator('.ant-table-tbody tr').first();
    const playerUsername = await firstRow.locator('td').nth(1).innerText();
    await firstRow.locator('button').filter({ hasText: /封/ }).click();
    const dialog = page.getByRole('dialog');
    await dialog.waitFor({ state: 'visible' });
    await expect(dialog.getByRole('textbox').first()).toHaveValue(
      playerUsername.trim(),
    );
    await page.keyboard.press('Escape');
  });

  test('重置篩選條件清空表單', async ({ page }) => {
    await loginAs(page, 'admin01', '123456');
    await navigateTo(page, '聊天監控');
    await waitForTable(page);
    await page.getByPlaceholder('玩家帳號').fill('player001');
    await page.getByRole('button', { name: '重置' }).click();
    await expect(page.getByPlaceholder('玩家帳號')).toHaveValue('');
  });
});
