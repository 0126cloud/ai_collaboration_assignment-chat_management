import { test as base } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { loginAs } from './shared';

const STORAGE_DIR = path.resolve(__dirname, '../.auth');
const ADMIN01_STATE = path.join(STORAGE_DIR, 'admin01.json');

/**
 * 擴充 test fixture：worker 啟動時自動以 admin01 登入並快取 storageState。
 * 02-09 測試檔改從此處 import { test, expect } 即可跳過登入。
 */
export const test = base.extend<object, { admin01StorageState: string }>({
  admin01StorageState: [
    async ({ browser }, use) => {
      if (!fs.existsSync(ADMIN01_STATE)) {
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
