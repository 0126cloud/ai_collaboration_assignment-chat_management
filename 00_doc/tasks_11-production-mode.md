# Phase 11：Production Mode 與本地部署

## 背景

- RFC：[rfc_11-production-mode.md](rfc_11-production-mode.md)
- 相關 RFC：[rfc_10-system-config.md](rfc_10-system-config.md)（環境變數架構延伸）

目前專案僅支援 development mode，缺乏 production 啟動方式、Docker 容器化、以及首次 clone 指南。本 Phase 補齊這三項，並將環境變數管理改為分環境架構。

## 前置條件

- Phase 10 已完成（✅）

---

## Task 11.1：分環境 .env 架構

**目標**：將單一 `server/.env` 改為 `.env.development` / `.env.production` 分環境管理。

**變動檔案**：

- 修改 `server/src/app.ts`（dotenv 載入邏輯）
- 修改 `server/knexfile.ts`（dotenv 載入邏輯）
- 修改 `server/src/config/database.ts`（DB_FILENAME env var）
- 修改 `server/.env.example`（新增 DB_FILENAME、NODE_ENV）
- 新增 `server/.env.development`（從現有 `.env` 搬移）
- 新增 `server/.env.production`（production 預設值）
- 修改 `.gitignore`（新增 .env.development / .env.production）
- 刪除 `server/.env`（由 `.env.development` 取代）

**說明**：

1. `app.ts` 的 `dotenv.config()` 改為依 `NODE_ENV` 載入對應檔案：
   ```ts
   dotenv.config({
     path: path.resolve(__dirname, `../.env.${process.env.NODE_ENV || 'development'}`),
   });
   ```

2. `knexfile.ts` 同步更新 dotenv 載入邏輯，確保 CLI 指令（migrate/seed）也能讀取正確環境

3. `database.ts` 的 `filename` 改讀 `process.env.DB_FILENAME`，fallback 為 `path.resolve(__dirname, '../../db/dev.sqlite')`

4. `.env.production` 範例內容：
   ```dotenv
   NODE_ENV=production
   SERVER_ADDRESS=localhost
   SERVER_PORT=3000
   ENCODING=utf-8
   MAX_CHATTING_RECORD_NUM=200
   JWT_SECRET=please-change-this-secret
   DB_FILENAME=./db/production.sqlite
   ```

### 驗證方式

```bash
# dev mode 仍正常
npm run dev
# 確認 server 啟動時讀取 .env.development

# 設定 NODE_ENV=production 時讀取 .env.production
NODE_ENV=production node -e "require('dotenv').config({path:'server/.env.production'}); console.log(process.env.JWT_SECRET)"
```

---

## Task 11.2：Server build 修正（tsc-alias）

**目標**：解決 `tsc` 編譯後 `@shared/*` path alias 無法解析的問題。

**變動檔案**：

- 修改 `server/package.json`（加 tsc-alias devDep + 更新 build script）

**說明**：

1. 安裝 `tsc-alias` 為 devDependency：`npm install -D tsc-alias`
2. 更新 build script：`"build": "tsc && tsc-alias"`

### 驗證方式

```bash
cd server && npm run build
# 確認 dist/ 中 @shared 路徑已被改寫為相對路徑
grep -r '@shared' dist/ || echo "OK: no @shared references in dist"
```

---

## Task 11.3：Production 靜態檔案 serving

**目標**：Production 模式下 Express 直接 serve 前端 build 產物。

**變動檔案**：

- 修改 `server/src/app.ts`

**說明**：

在所有 `/api/*` 路由之後、404 handler 之前加入：

```ts
// Production: Express 直接 serve 前端靜態檔案（取代 Vite dev server）
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.resolve(__dirname, '../../client/dist');
  app.use(express.static(clientDist));

  // SPA fallback：非 API 路由一律回 index.html，交由 React Router 處理
  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}
```

### 驗證方式

```bash
npm run build
NODE_ENV=production npm start
# 瀏覽 http://localhost:3000 確認前端頁面載入
# 測試 http://localhost:3000/api/health 回傳 { status: 'ok' }
```

---

## Task 11.4：Root scripts 更新

**目標**：新增 production build / start / setup 指令。

