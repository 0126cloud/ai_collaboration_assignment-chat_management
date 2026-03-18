# RFC: E2E 測試與 Demo 影片生成

## 1. 背景

專案已完成 7 個 Phase（認證、聊天監控、聊天室、黑名單、暱稱審核、廣播訊息、Design System），現有測試涵蓋 Unit / Integration / Component 三層，但缺少**端對端（E2E）測試** — 即真實啟動 server + client，透過瀏覽器模擬使用者操作的驗收測試。

原先 `rfc_00` §6.1 決定「不做 E2E（理由：Demo 項目維護成本過高）」，但此決定的核心假設是 E2E 只服務展示，維護動機低而成本高。**本 RFC 改變這個假設**：

> **測試即展示** — 一份 Playwright E2E 測試程式碼同時達成兩個目的：CI 品質保障 + 功能展示影片。測試通過 = 影片可信；測試失敗 = 影片忠實呈現 bug。

這樣 E2E 測試有日常維護動機（CI 失敗有人修），展示影片則是測試執行的自動副產品。

---

## 2. 目標

- 建立 Playwright E2E 測試基礎設施（`e2e/` 目錄）
- 針對各功能模組的 happy path 撰寫 E2E 測試（35-46 個 test cases）
- 利用 Playwright 內建錄影功能，測試執行時自動產出 `.webm` 片段
- 提供後處理腳本，將測試片段合成為帶字幕的 demo 影片

---

## 3. 提案

### 3.1 與現有測試的關係

|      | 現有 Unit / Integration / Component Tests        | 本 Phase 新增 E2E Tests              |
| ---- | ------------------------------------------------ | ------------------------------------ |
| 框架 | Vitest + Testing Library + supertest             | Playwright                           |
| 環境 | jsdom / in-memory SQLite                         | 真實 browser + 真實 server + 真實 DB |
| 範圍 | 單一元件 / 單一 API endpoint                     | 跨頁面完整使用者流程                 |
| 速度 | 快（秒級）                                       | 慢（分鐘級）                         |
| 位置 | `client/src/__tests__/`、`server/src/__tests__/` | `e2e/`                               |

**互補，不重疊。** 現有測試驗證個別元件 / API 邏輯；E2E 驗證整個系統串接後的使用者流程。

### 3.2 技術選型

| 元件         | 選擇                   | 理由                                                                     |
| ------------ | ---------------------- | ------------------------------------------------------------------------ |
| 瀏覽器自動化 | **Playwright**         | 內建 video recording、`webServer` 自動管理 dev server、headless 也能錄影 |
| 影片合成     | **ffmpeg**（系統 CLI） | 業界標準；WebM→MP4 轉檔、字幕燒入、片段串接；E2E 測試本身不依賴它        |
| 腳本執行     | **tsx**                | 直接執行 TypeScript，無需額外編譯步驟                                    |

### 3.3 影片策略

- **字幕 only**，無語音旁白
- **字幕來源**：test 名稱（中文場景描述）自動轉為字幕
- **場景範圍**：Happy path 優先，每模組 4-8 個場景
- **失敗呈現**：若 test 失敗，影片忠實呈現操作過程（`retries: 0`）

---

## 4. 高層設計

### 4.1 目錄結構

E2E 放在**根目錄層級**，因為它同時涉及 client + server：

