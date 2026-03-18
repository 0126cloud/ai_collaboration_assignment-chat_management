import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/shared';
import { resetDb } from '../helpers/db';

test.describe('認證模組', () => {
  test.beforeAll(() => {
    resetDb();
  });

  test('登入頁面正確顯示', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByPlaceholder('帳號')).toBeVisible();
    await expect(page.getByPlaceholder('密碼')).toBeVisible();
    await expect(page.getByTestId('login__submit-btn')).toBeVisible();
  });

  test('使用正確帳密登入成功', async ({ page }) => {
    await loginAs(page, 'admin01', '123456');
    await expect(page).not.toHaveURL(/.*\/login.*/);
    await expect(page.getByRole('menuitem', { name: '聊天監控' })).toBeVisible();
  });

  test('高級管理員可見所有選單項目', async ({ page }) => {
    await loginAs(page, 'admin01', '123456');
    const menuItems = page.getByRole('menuitem');
    await expect(menuItems).toHaveCount(8);
  });

  test('一般管理員選單項目受限', async ({ page }) => {
    await loginAs(page, 'admin02', '123456');
    await expect(page.getByRole('menuitem', { name: '系統廣播' })).not.toBeVisible();
    await expect(page.getByRole('menuitem', { name: '帳號管理' })).not.toBeVisible();
  });

  test('錯誤帳密顯示錯誤訊息', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('帳號').fill('admin01');
    await page.getByPlaceholder('密碼').fill('wrongpassword');
    await page.getByTestId('login__submit-btn').click();
    await expect(page.getByText('帳號或密碼錯誤')).toBeVisible({
      timeout: 5000,
    });
  });

  test('登出後導回登入頁', async ({ page }) => {
    await loginAs(page, 'admin01', '123456');
    await page.getByRole('button', { name: /登出/ }).click();
    await expect(page).toHaveURL(/.*\/login.*/);
  });
});