**變動檔案**：

- 修改 `package.json`（root）

**說明**：

新增/修改以下 scripts：

```json
{
  "build": "npm run build:client && npm run build:server",
  "build:client": "cd client && npm run build",
  "build:server": "cd server && npm run build",
  "start": "cd server && npm run start",
  "setup": "npm install && cd client && npm install && cd ../server && npm install"
}
```

### 驗證方式

```bash
npm run setup     # 所有依賴安裝成功
npm run build     # client + server 都 build 成功
npm start         # server 啟動（需先設定 NODE_ENV=production）
```

---

## Task 11.5：Docker 容器化

**目標**：`docker compose up` 一鍵啟動 production 環境。

**變動檔案**：

- 新增 `.dockerignore`
- 新增 `Dockerfile`
- 新增 `docker-compose.yml`

**說明**：

1. `.dockerignore`：排除 node_modules、dist、*.sqlite、.env*（保留 .env.example）、.git、文件目錄、e2e

2. `Dockerfile`（多階段 build）：
   - Stage 1（builder）：node:20-alpine，安裝所有依賴，build client + server
   - Stage 2（runtime）：node:20-alpine，僅安裝 server production deps + ts-node/typescript（Knex migration 需要）
   - ENV defaults：NODE_ENV=production, SERVER_ADDRESS=0.0.0.0, SERVER_PORT=3000, DB_FILENAME=/app/data/chat-management.sqlite
   - CMD：先跑 migration 再啟動 server

3. `docker-compose.yml`：
   - 映射 port 3000
   - `chat-data` named volume 持久化 SQLite
   - JWT_SECRET 從 host 環境讀取

### 驗證方式

```bash
JWT_SECRET=test-secret docker compose up --build -d
# 等待啟動後
docker compose exec app sh -c "cd server && npx knex seed:run"
# 瀏覽 http://localhost:3000 確認可登入
docker compose down
```

---

## Task 11.6：根目錄 README.md

**目標**：建立完整的首次 clone 指南。

**變動檔案**：

- 新增 `README.md`（根目錄）

**說明**：

包含以下章節：
1. 專案簡介
2. Tech Stack
3. Prerequisites（Node.js >= 20, npm, Docker optional）
4. Quick Start（clone → setup → env → migrate → seed → dev）
5. Production（build → env.production → start）
6. Docker（docker compose up + seed）
7. 環境變數表
8. Project Structure
9. Available Scripts
10. 預設帳號（admin01/123456, admin02/123456）

### 驗證方式

依照 README 步驟從零操作一遍，確認每個步驟都能正確執行。

---

## Task 11.7：更新 CLAUDE.md + Prettier 格式化

**目標**：文件路由更新，所有改動檔案符合 Prettier 格式。

**變動檔案**：

- 修改 `CLAUDE.md`（Document Routing 新增 rfc_11）
- 所有改動檔案執行 prettier format

**說明**：

1. `CLAUDE.md` Document Routing 新增：
   ```
   | Production 模式設計 | `00_doc/rfc_11-production-mode.md` |
   ```

2. 執行 prettier format：
   ```bash
   npx prettier --write \
     server/src/app.ts \
     server/src/config/database.ts \
     server/knexfile.ts \
     server/package.json \
     package.json \
     CLAUDE.md
   ```

### 驗證方式

```bash
npm test        # 全部測試通過
npm run lint    # 無 lint 錯誤
```

---

## 執行順序

```
11.1 (env 架構) → 11.2 (tsc-alias) → 11.3 (static serving) → 11.4 (root scripts) → 11.5 (Docker) → 11.6 (README) → 11.7 (文件 + format)
```

---

## 完成檢查清單

- [ ] `npm run dev` 開發模式正常運作
- [ ] `npm run build` 成功 build 前後端
- [ ] `NODE_ENV=production npm start` 可在 localhost:3000 瀏覽前端並存取 API
- [ ] `docker compose up --build` 成功啟動
- [ ] `.env.development` / `.env.production` 已 gitignored
- [ ] `README.md` 步驟可從零跑通
- [ ] `npm test` 全部通過
- [ ] 所有改動檔案已 prettier format
