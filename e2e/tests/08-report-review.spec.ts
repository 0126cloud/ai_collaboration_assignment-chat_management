import { test, expect } from '@playwright/test';
import { loginAs, navigateTo, waitForTable, expectMessage, confirmModal } from '../helpers/shared';
import { resetDb } from '../helpers/db';

// Scenario: 管理員核准檢舉，被檢舉玩家自動加入黑名單 (00_doc/report-review.feature)
test.describe('玩家檢舉審核模組', () => {
  test.beforeAll(() => {
    resetDb();
  });

  test('查看待審核檢舉列表', async ({ page }) => {
    await loginAs(page, 'admin01', '123456');
    await navigateTo(page, '玩家檢舉');
    await waitForTable(page);

    const rows = page.getByTestId('report-review__table').locator('tbody').getByRole('row');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });

  test('核准檢舉 → 被檢舉玩家出現在黑名單', async ({ page }) => {
    await loginAs(page, 'admin01', '123456');
    await navigateTo(page, '玩家檢舉');
    await waitForTable(page);

    // seed data 第一筆 pending 的被檢舉玩家為 player003
    const targetUsername = 'player003';

    // 使用 test-id 模式匹配第一筆核准按鈕（ID 由 DB autoincrement 產生，無法硬編碼）
    const approveBtn = page.locator('[data-testid^="report-review__approve-btn--"]').first();
    await approveBtn.click();

    // 使用 confirmModal helper 確認 Modal
    await confirmModal(page, /核.*准/);

    await expectMessage(page, '核准');

    // 導航至黑名單頁面確認
    await navigateTo(page, '黑名單管理');
    await waitForTable(page);

    // 驗證被檢舉玩家出現在黑名單中
    await expect(page.locator('table')).toContainText(targetUsername);
  });

  test('駁回檢舉 → status 顯示 rejected', async ({ page }) => {
    await loginAs(page, 'admin01', '123456');
    await navigateTo(page, '玩家檢舉');
    await waitForTable(page);

    // 使用 test-id 模式匹配第一筆駁回按鈕（前一測試已核准第一筆，此為剩餘的 pending）
    const rejectBtn = page.locator('[data-testid^="report-review__reject-btn--"]').first();
    await rejectBtn.click();

    // 使用 confirmModal helper 確認 Modal
    await confirmModal(page, /駁.*回/);

    await expectMessage(page, '駁回');
  });
});
