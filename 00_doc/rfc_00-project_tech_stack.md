# RFC: 專案初始化

## 1. 背景

根據 [PRD](00_doc/prd_00-chat_management_backstage.md)，需建立一個聊天管理後台系統，涵蓋 9 個功能模組、2 種管理員角色。本 RFC 定義「從零到可以開始寫功能模組」之間的所有技術決策與基礎設施建設。

**範圍界定**：本 RFC 僅涵蓋專案初始化，不含 Auth、個別模組 API 或個別資料表 Schema（這些將在各模組的 RFC 中定義）。

---

## 2. 目標

- 建立可運行的前後端開發環境
- 確立專案目錄結構
- 建立 DB migration / seed 基礎設施
- 建立前端 Design System 基礎（Antd 5.x Theme Token）
- 建立 Dev Scripts（一鍵啟動前後端）

---

## 3. 提案

### 3.1 Tech Stack 選型

| Layer         | Technology              | 版本              | 理由                                  |
| ------------- | ----------------------- | ----------------- | ------------------------------------- |
| Language      | TypeScript              | 5.x               | 前後端統一語言，型別安全              |
| Frontend      | React + Vite            | React 18 / Vite 5 | 快速開發、HMR、生態豐富               |
| UI Library    | Ant Design + antd-style | 6.x / 4.x         | 專為後台管理設計，內建表格/表單/Modal |
| HTTP Client   | Axios                   | 1.x               | 搭配 JWT interceptor                  |
| Routing       | React Router            | v6                | 支援 protected routes、nested layout  |
| Backend       | Express.js              | 4.x               | 輕量、快速原型開發                    |
| Database      | SQLite + better-sqlite3 | —                 | 零配置，Demo 系統理想選擇             |
| Query Builder | Knex.js                 | 3.x               | 管理 migrations/seeds，未來可切換 DB  |
| Auth          | jsonwebtoken + bcryptjs | —                 | JWT + 密碼雜湊                        |
| Dev Tools     | nodemon + concurrently  | —                 | 熱重載、同時啟動前後端                |

### 3.2 開發環境配置

- **Node.js**：>= 18 LTS
- **Package Manager**：npm
- **ESLint**：`@typescript-eslint/parser` + `eslint-plugin-react-hooks`
- **Prettier**：統一程式碼風格（semi, singleQuote, printWidth 等）
- **.gitignore**：排除 `node_modules/`、`.env`、`*.sqlite`、`dist/`

---

## 4. 高層設計

### 4.1 專案目錄結構

```
chat-management/
├── package.json                    # 根層 — concurrently 啟動 client + server
├── .eslintrc.cjs                   # ESLint 配置
├── .prettierrc                     # Prettier 配置
├── .gitignore
├── doc/                            # 設計文件
├── client/                         # React + Vite 前端
│   ├── package.json
│   ├── vite.config.ts              # Vite 配置（含 proxy）
│   ├── index.html
│   ├── .env                        # 前端環境變數
│   └── src/
│       ├── main.tsx                # 進入點
│       ├── App.tsx                 # ConfigProvider + AuthProvider + RouterProvider
│       ├── api/                    # Axios 實例 + API 封裝
│       ├── context/                # React Context（Auth, Theme）
│       ├── layouts/                # AdminLayout（Sidebar + Header + Content）
│       ├── pages/                  # 各功能頁面
│       ├── components/             # 共用元件
│       └── theme/                  # Antd Design Token + Theme 切換
│           ├── index.ts            # 主出口 — getTheme(mode) 函式
│           ├── tokens/
│           │   ├── colors.ts       # iOS 風格 Seed Tokens（light + dark overrides）
│           │   ├── typography.ts   # 字體、字級
│           │   ├── spacing.ts      # 圓角、間距、控件高度
│           │   └── index.ts
│           ├── components/
│           │   ├── button.ts       # Button component tokens
│           │   ├── table.ts        # Table component tokens
│           │   ├── form.ts         # Form/Input component tokens
│           │   ├── layout.ts       # Layout/Menu/Sider component tokens
│           │   ├── card.ts         # Card component tokens（iOS shadow）
│           │   ├── modal.ts        # Modal component tokens（iOS shadow）
│           │   └── index.ts
│           └── context/
│               └── ThemeContext.tsx # Dark/Light/System 三態切換 + useTheme hook
└── server/                         # Express 後端
    ├── package.json
    ├── .env                        # serverAddress, serverPort, encoding, maxChattingRecordNum
    ├── knexfile.ts                 # Knex 配置
    ├── src/
    │   ├── app.ts                  # Express app（middleware、路由掛載、error handler）
    │   └── server.ts               # HTTP server 啟動
    ├── db/
    │   ├── migrations/             # Knex migration 檔案
    │   └── seeds/                  # Mock data seed 檔案
    ├── middleware/                  # auth, permission, operationLogger
    └── module/                     # 模組化路由
        └── {moduleName}/
            ├── controller.ts
            ├── service.ts
            └── route.ts
```