```
chat-management/
├── e2e/                              # E2E 測試（跨 client + server）
│   ├── package.json                  # Playwright + tsx 依賴
│   ├── tsconfig.json
│   ├── playwright.config.ts          # Playwright 設定（含 webServer、video）
│   ├── .gitignore                    # 忽略 test-results/, output/
│   ├── helpers/
│   │   ├── shared.ts                 # 共用操作（loginAs, navigateTo, waitForTable...）
│   │   └── db.ts                     # resetDb() — 呼叫 db:seed 重置測試資料
│   ├── tests/                        # E2E 測試（按功能模組排序）
│   │   ├── 01-authentication.spec.ts
│   │   ├── 02-chatroom.spec.ts
│   │   ├── 03-chat-monitoring.spec.ts
│   │   ├── 04-blacklist.spec.ts
│   │   ├── 05-nickname-and-report.spec.ts
│   │   └── 06-operation-logs.spec.ts
│   ├── scripts/
│   │   └── compose-video.ts          # 後處理：test-results → 字幕 → 最終影片
│   ├── test-results/                 # Playwright 自動產出（gitignore）
│   └── output/                       # 最終合成影片（gitignore）
├── client/
├── server/
└── ...
```

### 4.2 系統架構

```
                    ┌──────────────────────────────┐
                    │      Playwright Test Run      │
                    │  headless browser + 自動錄影   │
                    └──────────────┬───────────────┘
                                   │
              ┌────────────────────┼────────────────┐
              ▼                    ▼                 ▼
      test-results/         results.json       playwright-report/
      ├── test-xxx/          (測試名稱+結果)      (HTML 報告)
      │   └── video.webm
      └── ...

                          ┌──────────────────────┐
    test-results/  ──────▶│  compose-video.ts    │
    results.json   ──────▶│  1. 生成 SRT 字幕     │
                          │  2. WebM → MP4        │──▶ output/demo.mp4
                          │  3. 燒入字幕          │
                          │  4. 插入標題卡         │
                          │  5. 串接所有片段       │
                          └──────────────────────┘
```

---

## 5. 詳細設計

### 5.1 Playwright 設定

```typescript
// e2e/playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false, // 循序執行，確保影片片段有正確順序
  retries: 0, // 不重試，忠實呈現 bug
  reporter: [['html'], ['json', { outputFile: 'test-results/results.json' }]],
  use: {
    baseURL: 'http://localhost:5173',
    video: 'on',
    viewport: { width: 1920, height: 1080 },
    launchOptions: { slowMo: 200 }, // 操作放慢，讓影片中動作肉眼可見
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'cd .. && npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 30000,
  },
});
```

| 設定                            | 值      | 說明                                     |
| ------------------------------- | ------- | ---------------------------------------- |
| `fullyParallel`                 | `false` | 循序執行，確保片段可按模組順序串接       |
| `retries`                       | `0`     | 不重試，bug 忠實呈現                     |
| `video`                         | `'on'`  | 每個 test context 自動錄影為 WebM        |
| `slowMo`                        | `200`   | 操作放慢 200ms，影片清晰可讀             |
| `webServer.reuseExistingServer` | `true`  | 若已有 dev server 在跑則複用，不重複啟動 |

### 5.2 共用 helpers

#### `e2e/helpers/shared.ts`

| 函式                                          | 說明                                                       |
| --------------------------------------------- | ---------------------------------------------------------- |
| `loginAs(page, username, password)`           | 導航至 `/login`，填入帳號密碼，點擊「登入」，等待 redirect |
| `navigateTo(page, menuLabel)`                 | 點擊 AdminLayout sidebar 中的 menu item                    |
| `waitForTable(page)`                          | 等待 Antd Table loading spinner 消失 + 資料列出現          |
| `selectOption(page, placeholder, optionText)` | 點開 Antd Select 下拉，選取指定選項                        |
| `confirmModal(page, okText)`                  | 等待 Antd Modal 出現，點擊確認按鈕                         |
| `expectMessage(page, text)`                   | 等待 Antd message 提示出現（操作成功/失敗）                |

**Selector 原則**：優先使用 `getByRole`、`getByPlaceholder`、`getByText`，避免依賴不穩定的 CSS class。

#### `e2e/helpers/db.ts`

```typescript
import { execSync } from 'child_process';
import path from 'path';

const ROOT_DIR = path.resolve(__dirname, '../..');

export function resetDb(): void {
  execSync('npm run db:migrate && npm run db:seed', {
    cwd: ROOT_DIR,
    stdio: 'pipe',
  });
}
```

