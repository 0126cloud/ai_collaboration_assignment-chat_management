# RFC: Production Mode 與本地部署

## 1. 背景

目前專案僅支援 development mode（`npm run dev` 透過 concurrently 同時啟動 Vite dev server 與 Express），存在以下問題：

- **無 production 啟動方式**：無法以單一 process 同時提供前端頁面與 API
- **無容器化方案**：無法透過 Docker 一鍵啟動
- **無首次 clone 指南**：新成員不知道如何在本機跑起專案
- **環境變數管理**：僅有單一 `.env` 檔案，無法區分開發與正式環境配置

### 非目標

- CI/CD pipeline 設計
- 雲端部署架構（AWS / GCP 等）
- 自動化部署流程

---

## 2. 目標

1. 支援 production mode — Express 編譯後直接 serve 前端 static files，單一 port 運行
2. Docker 容器化 — `docker compose up` 一鍵啟動
3. 根目錄 README.md — 完整的首次 clone 與運行指南
4. 分環境 .env — `.env.development` / `.env.production` 分離配置

---

## 3. 提案

- 沿用現有 Express + Vite 架構，不引入額外 web server（如 nginx）
- Production 模式下由 Express 直接 serve `client/dist` 靜態檔案
- 使用 `tsc-alias` 解決 TypeScript path alias 在編譯後無法解析的問題
- Docker 採用多階段 build，最小化 runtime image 體積

---

## 4. 詳細設計

### 4.1 分環境 .env 檔案架構

取代現有的單一 `server/.env`，改為依環境區分：

| 檔案                      | 用途             | Git 追蹤 |
| ------------------------- | ---------------- | -------- |
| `server/.env.example`     | 範本與說明文件   | ✅       |
| `server/.env.development` | 開發環境配置     | ❌       |
| `server/.env.production`  | 正式環境配置     | ❌       |

**dotenv 載入邏輯**（`server/src/app.ts`）：

```ts
import path from 'path';
dotenv.config({
  path: path.resolve(__dirname, `../.env.${process.env.NODE_ENV || 'development'}`),
});
```

> `NODE_ENV` 需在 dotenv 載入前由 shell 環境或 Docker ENV 提供。

`server/knexfile.ts` 須同步更新載入邏輯，確保 `npm run db:migrate` 等 CLI 指令也能讀取正確的環境變數。

### 4.2 DB_FILENAME 環境變數

新增 `DB_FILENAME` 環境變數，讓資料庫路徑可配置：

- **`server/src/config/database.ts`**：`filename` 改讀 `process.env.DB_FILENAME`，fallback 為 `path.resolve(__dirname, '../../db/dev.sqlite')`
- **`server/knexfile.ts`**：同步改讀 `process.env.DB_FILENAME || './db/dev.sqlite'`
- **`.env.example`**：新增 `# DB_FILENAME=./db/dev.sqlite`（註解，說明用途）

### 4.3 tsc-alias — 解決 path alias 編譯問題

`tsc` 編譯時不會將 `@shared/*` path alias 改寫為相對路徑，導致 `node dist/server.js` 無法解析模組。

**解法**：安裝 `tsc-alias` 為 server devDependency，更新 build script：

```json
{
  "build": "tsc && tsc-alias"
}
```

`tsc-alias` 讀取 `tsconfig.json` 的 `paths` 設定，將編譯後的 JS 中 `@shared/...` 改寫為正確的相對路徑。

> **風險**：需驗證 `tsc-alias` 能正確處理 `rootDirs` 設定。若有問題，備選方案為使用 `module-alias` 做 runtime path 解析。

### 4.4 Production 靜態檔案 serving

Development 模式下，前端由 Vite dev server（port 5173）提供，Vite proxy 將 `/api` 轉發至 Express（port 3000）。

Production 模式下不啟動 Vite，改由 Express 直接 serve 前端 build 產物：

```ts
// 位置：所有 /api/* 路由之後、404 handler 之前
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.resolve(__dirname, '../../client/dist');
  app.use(express.static(clientDist));

  // SPA fallback：非 API 路由一律回 index.html，交由 React Router 處理
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}
```

**路由優先順序**：API 路由在前，static + fallback 在後，確保 `/api/*` 請求不會被 fallback 攔截。

### 4.5 Root scripts

更新 `package.json`，拆分子命令：

```json
{
  "build": "npm run build:client && npm run build:server",
  "build:client": "cd client && npm run build",
  "build:server": "cd server && npm run build",
  "start": "cd server && npm run start",
  "setup": "npm install && cd client && npm install && cd ../server && npm install"
}
```

