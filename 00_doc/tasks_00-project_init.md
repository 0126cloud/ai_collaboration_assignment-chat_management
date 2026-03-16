# Phase 0: 專案初始化

## 背景

從零建立專案骨架。所有技術決策詳見 [rfc_00-project_tech_stack.md](rfc_00-project_tech_stack.md)。

## 前置條件

- Node.js >= 18 LTS
- npm
- macOS 需有 Xcode Command Line Tools（better-sqlite3 編譯需要）

---

## Task 0.1: 專案骨架與依賴安裝

建立三層 package.json 結構與基本配置檔案。

**建立檔案：**

1. 根層 `package.json`
   - `name`: `chat-management`
   - `scripts`: 預留 `dev`、`dev:client`、`dev:server`、`lint`、`format`
   - `devDependencies`: `concurrently`、`eslint`、`prettier` 及相關 plugin

2. `client/package.json`
   - 使用 `npm create vite@latest` 建立 React + TypeScript 專案
   - 額外安裝：`antd`、`antd-style`、`axios`、`react-router-dom`

3. `server/package.json`
   - `dependencies`: `express`、`cors`、`better-sqlite3`、`knex`、`jsonwebtoken`、`bcryptjs`、`dotenv`
   - `devDependencies`: `typescript`、`ts-node`、`nodemon`、`@types/*`

4. `.gitignore`
   ```
   node_modules/
   dist/
   *.sqlite
   .env
   .env.local
   ```

### 驗證方式

- 根層、client/、server/ 各有 package.json
- 三層目錄 `npm install` 皆無錯誤
- `.gitignore` 存在且內容正確

---

## Task 0.2: ESLint + Prettier 配置

建立統一的程式碼品質工具配置。

**建立檔案：**

1. `.eslintrc.cjs`
   - Parser: `@typescript-eslint/parser`
   - Plugins: `@typescript-eslint`、`react-hooks`
   - Extends: `eslint:recommended`、`plugin:@typescript-eslint/recommended`、`plugin:react-hooks/recommended`
   - 排除 `dist/`、`node_modules/`

2. `.prettierrc`

   ```json
   {
     "semi": true,
     "singleQuote": true,
     "printWidth": 100,
     "trailingComma": "all",
     "tabWidth": 2
   }
   ```

3. 根層 `package.json` scripts：
   - `"lint": "eslint . --ext .ts,.tsx"`
   - `"format": "prettier --write ."`

### 驗證方式

- `npm run lint` 可執行（無語法錯誤）
- `npm run format` 可執行

---

## Task 0.3: 後端 Express 骨架

建立 Express 應用程式基礎架構。

**建立檔案：**

1. `server/src/app.ts`
   - 載入 express、cors、dotenv
   - 掛載 `express.json()` body parser
   - 掛載 cors middleware
   - 掛載 health check：`GET /api/health` → `{ status: 'ok' }`
   - 掛載統一 error handler middleware
   - Export app（不在此啟動 server）

2. `server/src/server.ts`
   - Import app from `./app`
   - 讀取 `SERVER_PORT` from env（預設 3000）
   - `app.listen(port)` 並 log 啟動訊息

3. `server/.env`

   ```
   SERVER_ADDRESS=localhost
   SERVER_PORT=3000
   ENCODING=utf-8
   MAX_CHATTING_RECORD_NUM=200
   JWT_SECRET=dev-secret-key
   ```

4. `server/tsconfig.json`

**設計要點：**

- app.ts 與 server.ts 分離，方便日後測試時直接 import app
- Error handler 統一回傳 `{ error: string, message: string }` 格式

### 驗證方式

- `npm run dev:server` 啟動無錯誤
- `curl http://localhost:3000/api/health` 回傳 `{ "status": "ok" }` (200)

---

## Task 0.4: DB Migration / Seed 基礎設施

建立 Knex 資料庫遷移與 seed 框架。

**建立檔案：**

1. `server/knexfile.ts`

   ```ts
   export default {
     client: 'better-sqlite3',
     connection: { filename: './db/dev.sqlite' },
     useNullAsDefault: true,
     migrations: { directory: './db/migrations' },
     seeds: { directory: './db/seeds' },
   };
   ```

2. `server/db/migrations/` 目錄（空，各模組開發時建立 migration）

3. `server/db/seeds/` 目錄（空，各模組開發時建立 seed）

4. 根層 `package.json` scripts 新增：
   - `"db:migrate": "cd server && npx knex migrate:latest"`
   - `"db:seed": "cd server && npx knex seed:run"`

**命名慣例：**

- Migration：`YYYYMMDDHHMMSS_create_tablename.ts`（含 `up()` 和 `down()`）
- Seed：數字前綴控制順序 `01_admins.ts`、`02_chatrooms.ts`...

### 驗證方式