### 5.3 E2E 測試規格

各 spec 共用結構：

```typescript
test.describe('模組名稱', () => {
  test.beforeAll(() => {
    resetDb();
  });

  test('中文場景描述（成為影片字幕）', async ({ page }) => {
    // Given / When / Then
  });
});
```

#### 01-authentication.spec.ts（6 tests）

| test 名稱                  | 操作                            | 斷言                           |
| -------------------------- | ------------------------------- | ------------------------------ |
| 登入頁面正確顯示           | 訪問 `/login`                   | 看到標題、帳號/密碼欄位        |
| 使用正確帳密登入成功       | 填入 admin01 / 123456，點擊登入 | 導向 `/chat`，Sidebar 出現     |
| 高級管理員可見所有選單項目 | 以 senior_manager 登入          | Sidebar 顯示 8 個選單          |
| 一般管理員選單項目受限     | 以 general_manager 登入         | 不顯示「系統廣播」「帳號管理」 |
| 錯誤帳密顯示錯誤訊息       | 填入錯誤密碼                    | 顯示錯誤提示                   |
| 登出後導回登入頁           | 點擊「登出」                    | 導向 `/login`                  |

#### 02-chatroom.spec.ts（3 tests）

| test 名稱                | 操作              | 斷言                                  |
| ------------------------ | ----------------- | ------------------------------------- |
| 聊天室列表顯示所有聊天室 | 導航至「聊天室」  | 表格有資料，顯示 ID / 名稱 / 線上人數 |
| 搜尋聊天室名稱篩選結果   | 輸入關鍵字 → 查詢 | 只顯示符合結果                        |
| 重置篩選條件清空表單     | 點擊「重置」      | 輸入框清空，顯示全部資料              |

#### 03-chat-monitoring.spec.ts（6 tests）

| test 名稱                       | 操作                     | 斷言                             |
| ------------------------------- | ------------------------ | -------------------------------- |
| 訊息列表載入並顯示最新訊息      | 導航至「聊天監控」       | 表格有資料                       |
| 依玩家帳號篩選訊息              | 輸入 "player001" → 查詢  | 只顯示 player001 的訊息          |
| 依聊天室篩選訊息                | 選取聊天室 → 查詢        | 只顯示該聊天室訊息               |
| 刪除訊息後顯示成功提示          | 點擊「刪除」→ 確認 Modal | 顯示「訊息已刪除」，表格移除該筆 |
| 封鎖玩家 Modal 正確帶入玩家帳號 | 點擊「封鎖」             | Modal 開啟，欄位已填入玩家帳號   |
| 重置篩選條件清空表單            | 多欄篩選後點擊重置       | 所有篩選欄位清空                 |

#### 04-blacklist.spec.ts（6 tests）

| test 名稱                    | 操作                                | 斷言                           |
| ---------------------------- | ----------------------------------- | ------------------------------ |
| 玩家黑名單預設顯示封鎖中記錄 | 導航至「黑名單管理」                | 預設 Player 類型、封鎖中狀態   |
| 新增玩家封鎖成功             | 點擊「新增封鎖」→ 填表 → 確認       | 顯示「封鎖成功」，表格新增一筆 |
| 解封玩家成功                 | 點擊「解封」→ 確認                  | 顯示「解封成功」               |
| 切換至 IP 封鎖類型           | 切換類型為 IP                       | 表格切換顯示 IP 封鎖記錄       |
| 新增 IP 封鎖成功             | 切換 IP → 新增封鎖 → 填入 IP → 確認 | 顯示「封鎖成功」               |
| 依封鎖原因篩選記錄           | 選取原因 → 查詢                     | 只顯示該原因的記錄             |

### 5.4 測試資料狀態管理

