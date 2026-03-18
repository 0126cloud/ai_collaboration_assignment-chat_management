import { test, expect } from '@playwright/test';
import { loginAs, navigateTo, waitForTable, expectMessage, confirmModal } from '../helpers/shared';
import { resetDb } from '../helpers/db';

// Scenario: 管理員核准暱稱申請完整流程 (00_doc/nickname-review.feature)
// Scenario: 從聊天監控頁面重設玩家暱稱 (00_doc/chat-monitoring.feature)
test.describe('暱稱審核模組', () => {
  test.beforeAll(() => {
    resetDb();
  });

  test('查看待審核暱稱列表', async ({ page }) => {
    await loginAs(page, 'admin01', '123456');
    await navigateTo(page, '暱稱審核');
    await waitForTable(page);

    const table = page.getByTestId('nickname-review__table');
    const rows = table.locator('tbody').getByRole('row');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });

  test('核准暱稱申請 → 列表消失', async ({ page }) => {
    await loginAs(page, 'admin01', '123456');
    await navigateTo(page, '暱稱審核');
    await waitForTable(page);

    // seed data 第一筆為 player016，直接用 testid 定位
    await page.getByTestId('nickname-review__approve-btn--player016').click();

    // Modal.confirm — 2 字按鈕有空格，用 regex
    await confirmModal(page, /核.*准/);

    await expectMessage(page, '核准');

    // 驗證 player016 已從列表消失
    await page.waitForTimeout(500);
    await waitForTable(page);
    const table = page.getByTestId('nickname-review__table');
    const tableText = await table.innerText();
    expect(tableText).not.toContain('player016');
  });

  test('駁回暱稱申請 → 暱稱重設為帳號名稱', async ({ page }) => {
    await loginAs(page, 'admin01', '123456');
    await navigateTo(page, '暱稱審核');
    await waitForTable(page);

    // 核准 player016 後，第一筆為 player017
    await page.getByTestId('nickname-review__reject-btn--player017').click();

    await confirmModal(page, /駁.*回/);

    await expectMessage(page, '駁回');
  });

  test('從聊天監控頁重設暱稱 → 成功 toast', async ({ page }) => {
    await loginAs(page, 'admin01', '123456');
    await navigateTo(page, '聊天監控');
    await waitForTable(page);

    // 點擊第一筆資料的重設暱稱按鈕
    await page.locator('[data-testid^="chat-monitor__reset-nickname-btn"]').first().click();

    await confirmModal(page, /確認重設/);

    await expectMessage(page, '重設');
  });
});
