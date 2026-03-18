import { test, expect } from '@playwright/test';
import { loginAs, navigateTo, waitForTable } from '../helpers/shared';
import { resetDb } from '../helpers/db';

test.describe('聊天室模組', () => {
  test.beforeAll(() => {
    resetDb();
  });

  test('聊天室列表顯示所有聊天室', async ({ page }) => {
    await loginAs(page, 'admin01', '123456');
    await navigateTo(page, '聊天室');
    await waitForTable(page);
    await expect(
      page.getByTestId('chatroom__table').locator('tbody').getByRole('row').first(),
    ).toBeVisible();
  });

  test('搜尋聊天室名稱篩選結果', async ({ page }) => {
    await loginAs(page, 'admin01', '123456');
    await navigateTo(page, '聊天室');
    await waitForTable(page);
    await page.getByPlaceholder('名稱或 ID 搜尋').fill('Baccarat');
    await page.getByRole('button', { name: '查詢' }).click();
    // 等待篩選結果回來（分頁從 5 筆變 2 筆）避免 race condition
    await expect(page.getByText('共 2 筆')).toBeVisible({ timeout: 10000 });
    const rows = page.getByTestId('chatroom__table').locator('tbody').getByRole('row');
    const count = await rows.count();
    for (let i = 0; i < count; i++) {
      await expect(rows.nth(i)).toContainText('Baccarat');
    }
  });

  test('重置篩選條件清空表單', async ({ page }) => {
    await loginAs(page, 'admin01', '123456');
    await navigateTo(page, '聊天室');
    await waitForTable(page);
    await page.getByPlaceholder('名稱或 ID 搜尋').fill('Baccarat');
    await page.getByRole('button', { name: '重置' }).click();
    await expect(page.getByPlaceholder('名稱或 ID 搜尋')).toHaveValue('');
    await waitForTable(page);
  });
});