- `npm run db:migrate` 執行成功（目前無 migration 也不報錯）
- `server/db/` 目錄結構正確
- SQLite 檔案 `server/db/dev.sqlite` 產生

---

## Task 0.5: 前端 Vite + React 骨架

建立前端應用程式基礎架構。

**建立 / 修改檔案：**

1. `client/vite.config.ts`
   - 設定 `server.port: 5173`
   - 設定 proxy：`'/api' → 'http://localhost:3000'`

2. `client/src/main.tsx`
   - ReactDOM.createRoot + StrictMode

3. `client/src/App.tsx`
   - 骨架：`ConfigProvider` 包裹 `RouterProvider`
   - AuthProvider 預留位置（Phase 2 加入）

4. `client/src/router.tsx`（或在 App.tsx 內）
   - `createBrowserRouter` 配置
   - `/login` → LoginPage placeholder
   - `/` → AdminLayout placeholder（含 children 路由）

5. 目錄結構建立（空目錄含 `.gitkeep` 或 placeholder）：
   - `client/src/api/`
   - `client/src/context/`
   - `client/src/layouts/`
   - `client/src/pages/`
   - `client/src/components/`

### 驗證方式

- `npm run dev:client` 啟動無錯誤
- 瀏覽器開啟 `http://localhost:5173` 看到頁面
- API proxy 正常：前端呼叫 `/api/health` 可到達後端

---

## Task 0.6: Antd Theme Token

建立 Ant Design 5.x Design Token 客製化架構。

**建立檔案：**

1. `client/src/theme/tokens/colors.ts`
   - Seed Tokens：`colorPrimary`、`colorSuccess`、`colorWarning`、`colorError`、`colorInfo`

2. `client/src/theme/tokens/typography.ts`
   - 字體、字級設定

3. `client/src/theme/tokens/spacing.ts`
   - 圓角、間距、控件高度

4. `client/src/theme/tokens/index.ts`
   - Re-export 所有 token

5. `client/src/theme/components/button.ts`、`table.ts`、`form.ts`、`layout.ts`
   - 各元件的 Component Tokens

6. `client/src/theme/components/index.ts`
   - Re-export 所有 component theme

7. `client/src/theme/index.ts`
   - 組裝 `ThemeConfig`
   - 啟用 `cssVar: true`、`hashed: false`

8. 更新 `App.tsx`
   - 套用 `<ConfigProvider theme={theme}>`

**設計要點：**

- Seed Token 優先，不夠再用 Component Token
- 不硬編碼顏色，自訂元件一律用 `theme.useToken()` 或 CSS 變數
- 啟用 `cssVar: true` 讓所有 token 同時產生 CSS 變數

### 驗證方式

- Ant Design 元件（如 Button）顯示自訂品牌色彩
- 開發者工具可見 `--ant-color-primary` CSS 變數
- TypeScript 無型別錯誤

---

## Task 0.7: Dev Scripts 整合

確保一鍵啟動與開發體驗順暢。

**更新檔案：**

1. 根層 `package.json` scripts 最終版：

   ```json
   {
     "dev": "concurrently \"npm run dev:client\" \"npm run dev:server\"",
     "dev:client": "cd client && npm run dev",
     "dev:server": "cd server && npx nodemon src/server.ts",
     "db:migrate": "cd server && npx knex migrate:latest",
     "db:seed": "cd server && npx knex seed:run",
     "lint": "eslint . --ext .ts,.tsx",
     "format": "prettier --write .",
     "build": "cd client && npm run build"
   }
   ```

2. 確認 nodemon 配置（可在 `server/nodemon.json` 或 package.json 中）：
   - watch: `src/`、`db/`
   - ext: `ts,json`
   - exec: `ts-node src/server.ts`

### 驗證方式

- `npm run dev` 一鍵啟動前後端
- 修改前端程式碼 → Vite HMR 自動重載
- 修改後端程式碼 → nodemon 自動重啟
- `npm run build` 成功產出 `client/dist/`

---

## 執行順序

```
Task 0.1（骨架與依賴）
  ↓
  ├── Task 0.2（ESLint + Prettier）  ← 可平行
  ├── Task 0.3（後端 Express 骨架）  ← 可平行
  └── Task 0.5（前端 Vite 骨架）     ← 可平行
        ↓                              ↓
      Task 0.6（Antd Theme）       Task 0.4（DB 基礎設施）
        ↓                              ↓
        └──────── Task 0.7（Dev Scripts 整合）────────┘
```

## 完成檢查清單

- [ ] `npm run dev` 一鍵啟動前後端
- [ ] `GET /api/health` 回傳 200
- [ ] 前端顯示 Ant Design 元件且套用自訂主題色彩
- [ ] `npm run lint` 通過
- [ ] `npm run db:migrate` 正常執行
- [ ] SQLite DB 檔案存在
- [ ] `.gitignore` 正確排除 node_modules、.env、\*.sqlite