### 4.2 Monorepo 結構

採用 client / server 分離的簡易 monorepo，透過根層 `concurrently` 統一管理：

| 層級    | package.json 職責                                             |
| ------- | ------------------------------------------------------------- |
| 根層    | `concurrently` 啟動 client + server、共用 lint/format scripts |
| client/ | React + Vite + Antd 相關依賴                                  |
| server/ | Express + SQLite + Knex 相關依賴                              |

---

## 5. 詳細設計

### 5.1 後端基礎設施

**Express App 骨架**（`server/src/app.ts`）：

```
express()
  ├── express.json()               # body parser
  ├── cors()                       # CORS 設定
  ├── 路由掛載區                    # /api/* routes（Phase 2+ 逐步掛載）
  ├── GET /api/health              # health check
  └── error handler middleware     # 統一錯誤處理，回傳 { error, message }
```

**環境變數**（`server/.env`）：

```
SERVER_ADDRESS=localhost
SERVER_PORT=3000
ENCODING=utf-8
MAX_CHATTING_RECORD_NUM=200
JWT_SECRET=dev-secret-key
```

**啟動分離**：`app.ts` 負責 Express 設定、`server.ts` 負責監聽 port，方便測試時直接 import app。

### 5.2 資料庫基礎設施

**Knex 配置**（`server/knexfile.ts`）：

```ts
export default {
  client: 'better-sqlite3',
  connection: { filename: './db/dev.sqlite' },
  useNullAsDefault: true,
  migrations: { directory: './db/migrations' },
  seeds: { directory: './db/seeds' },
};
```

**Migration 機制**：

- 檔案命名慣例：`YYYYMMDDHHMMSS_create_tablename.ts`
- 每個 migration 包含 `up()` 和 `down()`
- 此階段僅建立 migration 基礎設施，個別 table 的 migration 在各模組開發時建立

**Seed 機制**：

- Seeds 以數字前綴控制執行順序：`01_admins.ts`、`02_chatrooms.ts`...
- `npm run db:seed` 重新填入所有 Mock Data

### 5.3 前端基礎設施

**Vite 配置**（`client/vite.config.ts`）：

```ts
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000', // 代理到後端
    },
  },
});
```

**Antd Theme Token 架構**：

採用三層 Token 架構：

| 層級             | 說明                                      | 範例                      |
| ---------------- | ----------------------------------------- | ------------------------- |
| Seed Tokens      | ~20 個核心值，Antd 演算法自動推導整套色彩 | `colorPrimary: '#1A6FD4'` |
| Map Tokens       | ~100 個自動衍生值，通常不需覆寫           | `colorPrimaryBg`（自動）  |
| Component Tokens | 針對個別元件微調                          | `Card.boxShadow`          |

**Dark / Light Mode 切換**：

- 使用 Antd 內建的 `defaultAlgorithm`（Light）/ `darkAlgorithm`（Dark）切換主題
- `ThemeContext` 管理三態模式：`light` / `dark` / `system`（預設跟隨系統）
- Seed tokens 定義一套 iOS 風格色彩（Light），Dark mode 由 algorithm 自動推導，僅少量覆寫
- 詳見 [rfc_07-design-system.md](rfc_07-design-system.md)

**theme/ 目錄結構**：

- `tokens/colors.ts` — iOS 風格 Seed Tokens（lightSeedTokens + darkSeedOverrides）
- `tokens/typography.ts` — 字體、字級
- `tokens/spacing.ts` — 圓角、間距、控件高度
- `components/button.ts`、`table.ts`、`form.ts`、`layout.ts`、`card.ts`、`modal.ts` — 各元件 token
- `context/ThemeContext.tsx` — Dark / Light / System 三態切換 + useTheme hook
- `index.ts` — `getTheme(mode)` 函式，啟用 `cssVar: true`、`hashed: false`

