# Chat Management Backstage

聊天管理後台系統

欲了解專案實作過程可以從 [專案文件總覽入口](https://0126cloud.github.io/ai_collaboration_assignment-chat_management/) 進去，或根據下方列表對照交付項目。

## 交付文件總覽

| 交付項目        | 線上瀏覽                                                                                                            | 本地檔案                                                                                              |
| --------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 系統設計圖      | [線上檢視](https://0126cloud.github.io/ai_collaboration_assignment-chat_management/system-design.html#architecture) | [system-design.html](system-design.html) + [assets/00_system-design.png](assets/00_system-design.png) |
| Database Schema | [線上檢視](https://0126cloud.github.io/ai_collaboration_assignment-chat_management/system-design.html#database)     | [assets/00_chat-managemant-db.png](assets/00_chat-managemant-db.png)                                  |
| 介面截圖        | [線上檢視](https://0126cloud.github.io/ai_collaboration_assignment-chat_management/system-design.html#frontend)     | [assets/02\_\*.png](assets/)                                                                          |
| AI 協作過程     | [線上檢視](https://0126cloud.github.io/ai_collaboration_assignment-chat_management/collaboration-insight.html)      | [assets/demo.mp4](assets/demo.mp4)                                                                    |

## Tech Stack

- **Frontend**: React 18 + Vite + TypeScript + Ant Design 6.x
- **Backend**: Express.js + TypeScript + SQLite (better-sqlite3) + Knex.js
- **Auth**: JWT + bcryptjs
- **Testing**: Vitest + Playwright

## Tech Docs

- 00_doc/\*

## Prerequisites

- Node.js >= 20
- npm
- (Optional) Docker & Docker Compose

## Quick Start (Development)

```bash
git clone <repo-url>
cd chat-management
cp server/.env.example server/.env.development   # 預設值可直接使用
npm run setup:dev                                 # 安裝依賴 + 建立 DB + seed
npm run dev                                       # 啟動開發伺服器
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3000/api

### Default accounts (from seed)

| Username | Password | Role            |
| -------- | -------- | --------------- |
| admin01  | 123456   | senior_manager  |
| admin02  | 123456   | general_manager |

## Production

### 1. Configure production environment

```bash
cp server/.env.example server/.env.production
```

Edit `server/.env.production`:

- `NODE_ENV=production`
- `JWT_SECRET=your-strong-secret` (必須修改為強密鑰)
- `DB_FILENAME=./db/production.sqlite`
- 可移除 `CORS_ORIGIN`（production 模式下前端由同 server 提供，同源不需 CORS）

### 2. Setup and start

```bash
npm run setup:prod    # 安裝依賴 + build + 建立 DB + seed
npm start             # 啟動 production server
```

Server 會在 http://localhost:3000 同時提供前端頁面與 API。

## Docker

### Quick start with Docker Compose

```bash
# 設定 JWT secret
export JWT_SECRET=your-strong-secret

docker compose up -d

# 首次啟動需 seed 初始資料
docker compose exec app sh -c "cd server && npx knex seed:run"
```

App available at http://localhost:3000

### Rebuild after code changes

```bash
docker compose up -d --build
```

### Stop

```bash
docker compose down
```

> SQLite 資料庫儲存在 Docker named volume `chat-data`，`docker compose down` 不會刪除資料。若需清除資料，執行 `docker compose down -v`。

## Environment Variables

| Variable                  | Default                 | Description                           |
| ------------------------- | ----------------------- | ------------------------------------- |
| `NODE_ENV`                | `development`           | 執行環境 (development / production)   |
| `SERVER_ADDRESS`          | `localhost`             | Server bind address                   |
| `SERVER_PORT`             | `3000`                  | Server port                           |
| `JWT_SECRET`              | `dev-secret-key`        | JWT signing key (production 必須修改) |
| `CORS_ORIGIN`             | `http://localhost:5173` | Allowed CORS origin                   |
| `ENCODING`                | `utf-8`                 | Response charset                      |
| `MAX_CHATTING_RECORD_NUM` | `200`                   | Max chat records per query            |
| `DB_FILENAME`             | `./db/dev.sqlite`       | SQLite database file path             |

## Project Structure

```
chat-management/
├── client/          # React frontend (Vite)
│   ├── src/         # Components, pages, API calls
│   └── dist/        # Build output
├── server/          # Express backend
│   ├── src/         # TypeScript source
│   ├── db/          # Migrations & seeds
│   └── dist/        # Compiled output
├── shared/          # Shared types & schemas (Zod)
├── e2e/             # Playwright E2E tests
├── 00_doc/          # Design documents & RFCs
└── 00_finished_tasks/ # Completed task records
```

## Available Scripts

| Script                    | Description                               |
| ------------------------- | ----------------------------------------- |
| `npm run setup:dev`       | 安裝依賴 + dev DB migrate + seed          |
| `npm run setup:prod`      | 安裝依賴 + build + prod DB migrate + seed |
| `npm run dev`             | 啟動開發伺服器 (frontend + backend)       |
| `npm run build`           | Build client + server for production      |
| `npm start`               | 啟動 production server                    |
| `npm run db:setup:dev`    | Dev DB migrate + seed                     |
| `npm run db:setup:prod`   | Prod DB migrate + seed                    |
| `npm run db:migrate:dev`  | Dev DB migrate only                       |
| `npm run db:migrate:prod` | Prod DB migrate only                      |
| `npm test`                | Run all unit/integration tests            |
| `npm run test:e2e`        | Run Playwright E2E tests                  |
| `npm run lint`            | Run ESLint                                |
| `npm run format`          | Run Prettier                              |
