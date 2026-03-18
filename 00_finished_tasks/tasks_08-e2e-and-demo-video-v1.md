# Phase 8: E2E 測試與 Demo 影片生成

## 背景

Phase 7 完成 iOS 風格 Design System 後，本 Phase 引入 Playwright E2E 測試，同時讓測試執行過程自動產出 demo 影片。核心理念：**測試即展示**，一份程式碼雙重目的。

技術設計詳見 [rfc_08-e2e-and-demo-video.md](rfc_08-e2e-and-demo-video.md)。

## 前置條件

- Phase 7 全部完成
- `npm run dev` 前後端正常啟動（client:5173 / server:3000）
- `npm run db:seed` 可正常執行
- `npm test` 現有測試全部通過
- 本機已安裝 Node.js >= 18

---

## Task 8.1: E2E 目錄骨架 + Playwright 設定 ✅

### 建立 / 修改檔案

1. `e2e/package.json`（新增）
2. `e2e/tsconfig.json`（新增）
3. `e2e/playwright.config.ts`（新增）
   - `testDir: './tests'`、`fullyParallel: false`、`workers: 1`、`retries: 0`、`timeout: 60000`
   - `reporter: ['html', ['json', { outputFile: 'test-results/results.json' }]]`
   - `use.video: 'on'`、`viewport: 1920x1080`、`slowMo: 200`
   - `webServer`: command `cd .. && npm run dev`，url `http://localhost:5173`，`reuseExistingServer: true`，`timeout: 120000`
4. `e2e/.gitignore`（新增）
5. 根層 `package.json`（修改）— 新增 E2E 相關 scripts

### 驗證方式

- `cd e2e && npm install` 成功
- `cd e2e && npx playwright install chromium` 下載 browser
- `cd e2e && npx playwright test --list` 顯示 0 tests（目錄存在即可）

---

## Task 8.2: 共用 Helpers ✅

### 建立 / 修改檔案

1. `e2e/helpers/shared.ts`（新增）
   - `loginAs(page, username, password)` — 填表單 → 點登入 → 等待 `.ant-layout-sider` 出現
   - `navigateTo(page, menuLabel)` — `page.getByRole('menuitem', { name: menuLabel }).click()`
   - `waitForTable(page)` — 等 spinner 消失 + 等資料列出現
   - `confirmModal(page, okText)` — dialog 內找按鈕點擊
   - `expectMessage(page, text)` — 等待 Antd message 提示出現

2. `e2e/helpers/db.ts`（新增）
   - `resetDb()` — `execSync('npm run db:migrate && npm run db:seed', { cwd: ROOT_DIR })`

### 驗證方式

- TypeScript 編譯無錯誤：`cd e2e && npx tsc --noEmit`

---

## Task 8.3: spec 檔案 — 認證模組 ✅

### 建立 / 修改檔案

1. `e2e/tests/01-authentication.spec.ts`（新增）
   - 6 個 tests：登入頁顯示、登入成功、高級管理員選單、一般管理員選單受限、錯誤帳密、登出
   - `beforeAll` 呼叫 `resetDb()`

### 驗證方式

- `cd e2e && npx playwright test tests/01-authentication.spec.ts` 全部通過 ✅

---

## Task 8.4: spec 檔案 — 聊天室模組 ✅

### 建立 / 修改檔案

1. `e2e/tests/02-chatroom.spec.ts`（新增）
   - 3 個 tests：列表載入、名稱篩選、重置篩選
   - `beforeAll` 呼叫 `resetDb()`

### 驗證方式

- `cd e2e && npx playwright test tests/02-chatroom.spec.ts` 全部通過 ✅

---

## Task 8.5: spec 檔案 — 聊天監控模組 ✅

### 建立 / 修改檔案

1. `e2e/tests/03-chat-monitoring.spec.ts`（新增）
   - 6 個 tests：列表載入、玩家篩選、聊天室篩選、刪除訊息、封鎖玩家 Modal、重置篩選
   - `beforeAll` 呼叫 `resetDb()`

### 驗證方式

- `cd e2e && npx playwright test tests/03-chat-monitoring.spec.ts` 全部通過 ✅

---