**套用方式**：在 `App.tsx` 以 `ThemeProvider` + `ConfigProvider` 包裹整個應用。

**自訂元件使用 Token 的方式**：

| 方法                                | 適用場景                                            |
| ----------------------------------- | --------------------------------------------------- |
| `antd-style` 的 `createStyles`      | **首選**。所有元件樣式，整合 token，無 inline style |
| `theme.useToken()` hook             | 在 JS 邏輯中讀取 token 值（非樣式用途）             |
| CSS 變數 `var(--ant-color-primary)` | 全域 CSS 或第三方元件覆寫時使用                     |

**關鍵原則**：

- 不硬編碼顏色，一律用 `token.*` 或 CSS 變數
- 禁用 inline style object，一律用 `createStyles` 管理元件樣式
- 不用 `!important` 或全域 CSS 覆蓋
- 全部用 TypeScript，享受型別檢查
- Seed Token 優先，不夠再用 Component Token

**App.tsx 骨架**：

```tsx
<ThemeProvider>
  <AppContent />  {/* 內部呼叫 useTheme() 取得 resolvedMode */}
</ThemeProvider>

// AppContent 內部：
<ConfigProvider theme={getTheme(resolvedMode)}>
  <AuthProvider>
    <RouterProvider router={router} />
  </AuthProvider>
</ConfigProvider>
```

**路由配置骨架**（React Router v6）：

```tsx
const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: <AdminLayout />, // Sidebar + Header + Content
    children: [
      // Phase 2+ 逐步加入各頁面路由
    ],
  },
]);
```

### 5.4 Dev Scripts

| Script               | 指令                                                     | 說明                     |
| -------------------- | -------------------------------------------------------- | ------------------------ |
| `npm run dev`        | `concurrently "npm run dev:client" "npm run dev:server"` | 一鍵啟動前後端           |
| `npm run dev:client` | `cd client && npm run dev`                               | Vite dev server（HMR）   |
| `npm run dev:server` | `cd server && npx nodemon src/server.ts`                 | Express + nodemon 熱重載 |
| `npm run db:migrate` | `cd server && npx knex migrate:latest`                   | 執行所有 migration       |
| `npm run db:seed`    | `cd server && npx knex seed:run`                         | 填入 Mock Data           |
| `npm run lint`       | `eslint . --ext .ts,.tsx`                                | 程式碼檢查               |
| `npm run format`     | `prettier --write .`                                     | 程式碼格式化             |
| `npm run build`      | `cd client && npm run build`                             | 前端 production build    |

---

## 6. 測試基礎設施

本節定義專案層級的測試策略與基礎設施，各模組 RFC 的測試計畫應引用本節。

### 6.1 測試 Tech Stack

| Layer             | Tool                                      | 理由                                                        |
| ----------------- | ----------------------------------------- | ----------------------------------------------------------- |
| Test Runner       | **Vitest**                                | 前端已用 Vite，共享 transform pipeline；支援 workspace 模式 |
| Backend HTTP 測試 | **supertest**                             | Express integration test 標準工具，不需啟動 live server     |
| Frontend 元件測試 | **@testing-library/react** + **jest-dom** | 測試使用者行為而非實作細節，Vitest 原生相容                 |
| Mocking           | **vitest 內建** (`vi.mock`, `vi.fn`)      | 不需額外安裝 sinon                                          |
| E2E               | **Playwright**                            | 測試即展示：CI 品質保障 + demo 影片自動產出（詳見 rfc_08）  |

### 6.2 測試分層策略

| 層級        | 測試目標                     | 工具                                  | 隔離方式              |
| ----------- | ---------------------------- | ------------------------------------- | --------------------- |
| Unit        | middleware 邏輯、config 結構 | Vitest + mock req/res                 | mock 外部依賴         |
| Integration | 完整 API pipeline            | Vitest + supertest + in-memory SQLite | in-memory DB per file |
| Component   | React 元件行為               | Vitest + testing-library + jsdom      | mock API + context    |
| E2E         | 跨頁面完整使用者流程         | Playwright + 真實 DB                  | beforeAll resetDb()   |

**關鍵設計決策：**

