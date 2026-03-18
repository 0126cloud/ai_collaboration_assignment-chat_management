import { test, expect } from '@playwright/test';
import { loginAs, navigateTo, waitForTable, confirmModal } from '../helpers/shared';
import { resetDb } from '../helpers/db';

// Scenario: 管理員查看操作紀錄列表並依類型篩選 (00_doc/operation-log.feature)
test.describe('操作紀錄模組', () => {
  test.beforeAll(() => {
    resetDb();
  });

  test('查看操作紀錄列表 → 每筆包含 operation_type、operator', async ({ page }) => {
    await loginAs(page, 'admin01', '123456');
    await navigateTo(page, '操作紀錄');
    await waitForTable(page);

    const table = page.getByTestId('operation-log__table');
    const rows = table.locator('tbody').getByRole('row');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);

    // 驗證表頭包含必要欄位
    const headers = table.locator('thead').getByRole('columnheader');
    const headerTexts = await headers.allInnerTexts();
    const headerStr = headerTexts.join(',');
    expect(headerStr).toContain('操作類型');
    expect(headerStr).toContain('操作者');
  });

  test('依操作類型篩選 → 只顯示對應紀錄', async ({ page }) => {
    // 先產生一筆 DELETE_MESSAGE log：登入後刪除一筆訊息
    await loginAs(page, 'admin01', '123456');
    await navigateTo(page, '聊天監控');
    await waitForTable(page);

    // 刪除第一筆訊息
    const chatTable = page.getByRole('table');
    const firstRow = chatTable.locator('tbody').getByRole('row').first();
    await firstRow.locator('button').filter({ hasText: /刪/ }).click();
    // 確認刪除 Modal
    await confirmModal(page);

    // 等待操作完成
    await page.waitForTimeout(1000);

    // 前往操作紀錄頁面
    await navigateTo(page, '操作紀錄');
    await waitForTable(page);

    // 篩選操作類型
    await page.getByTestId('operation-log__type-select').click();
    await page.getByTitle('刪除聊天訊息').click();
    await page.getByRole('button', { name: /查詢/ }).click();
    await waitForTable(page);

    // 驗證所有列都是 DELETE_MESSAGE
    const table = page.getByTestId('operation-log__table');
    const rows = table.locator('tbody').getByRole('row');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      await expect(rows.nth(i)).toContainText('刪除聊天訊息');
    }
  });
});