```
[resetDb] → 01-authentication
[resetDb] → 02-chatroom（唯讀）
[resetDb] → 03-chat-monitoring（含刪除、封鎖操作）
[resetDb] → 04-blacklist（含新增、解封操作）
```

### 5.5 影片合成腳本

`e2e/scripts/compose-video.ts` 輸入/輸出：

**輸入**：

- `test-results/*/video.webm` — Playwright 錄影片段
- `test-results/results.json` — Playwright JSON reporter 輸出

**處理步驟**：

1. 讀取 `results.json`，取出每個 test 的 `titlePath`（`['模組名', '場景名']`）、`status`、對應 `.webm` 路徑
2. 為每個功能模組生成 **2 秒黑底白字標題卡**（ffmpeg `drawtext` filter）
3. 為每個 test WebM 片段：轉 MP4 + 燒入 SRT 字幕（test 名稱 + ✅/❌ 狀態）
4. 用 `ffmpeg -f concat` 串接所有片段（標題卡 → test 影片）
5. 輸出 `output/demo.mp4`

### 5.6 Dev Scripts（根層 package.json）

| Script                    | 指令                                                                | 說明                           |
| ------------------------- | ------------------------------------------------------------------- | ------------------------------ |
| `npm run test:e2e`        | `cd e2e && npx playwright test`                                     | headless，自動錄影             |
| `npm run test:e2e:headed` | `cd e2e && npx playwright test --headed`                            | 可視模式                       |
| `npm run demo`            | `cd e2e && npx playwright test && npx tsx scripts/compose-video.ts` | 測試 + 合成影片                |
| `npm run demo:compose`    | `cd e2e && npx tsx scripts/compose-video.ts`                        | 只合成（已有 test-results 時） |

---

## 6. 測試計畫

E2E 測試本身即為驗收測試。驗證標準：

- `npm run test:e2e` 全部通過
- `test-results/` 每個 test 目錄下有 `video.webm`
- `test-results/results.json` 包含完整 test 名稱與結果
- `npm run demo` 產出 `output/demo.mp4`（含字幕、標題卡）

---

## 7. 風險與緩解

| 風險                     | 影響                    | 緩解方式                                                              |
| ------------------------ | ----------------------- | --------------------------------------------------------------------- |
| Antd DOM selector 不穩定 | test 找不到元素而失敗   | 優先用 `getByRole`、`getByPlaceholder`、`getByText`；不依賴 CSS class |
| Dev server 啟動慢        | webServer 超時          | `webServer.reuseExistingServer: true`；timeout 可調整                 |
| 測試間資料污染           | 前 spec 操作影響後 spec | 每個 spec `beforeAll` 呼叫 `resetDb()`                                |
| ffmpeg 未安裝            | 無法合成影片            | compose-video 啟動時檢查並提示安裝；E2E 測試不依賴 ffmpeg             |
| slowMo 讓 CI 太慢        | CI 執行時間膨脹         | 以環境變數控制：`CI=true` 時 slowMo=0、video=off                      |

---

## 8. 完成標準

- [ ] `e2e/` 目錄結構建立完成
- [ ] `e2e/package.json` 安裝 Playwright + tsx
- [ ] `e2e/playwright.config.ts` 正確設定 webServer / video / reporter
- [ ] `e2e/helpers/shared.ts` 共用操作函式可正常運作
- [ ] `e2e/helpers/db.ts` resetDb() 可重置測試資料
- [ ] 4 個 spec 檔案，共 21 個 E2E test cases
- [ ] `npm run test:e2e` 全部通過
- [ ] 每個 test 在 `test-results/` 產出 `video.webm`
- [ ] `npm run demo` 產出 `output/demo.mp4`（含字幕 + 標題卡）
- [ ] `rfc_00` §6.1 E2E 欄更新為 Playwright（移除「不做」）
- [ ] `CLAUDE.md` Document Routing 加入本 RFC + tasks
