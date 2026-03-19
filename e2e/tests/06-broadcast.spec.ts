import { test, expect } from '../helpers/fixtures';
import { loginAs, navigateTo, waitForTable, expectMessage } from '../helpers/shared';
import { resetDb } from '../helpers/db';

// Scenario: 高級管理員發送廣播至所有聊天室並查看列表 (00_doc/broadcast.feature)
// Scenario: 一般管理員的 sidebar 不顯示廣播選項 (00_doc/broadcast.feature)
test.describe('廣播訊息模組', () => {
  test.beforeAll(() => {
    resetDb();
  });

  test('senior_manager 發送廣播 → 列表顯示 active 狀態', async ({ page }) => {
    await page.goto('/');
    await navigateTo(page, '系統廣播');
    await waitForTable(page);

    // 點擊新增廣播按鈕
    await page.getByRole('button', { name: /新增廣播/ }).click();

    const dialog = page.getByRole('dialog');
    await dialog.waitFor({ state: 'visible' });

    // 填入廣播內容（TextArea）
    await dialog.getByPlaceholder('請輸入廣播訊息內容').fill('System maintenance');

    // 選擇聊天室：全部聊天室
    await dialog.getByTestId('broadcast__modal__chatroom-select').click();
    await page.getByTitle('全部聊天室').click();

    // 填入顯示時長（InputNumber）
    await dialog.getByPlaceholder('例：60').fill('3600');

    // 設定開始時間 — 直接填入日期時間字串
    const dateInput = dialog.getByPlaceholder('請選擇廣播開始時間');
    await dateInput.click();
    // 選擇今天的日期（點擊 Today 按鈕或直接輸入）
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes() + 1).padStart(2, '0')}:00`;
    await dateInput.fill(dateStr);
    await dateInput.press('Enter');

    // 送出 — 按鈕文字為「發送廣播」
    await dialog.getByRole('button', { name: /發送廣播/ }).click();

    // 出現確認發送對話框，點擊「確認發送」
    const confirmDialog = page.getByRole('dialog', { name: '確認發送廣播' });
    await confirmDialog.waitFor({ state: 'visible' });
    await confirmDialog.getByRole('button', { name: '確認發送' }).click();

    // 等待成功訊息
    await expectMessage(page, '成功');

    // 驗證列表出現該訊息
    await waitForTable(page);
    await expect(page.getByTestId('broadcast__table')).toContainText('System maintenance');
  });

  // admin02 無廣播權限，需清除 storageState 後以 admin02 重新登入
  test.describe('一般管理員權限', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('general_manager sidebar 無廣播選項', async ({ page }) => {
      await loginAs(page, 'admin02', '123456');

      // 確認 sidebar 中無「系統廣播」
      const menuItem = page.getByRole('menuitem', { name: '系統廣播' });
      await expect(menuItem).toHaveCount(0);
    });
  });
});