## Task 8.6: spec 檔案 — 黑名單模組 ✅

### 建立 / 修改檔案

1. `e2e/tests/04-blacklist.spec.ts`（新增）
   - 6 個 tests：玩家列表、新增玩家封鎖、解封、切換 IP 類型、新增 IP 封鎖、原因篩選
   - `beforeAll` 呼叫 `resetDb()`

### 驗證方式

- `cd e2e && npx playwright test tests/04-blacklist.spec.ts` 全部通過 ✅

---

## Task 8.7: 全套 E2E 測試驗收

### 驗證方式

- `npm run test:e2e` 從根目錄執行，全部 21 tests 通過
- `e2e/test-results/` 每個 test 目錄下有 `video.webm`
- `e2e/test-results/results.json` 存在且包含完整測試資訊
- `e2e/playwright-report/index.html` 可在瀏覽器開啟查看報告

---

## Task 8.8: compose-video 腳本

### 建立 / 修改檔案

1. `e2e/scripts/compose-video.ts`（新增）
   - 參照 [rfc_08 §5.5](rfc_08-e2e-and-demo-video.md) 影片合成規格
   - 啟動時檢查 `ffmpeg` 是否安裝（不存在則印出安裝指令後 exit）
   - 讀取 `test-results/results.json`，取出測試名稱 + 結果 + webm 路徑
   - 為每個功能模組生成 2 秒標題卡
   - 每個 test webm：轉 MP4 + 燒入 SRT 字幕（包含 ✅/❌ 狀態）
   - 用 `ffmpeg -f concat` 串接所有片段
   - 輸出至 `output/demo.mp4`

### 驗證方式

- `npm run demo:compose`（需先有 `test-results/`）執行成功
- `output/demo.mp4` 存在且可播放
- 影片含標題卡（黑底白字模組名稱）
- 影片含字幕（每個 test 的場景名稱）

---

## Task 8.9: 文件更新

### 修改檔案

1. `00_doc/rfc_00-project_tech_stack.md`（修改）
   - §6.1 Testing Tech Stack：E2E 欄從「**不做**」更新為「**Playwright**」
   - §6.2 Testing 分層策略：新增 E2E 層
   - §6.5 測試檔案結構：新增 `e2e/` 目錄結構說明
   - §6.7 Dev Scripts：新增 `test:e2e` / `demo` scripts

2. `CLAUDE.md`（修改）
   - Document Routing 加入：`E2E 測試與 Demo 影片 | rfc_08-e2e-and-demo-video.md`

### 驗證方式

- 文件內容與實際目錄結構一致
- `CLAUDE.md` Document Routing 表可正確導航至 rfc_08

---

## 執行順序

```
8.1 骨架設定 ✅
    ↓
8.2 helpers ✅
    ↓
8.3 → 8.4 → 8.5 → 8.6   ← spec 檔案 ✅
    ↓
8.7 全套驗收
    ↓
8.8 compose-video（依賴 8.7 的 test-results）
    ↓
8.9 文件更新
```

---

## 完成檢查清單

### 基礎設施

- [x] `e2e/` 目錄建立，`package.json` / `tsconfig.json` / `playwright.config.ts` / `.gitignore`
- [x] `cd e2e && npm install` 成功
- [x] `cd e2e && npx playwright install chromium` 成功
- [x] `e2e/helpers/shared.ts` 所有 helper 函式完成
- [x] `e2e/helpers/db.ts` resetDb() 完成

### E2E Tests

- [x] `01-authentication.spec.ts` — 6 tests 通過
- [x] `02-chatroom.spec.ts` — 3 tests 通過
- [x] `03-chat-monitoring.spec.ts` — 6 tests 通過
- [x] `04-blacklist.spec.ts` — 6 tests 通過
- [x] `npm run test:e2e` 全套 21 tests 通過

### 影片產出

- [x] 每個 test 目錄下有 `video.webm`
- [x] `compose-video.ts` 完成
- [x] `npm run demo` 產出 `output/demo.mp4`
- [x] 影片含標題卡與字幕

### 文件

- [x] `rfc_00` §6 已更新
- [x] `CLAUDE.md` Document Routing 已更新
