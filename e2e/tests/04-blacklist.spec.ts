import { test, expect } from '@playwright/test';
import { loginAs, navigateTo, waitForTable, confirmModal, expectMessage } from '../helpers/shared';
import { resetDb } from '../helpers/db';

test.describe('黑名單模組', () => {
  test.beforeAll(() => {
    resetDb();
  });

  test('玩家黑名單預設顯示封鎖中記錄', async ({ page }) => {
    await loginAs(page, 'admin01', '123456');
    await navigateTo(page, '黑名單管理');
    await waitForTable(page);
    const table = page.getByTestId('blacklist__table');
    const firstRow = table.locator('tbody').getByRole('row').first();
    await expect(firstRow).toBeVisible();
    await expect(firstRow.getByRole('cell', { name: 'Player', exact: true })).toBeVisible();
  });

  test('新增玩家封鎖成功', async ({ page }) => {
    await loginAs(page, 'admin01', '123456');
    await navigateTo(page, '黑名單管理');
    await waitForTable(page);
    await page.getByRole('button', { name: /新增封鎖/ }).click();
    const dialog = page.getByRole('dialog');
    await dialog.waitFor({ state: 'visible' });
    await dialog.getByPlaceholder('玩家帳號').fill('player999');
    // 選取封鎖原因（必填），使用 data-testid
    await dialog.getByTestId('blacklist__modal__reason-select').click();
    await page.getByTitle('spam').click();
    // 點選主要確認按鈕（使用 data-testid）
    await dialog.getByTestId('blacklist__modal__submit-btn').click();
    // 處理二次確認對話框
    await confirmModal(page, '確認封鎖', '確認封鎖');
    await expectMessage(page, '封鎖成功');
  });

  test('解封玩家成功', async ({ page }) => {
    await loginAs(page, 'admin01', '123456');
    await navigateTo(page, '黑名單管理');
    await waitForTable(page);
    const table = page.getByTestId('blacklist__table');
    const firstRow = table.locator('tbody').getByRole('row').first();
    await firstRow.getByRole('button', { name: /解/ }).click();
    await confirmModal(page, '確定');
    await expectMessage(page, '解封成功');
  });

  test('切換至 IP 封鎖類型', async ({ page }) => {
    await loginAs(page, 'admin01', '123456');
    await navigateTo(page, '黑名單管理');
    await waitForTable(page);
    // 點選類型 Select（使用 data-testid）
    await page.getByTestId('blacklist__type-select').click();
    await page.getByTitle('IP').click();
    // 切換類型後需點擊查詢按鈕才觸發 API
    await page.getByTestId('blacklist__search-btn').click();
    await waitForTable(page);
    const table = page.getByTestId('blacklist__table');
    const firstRow = table.locator('tbody').getByRole('row').first();
    await expect(firstRow.getByRole('cell', { name: 'IP', exact: true })).toBeVisible();
  });

  test('新增 IP 封鎖成功', async ({ page }) => {
    await loginAs(page, 'admin01', '123456');
    await navigateTo(page, '黑名單管理');
    await waitForTable(page);
    await page.getByTestId('blacklist__type-select').click();
    await page.getByTitle('IP').click();
    await page.getByRole('button', { name: /新增封鎖/ }).click();
    const dialog = page.getByRole('dialog');
    await dialog.waitFor({ state: 'visible' });
    await dialog.getByPlaceholder('如 192.168.1.1 或 116.62.238.*').fill('10.0.0.1');
    await dialog.getByTestId('blacklist__modal__reason-select').click();
    await page.getByTitle('spam').click();
    await dialog.getByTestId('blacklist__modal__submit-btn').click();
    // 處理二次確認對話框
    await confirmModal(page, '確認封鎖', '確認封鎖');
    await expectMessage(page, '封鎖成功');
  });

  test('依封鎖原因篩選記錄', async ({ page }) => {
    await loginAs(page, 'admin01', '123456');
    await navigateTo(page, '黑名單管理');
    await waitForTable(page);
    // 封鎖原因 Select（使用 data-testid）
    await page.getByTestId('blacklist__reason-select').click();
    await page.getByTitle('spam').click();
    await page.getByRole('button', { name: '查詢' }).click();
    await waitForTable(page);
    const table = page.getByTestId('blacklist__table');
    await expect(table.locator('tbody').getByRole('row').first()).toBeVisible();
  });
});
