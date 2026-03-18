import { test, expect } from '@playwright/test';
import {
  loginAs,
  navigateTo,
  waitForTable,
  confirmModal,
  expectMessage,
} from '../helpers/shared';
import { resetDb } from '../helpers/db';

test.describe('黑名單模組', () => {
  test.beforeAll(() => {
    resetDb();
  });

  test('玩家黑名單預設顯示封鎖中記錄', async ({ page }) => {
    await loginAs(page, 'admin01', '123456');
    await navigateTo(page, '黑名單管理');
    await waitForTable(page);
    await expect(page.locator('.ant-table-tbody tr').first()).toBeVisible();
    await expect(page.locator('.ant-table-tbody td').filter({ hasText: 'Player' }).first()).toBeVisible();
  });

  test('新增玩家封鎖成功', async ({ page }) => {
    await loginAs(page, 'admin01', '123456');
    await navigateTo(page, '黑名單管理');
    await waitForTable(page);
    await page.getByRole('button', { name: /新增封鎖/ }).click();
    const dialog = page.getByRole('dialog');
    await dialog.waitFor({ state: 'visible' });
    await dialog.getByPlaceholder('玩家帳號').fill('player999');
    // 選取封鎖原因（必填），dialog 內第 2 個 Select
    await dialog.locator('.ant-select').filter({ hasText: '選擇原因' }).click();
    await page.getByTitle('spam').click();
    // 點選主要確認按鈕（避免 Ant Design 2字自動加空格問題）
    await dialog.locator('.ant-btn-primary').click();
    await expectMessage(page, '封鎖成功');
  });

  test('解封玩家成功', async ({ page }) => {
    await loginAs(page, 'admin01', '123456');
    await navigateTo(page, '黑名單管理');
    await waitForTable(page);
    await page.locator('.ant-table-tbody tr').first().locator('button').filter({ hasText: /解/ }).click();
    await confirmModal(page, '確定');
    await expectMessage(page, '解封成功');
  });

  test('切換至 IP 封鎖類型', async ({ page }) => {
    await loginAs(page, 'admin01', '123456');
    await navigateTo(page, '黑名單管理');
    await waitForTable(page);
    // 點選顯示 "Player" 的 Select
    await page.locator('.ant-select').filter({ hasText: 'Player' }).click();
    await page.getByTitle('IP').click();
    await waitForTable(page);
    await expect(page.locator('.ant-table-tbody td').filter({ hasText: 'IP' }).first()).toBeVisible();
  });

  test('新增 IP 封鎖成功', async ({ page }) => {
    await loginAs(page, 'admin01', '123456');
    await navigateTo(page, '黑名單管理');
    await waitForTable(page);
    await page.locator('.ant-select').filter({ hasText: 'Player' }).click();
    await page.getByTitle('IP').click();
    await page.getByRole('button', { name: /新增封鎖/ }).click();
    const dialog = page.getByRole('dialog');
    await dialog.waitFor({ state: 'visible' });
    await dialog.getByPlaceholder('如 192.168.1.1 或 116.62.238.*').fill('10.0.0.1');
    await dialog.locator('.ant-select').filter({ hasText: '選擇原因' }).click();
    await page.getByTitle('spam').click();
    await dialog.locator('.ant-btn-primary').click();
    await expectMessage(page, '封鎖成功');
  });

  test('依封鎖原因篩選記錄', async ({ page }) => {
    await loginAs(page, 'admin01', '123456');
    await navigateTo(page, '黑名單管理');
    await waitForTable(page);
    // 封鎖原因是 Select，用 placeholder 文字篩選
    await page.locator('.ant-select').filter({ hasText: '封鎖原因' }).click();
    await page.getByTitle('spam').click();
    await page.getByRole('button', { name: '查詢' }).click();
    await waitForTable(page);
    await expect(page.locator('.ant-table-tbody tr').first()).toBeVisible();
  });
});
