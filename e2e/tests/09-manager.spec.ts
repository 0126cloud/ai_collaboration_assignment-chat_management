import { test, expect } from '../helpers/fixtures';
import { navigateTo, waitForTable, expectMessage } from '../helpers/shared';
import { resetDb } from '../helpers/db';

// Scenario: 高級管理員建立新管理員帳號 (00_doc/manager.feature)
// Scenario: 高級管理員禁用管理員帳號後無法登入 (00_doc/manager.feature)
test.describe('管理員帳號管理模組', () => {
  test.beforeAll(() => {
    resetDb();
  });

  test('建立新管理員帳號 → 列表出現', async ({ page }) => {
    await page.goto('/');
    await navigateTo(page, '帳號管理');
    await waitForTable(page);

    // 點擊新增管理員按鈕
    await page.getByRole('button', { name: /新增管理員/ }).click();

    const dialog = page.getByRole('dialog');
    await dialog.waitFor({ state: 'visible' });

    // 填入帳號資訊
    await dialog.getByPlaceholder('請輸入帳號（至少 3 個字元）').fill('admin_e2e_test');
    await dialog.getByPlaceholder('請輸入密碼（至少 6 個字元）').fill('123456');

    // 選擇角色 — 用鍵盤導航避免 portal dropdown 定位問題
    await dialog.getByTestId('manager__modal__role-select').click();
    await page.keyboard.press('ArrowDown'); // 進階管理員
    await page.keyboard.press('ArrowDown'); // 一般管理員
    await page.keyboard.press('Enter');

    // 送出表單
    await dialog.getByTestId('manager__modal__submit-btn').click();

    // 出現確認對話框「確認新增管理員」，點擊「確認新增」
    const confirmDialog = page.getByRole('dialog', { name: '確認新增管理員' });
    await confirmDialog.waitFor({ state: 'visible' });
    await confirmDialog.getByRole('button', { name: '確認新增' }).click();

    await expectMessage(page, '成功');

    // 驗證列表出現新帳號
    await waitForTable(page);
    await expect(page.getByTestId('manager__table')).toContainText('admin_e2e_test');
  });

  test('禁用管理員 → 無法登入', async ({ page }) => {
    await page.goto('/');
    await navigateTo(page, '帳號管理');
    await waitForTable(page);

    // 找到 admin_e2e_test 並禁用
    const targetRow = page
      .getByTestId('manager__table')
      .locator('tbody tr')
      .filter({ hasText: 'admin_e2e_test' });
    await expect(targetRow).toBeVisible();

    // 點擊停用按鈕（type="link"，文字為「停用」）
    await targetRow.locator('button').filter({ hasText: /停/ }).click();

    // 確認停用 Modal — okText 為「確認停用」，okType 為 danger
    const confirmDialog = page.getByRole('dialog', { name: /確認停用/ });
    await confirmDialog.waitFor({ state: 'visible' });
    await confirmDialog.getByRole('button', { name: '確認停用' }).click();

    // 等待操作完成
    await page.waitForTimeout(1000);

    // 登出 — 按鈕文字為「登出 admin01」
    await page.getByRole('button', { name: /登出/ }).click();
    await page.waitForURL('**/login');

    // 嘗試以被禁用帳號登入
    await page.getByPlaceholder('帳號').fill('admin_e2e_test');
    await page.getByPlaceholder('密碼').fill('123456');
    await page.locator('button[type="submit"]').click();

    // 預期看到錯誤訊息
    await expect(page.locator('.ant-message-notice')).toBeVisible({ timeout: 10000 });
  });
});