| Script          | 說明                                     |
| --------------- | ---------------------------------------- |
| `npm run setup` | 一次安裝 root + client + server 依賴     |
| `npm run build` | 依序 build 前端（Vite）與後端（tsc）     |
| `npm start`     | 啟動 production server（serve 前端+API） |

### 4.6 Docker 多階段 build

**Dockerfile**：

- **Stage 1（builder）**：`node:20-alpine`，安裝所有依賴，build client + server
- **Stage 2（runtime）**：`node:20-alpine`，僅安裝 server production deps + `ts-node`/`typescript`（Knex migration 為 .ts 檔，需要 ts-node 執行），複製 build 產物

**ENV defaults**：

| 變數             | 預設值                              | 說明                                     |
| ---------------- | ----------------------------------- | ---------------------------------------- |
| `NODE_ENV`       | `production`                        | 執行環境                                 |
| `SERVER_ADDRESS` | `0.0.0.0`                           | Docker 內必須 bind 0.0.0.0 才能對外開放  |
| `SERVER_PORT`    | `3000`                              | 伺服器 port                              |
| `DB_FILENAME`    | `/app/data/chat-management.sqlite`  | 資料庫檔案路徑（映射至 Docker volume）   |

**CMD**：先執行 migration 再啟動 server：`sh -c "cd server && npx knex migrate:latest && node dist/server.js"`

**docker-compose.yml**：

```yaml
services:
  app:
    build: .
    ports:
      - '3000:3000'
    volumes:
      - chat-data:/app/data
    environment:
      - NODE_ENV=production
      - SERVER_ADDRESS=0.0.0.0
      - SERVER_PORT=3000
      - JWT_SECRET=${JWT_SECRET:-please-change-this-secret}
      - DB_FILENAME=/app/data/chat-management.sqlite
    restart: unless-stopped

volumes:
  chat-data:
```

> Docker 內不讀 .env 檔案，環境變數由 docker-compose `environment` 提供。`JWT_SECRET` 從 host 環境讀取，帶有提醒性 fallback。

### 4.7 README.md 結構

根目錄新建 `README.md`，包含：

1. **專案簡介** — 聊天管理後台系統
2. **Tech Stack** — React / Express / SQLite / Ant Design
3. **Prerequisites** — Node.js >= 20, npm, (optional) Docker
4. **Quick Start** — clone → setup → cp .env.example → migrate → seed → dev
5. **Production** — build → 設定 .env.production → start
6. **Docker** — docker compose up + 首次 seed
7. **環境變數表** — 所有 env vars 與預設值
8. **Project Structure** — 目錄結構概覽
9. **Available Scripts** — 常用指令速查
10. **預設帳號** — admin01/123456, admin02/123456

---

## 5. 影響範圍

| 檔案                              | 變動類型 | 說明                                   |
| --------------------------------- | -------- | -------------------------------------- |
| `server/src/app.ts`               | 修改     | dotenv 載入邏輯 + production static    |
| `server/src/config/database.ts`   | 修改     | DB_FILENAME env var                    |
| `server/knexfile.ts`              | 修改     | dotenv 載入 + DB_FILENAME              |
| `server/package.json`             | 修改     | tsc-alias + build script              |
| `package.json`                    | 修改     | root scripts                           |
| `.gitignore`                      | 修改     | 新增 .env.development / .env.production|
| `server/.env.example`             | 修改     | 新增 DB_FILENAME                       |
| `server/.env.development`         | 新增     | 開發環境配置                           |
| `server/.env.production`          | 新增     | 正式環境配置                           |
| `server/.env`                     | 刪除     | 由 .env.development 取代              |
| `Dockerfile`                      | 新增     | 多階段 Docker build                    |
| `docker-compose.yml`              | 新增     | Docker Compose 配置                    |
| `.dockerignore`                   | 新增     | Docker build 排除清單                  |
| `README.md`                       | 新增     | 首次 clone 指南                        |

---

## 6. 完成標準

- [ ] `npm run dev` 開發模式正常運作（不受影響）
- [ ] `npm run build` 成功 build 前後端
- [ ] `NODE_ENV=production npm start` 可在 localhost:3000 瀏覽前端並存取 API
- [ ] `docker compose up --build` 成功啟動，localhost:3000 可用
- [ ] `.env.development` / `.env.production` 已 gitignored
- [ ] `README.md` 步驟可從零跑通
- [ ] `npm test` 全部通過
