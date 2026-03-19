import { test as base } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { loginAs } from './shared';

const STORAGE_DIR = path.resolve(__dirname, '../.auth');
const ADMIN01_STATE = path.join(STORAGE_DIR, 'admin01.json');

/** 檢查快取的 storageState 中 JWT token 是否仍有效（預留 60 秒緩衝） */
function isStorageStateValid(filePath: string): boolean {
  if (!fs.existsSync(filePath)) return false;
  try {
    const state = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const token = state.cookies?.find((c: { name: string }) => c.name === 'token');
    if (!token?.value) return false;
    const payload = JSON.parse(Buffer.from(token.value.split('.')[1], 'base64').toString());
    return payload.exp * 1000 > Date.now() + 60_000;
  } catch {
    return false;
  }
}

/**
 * 擴充 test fixture：worker 啟動時自動以 admin01 登入並快取 storageState。
 * 若快取的 JWT 已過期會自動重新登入。
 * 02-09 測試檔改從此處 import { test, expect } 即可跳過登入。
 */
export const test = base.extend<object, { admin01StorageState: string }>({
  admin01StorageState: [
    async ({ browser }, use) => {
      if (!isStorageStateValid(ADMIN01_STATE)) {
        fs.mkdirSync(STORAGE_DIR, { recursive: true });
        const context = await browser.newContext({ baseURL: 'http://localhost:5173' });
        const page = await context.newPage();
        await loginAs(page, 'admin01', '123456');
        await context.storageState({ path: ADMIN01_STATE });
        await page.close();
        await context.close();
      }
      await use(ADMIN01_STATE);
    },
    { scope: 'worker' },
  ],

  storageState: async ({ admin01StorageState }, use) => {
    await use(admin01StorageState);
  },
});

export { expect } from '@playwright/test';