- **In-memory SQLite 取代 mock** — better-sqlite3 同步且 in-process，每個 test file 獨立 `:memory:` DB，快速 + 零 cleanup + 不會與真實 SQL 行為偏離
- **Unit test 用 mock req/res，Integration test 用 supertest** — 隔離 middleware 邏輯 vs. 驗證完整 pipeline

### 6.3 Vitest Workspace 配置

採用 Vitest workspace 同時管理 server（node 環境）與 client（jsdom 環境）：

```
chat-management/
├── vitest.workspace.ts          # workspace 定義
├── server/vitest.config.ts      # node 環境
└── client/vitest.config.ts      # jsdom 環境
```

### 6.4 Gherkin-first 開發流程

採用 **Gherkin-first**（先寫驗收規格再 coding）的混合策略：

```
1. PRD 定義 FR
     ↓
2. 撰寫 Gherkin .feature（設計階段，在 coding 之前）
   — 這就是「驗收標準」，不需要等程式碼
     ↓
3. RFC 測試計畫引用 Gherkin + 補充 engineering-level 策略
     ↓
4. Tasks 中測試任務穿插在功能任務之間（不集中放最後）
     ↓
5. 開發：功能 + 測試同步寫
   — Unit test：跟 module 一起寫
   — Integration test：API route 掛好後立刻寫
   — Component test：頁面開發完立刻寫
```

> 不採用嚴格 TDD — Demo 項目 overhead 過高。但 Gherkin-first 強制在寫 code 前想清楚行為，且讓測試有明確的規格可參照。

### 6.5 測試檔案結構慣例

```
server/src/__tests__/
├── helpers/                     # 測試工具（testDb, testApp, testAuth）
├── unit/                        # unit tests
└── integration/                 # integration tests（supertest）

client/src/__tests__/
├── helpers/                     # 測試工具（setup, testProviders）
├── context/                     # context tests
├── components/                  # component tests
├── pages/                       # page tests
└── layouts/                     # layout tests

e2e/                             # E2E 測試（跨 client + server）
├── helpers/                     # 共用操作（shared.ts, db.ts）
├── tests/                       # spec 檔案（01-06 按模組排序）
└── scripts/                     # compose-video.ts（影片合成）
```

### 6.6 Coverage 目標

| 類別       | 目標               |
| ---------- | ------------------ |
| middleware | >= 90%             |
| API routes | >= 85%（核心路徑） |
| React 元件 | >= 80%（互動邏輯） |

### 6.7 Dev Scripts

| Script                    | 指令                                                                | 說明                                     |
| ------------------------- | ------------------------------------------------------------------- | ---------------------------------------- |
| `npm test`                | `vitest run`                                                        | 執行 Unit / Integration / Component 測試 |
| `npm run test:watch`      | `vitest`                                                            | watch 模式                               |
| `npm run test:e2e`        | `cd e2e && npx playwright test`                                     | 執行 E2E 測試（headless）                |
| `npm run test:e2e:headed` | `cd e2e && npx playwright test --headed`                            | E2E 可視模式                             |
| `npm run demo`            | `cd e2e && npx playwright test && npx tsx scripts/compose-video.ts` | 測試 + 合成 demo 影片                    |

---

## 7. 風險與緩解

| 風險                            | 影響                         | 緩解方式                                                         |
| ------------------------------- | ---------------------------- | ---------------------------------------------------------------- |
| SQLite 不支援並發寫入           | 多用戶同時操作時可能鎖表     | Demo 環境為單用戶場景，足夠使用。Knex 抽象層讓日後切換 DB 成本低 |
| better-sqlite3 為 native module | 安裝時需要 node-gyp 編譯環境 | 確保開發機有 C++ 編譯工具（macOS: Xcode CLI Tools）              |
| 前後端分 port                   | 開發時需處理 CORS / proxy    | Vite proxy 設定解決開發環境跨域問題                              |

---

## 8. 完成標準

- [ ] `npm run dev` 一鍵啟動前後端
- [ ] `GET /api/health` 回傳 200 `{ status: 'ok' }`
- [ ] 前端頁面顯示 Ant Design 元件，套用自訂主題色彩
- [ ] `npm run lint` 可執行且通過
- [ ] `npm run db:migrate` 正常執行，SQLite 檔案產生
- [ ] .gitignore 正確排除 node_modules、.env、\*.sqlite
