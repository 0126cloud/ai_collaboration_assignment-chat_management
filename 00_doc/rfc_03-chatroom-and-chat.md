# RFC: 聊天室管理 + 聊天監控

## 1. 背景

Phase 2（[rfc_02](rfc_02-operation-logs.md)）已完成操作紀錄模組，建立了 afterware 寫入機制與查詢 API。現進入功能模組開發階段。

本 RFC 涵蓋兩個相關模組：

1. **聊天室管理（Chatroom Management）** — 唯讀模組，查看聊天室列表與線上人數
2. **聊天監控（Chat Monitoring）** — 查看、搜尋、刪除聊天訊息，並提供封鎖玩家 / 暱稱重設的前端 UI 佔位

兩個模組合併為一份 RFC，原因：

- 共用 `players` 基礎表（後續黑名單、暱稱審核模組也依賴此表）
- `chat_messages` 關聯 `chatrooms`，有資料依賴
- Migration 與 seed 需一併規劃

**範圍界定**：本 RFC 涵蓋 4 張資料表（chatrooms、players、chatroom_players、chat_messages）、2 組 API、2 個前端頁面。不含封鎖玩家 / 暱稱重設的後端邏輯（留待後續 Phase）。

---

## 2. 目標

- 建立 4 張資料表（含軟刪除設計）
- 建立 `GET /api/chatrooms` API（分頁 + 名稱搜尋）
- 建立 `GET /api/chat_messages` API（多條件篩選 + 分頁）
- 建立 `DELETE /api/chat_messages/:id` API（軟刪除 + 操作紀錄）
- 建立前端 `ChatroomPage`（聊天室列表）
- 建立前端 `ChatMonitoringPage`（訊息監控 + 刪除 + UI 佔位按鈕）
- 建立 `players` 基礎表，為後續模組做準備

---

## 3. 提案

### 3.1 DB Schema 設計

新增 4 張資料表：

| 表名               | 說明                  | PK 型別                          |
| ------------------ | --------------------- | -------------------------------- |
| `chatrooms`        | 聊天室列表            | VARCHAR(50)（如 `baccarat_001`） |
| `players`          | 玩家基礎資料          | VARCHAR(50)（username）          |
| `chatroom_players` | 聊天室—玩家多對多關聯 | INTEGER AUTOINCREMENT            |
| `chat_messages`    | 聊天訊息              | INTEGER AUTOINCREMENT            |

所有表皆採用 string-based 業務 ID（chatrooms、players）或自增整數 ID（chatroom_players、chat_messages）。

### 3.2 軟刪除策略

所有 4 張表皆含 `deleted_at`（DATETIME nullable）欄位：

- `deleted_at IS NULL` 代表有效資料
- `deleted_at IS NOT NULL` 代表已軟刪除
- 所有 GET API 預設加上 `WHERE deleted_at IS NULL` 條件

此策略符合 [prd_00](prd_00-chat_management_backstage.md) NFR-004（聊天訊息刪除採軟刪除策略）。

### 3.3 API URL 設計

| API                             | 權限            | 說明         |
| ------------------------------- | --------------- | ------------ |
| `GET /api/chatrooms`            | `chatroom:read` | 聊天室列表   |
| `GET /api/chat_messages`        | `chat:read`     | 聊天訊息列表 |
| `DELETE /api/chat_messages/:id` | `chat:delete`   | 刪除聊天訊息 |

> 注意：API 路徑採底線連接 `/api/chat_messages`，需同步更新 [rfc_01](rfc_01-auth-and-response.md) §5.9 Route 權限對照表。

### 3.4 封鎖玩家 / 暱稱重設

依 [prd_00](prd_00-chat_management_backstage.md) FR-007（封鎖玩家）、FR-008（重設暱稱），前端 ChatMonitoringPage 需提供操作按鈕。

**Phase 3 範圍**：僅前端 UI 按鈕（disabled 或 placeholder），後端邏輯留待後續 Phase（blacklist / nickname 模組）。

**Phase 4 更新**：封鎖玩家按鈕已啟用（`blacklist:create` 權限，詳見 [rfc_04](rfc_04-blacklist-and-ip-blocking.md)）。

**Phase 9 更新**：暱稱重設按鈕已啟用，詳見下方 § 3.5。

### 3.5 玩家暱稱重設 API（Phase 9）

提供管理員直接從 Chat Monitoring 頁面重設玩家暱稱（還原為帳號名稱），無需進入暱稱審核頁面。

#### PUT `/api/players/:username/nickname/reset`

- **需認證**：`auth` middleware
- **需權限**：`player:reset_nickname`（general_manager 和 senior_manager 皆有）
- **Path Parameter**：`username` — 玩家帳號名稱
- **Response 200**：`{ success: true, data: { message: '暱稱已重設', username: string } }`
- **Error 404**：`PLAYER_NOT_FOUND`（玩家不存在或已刪除）
- **行為**：將 `players.nickname` 設回 `username`，`nickname_review_status` 設為 `null`
- **操作紀錄**：寫入 operation_logs（type: `RESET_NICKNAME`）

**新增檔案**：
- `server/src/module/player/service.ts` — `PlayerService.resetNickname(username)`
- `server/src/module/player/controller.ts` — `PlayerController.resetNickname`
- `server/src/module/player/route.ts` — `createPlayerRoutes(db)` → 掛載於 `/api/players`

---

## 4. 高層設計

### 4.1 新增 / 修改檔案結構

```
chat-management/
├── server/
│   ├── db/
│   │   ├── migrations/
│   │   │   ├── 20260317000002_create_chatrooms.ts          # [新增]
│   │   │   ├── 20260317000003_create_players.ts            # [新增]
│   │   │   ├── 20260317000004_create_chatroom_players.ts   # [新增]
│   │   │   └── 20260317000005_create_chat_messages.ts      # [新增]
│   │   └── seeds/
│   │       ├── 03_chatrooms.ts                             # [新增]
│   │       ├── 04_players.ts                               # [新增]
│   │       ├── 05_chatroom_players.ts                      # [新增]
│   │       └── 06_chat_messages.ts                         # [新增]
│   └── src/
│       ├── app.ts                                          # [修改] 掛載新路由
│       ├── utils/
│       │   └── errorCodes.ts                               # [修改] 新增 error codes
│       └── module/
│           ├── chatroom/
│           │   ├── controller.ts                           # [新增]
│           │   ├── service.ts                              # [新增]
│           │   └── route.ts                                # [新增]
│           └── chatMessage/
│               ├── controller.ts                           # [新增]
│               ├── service.ts                              # [新增]
│               └── route.ts                                # [新增]
├── client/
│   └── src/
│       ├── api/
│       │   ├── chatroom.ts                                 # [新增]
│       │   └── chatMessage.ts                              # [新增]
│       ├── pages/
│       │   ├── ChatroomPage.tsx                            # [新增]
│       │   └── ChatMonitoringPage.tsx                      # [新增]
│       └── router.tsx                                      # [修改] 新增路由
└── shared/
    ├── schemas/
    │   ├── chatroom.ts                                     # [新增]
    │   └── chatMessage.ts                                  # [新增]
    ├── types/
    │   ├── chatroom.ts                                     # [新增]
    │   └── chatMessage.ts                                  # [新增]
    └── index.ts                                            # [修改] re-export
```

---

## 5. 詳細設計

### 5.1 DB Schema — chatrooms 表

**Migration**（`server/db/migrations/20260317000002_create_chatrooms.ts`）：

| 欄位              | 型別                               | 說明                         |
| ----------------- | ---------------------------------- | ---------------------------- |
| id                | VARCHAR(50) PRIMARY KEY            | 業務 ID（如 `baccarat_001`） |
| name              | VARCHAR(100) NOT NULL              | 聊天室名稱                   |
| online_user_count | INTEGER DEFAULT 0                  | 線上人數（Mock 靜態值）      |
| created_at        | DATETIME DEFAULT CURRENT_TIMESTAMP |                              |
| updated_at        | DATETIME DEFAULT CURRENT_TIMESTAMP |                              |
| deleted_at        | DATETIME nullable                  | 軟刪除標記                   |

**索引**：`name`

### 5.2 DB Schema — players 表

**Migration**（`server/db/migrations/20260317000003_create_players.ts`）：

| 欄位              | 型別                               | 說明                 |
| ----------------- | ---------------------------------- | -------------------- |
| username               | VARCHAR(50) PRIMARY KEY            | 玩家帳號（唯一識別）                                          |
| nickname               | VARCHAR(50) NOT NULL               | 目前暱稱                                                      |
| nickname_apply_at      | DATETIME nullable                  | 最後一次申請改暱稱的時間（RFC 05 新增，migration `20260317000008`） |
| nickname_review_status | VARCHAR(20) nullable               | 'pending' \| 'approved' \| 'rejected' \| null                 |
| nickname_reviewed_by   | VARCHAR(50) nullable               | 審核管理員帳號                                                |
| nickname_reviewed_at   | DATETIME nullable                  | 審核時間                                                      |
| created_at             | DATETIME DEFAULT CURRENT_TIMESTAMP |                                                               |
| updated_at             | DATETIME DEFAULT CURRENT_TIMESTAMP |                                                               |
| deleted_at             | DATETIME nullable                  | 軟刪除標記                                                    |

> 此表為多模組共用基礎表，後續黑名單、暱稱審核模組皆依賴 `players.username`。
>
> **`nickname_apply_at` 語意說明**：記錄玩家最後一次申請改暱稱的時間，審核後（approved/rejected）不清除，作為歷史記錄保留。判斷是否有待審請求應以 `nickname_review_status = 'pending'` 為準，而非 `nickname_apply_at IS NOT NULL`。

### 5.3 DB Schema — chatroom_players 表

**Migration**（`server/db/migrations/20260317000004_create_chatroom_players.ts`）：

| 欄位            | 型別                               | 說明                  |
| --------------- | ---------------------------------- | --------------------- |
| id              | INTEGER PRIMARY KEY AUTOINCREMENT  |                       |
| chatroom_id     | VARCHAR(50) NOT NULL               | FK → chatrooms.id     |
| player_username | VARCHAR(50) NOT NULL               | FK → players.username |
| created_at      | DATETIME DEFAULT CURRENT_TIMESTAMP |                       |
| deleted_at      | DATETIME nullable                  | 軟刪除標記            |

**約束**：UNIQUE(`chatroom_id`, `player_username`)

**索引**：`chatroom_id`、`player_username`

### 5.4 DB Schema — chat_messages 表

**Migration**（`server/db/migrations/20260317000005_create_chat_messages.ts`）：

| 欄位            | 型別                               | 說明                                |
| --------------- | ---------------------------------- | ----------------------------------- |
| id              | INTEGER PRIMARY KEY AUTOINCREMENT  |                                     |
| chatroom_id     | VARCHAR(50) NOT NULL               | 所屬聊天室                          |
| player_username | VARCHAR(50) NOT NULL               | 發訊玩家帳號                        |
| ~~player_nickname~~ | ~~VARCHAR(50) NOT NULL~~       | ~~已移除：改為 JOIN players 取得即時暱稱~~ |
| message         | TEXT NOT NULL                      | 訊息內容                            |
| created_at      | DATETIME DEFAULT CURRENT_TIMESTAMP | 發訊時間                            |
| deleted_at      | DATETIME nullable                  | 軟刪除標記（管理員刪除時間）        |

**索引**：`chatroom_id`、`player_username`、`created_at`

> **`player_nickname` 設計變更**：原為快照（snapshot）欄位，已於 Bugfix 中移除。改為查詢時 JOIN `players` 表取得 `players.nickname`，確保重設暱稱後訊息列表即時反映最新暱稱。migration: `20260318000013_remove_player_nickname_from_chat_messages`。

### 5.5 API — GET `/api/chatrooms`

- **需認證**：`auth` middleware
- **需權限**：`chatroom:read`
- **Query Parameters**：

| 參數     | 型別   | 必填 | 說明               | 預設值 |
| -------- | ------ | ---- | ------------------ | ------ |
| name     | string | 否   | 名稱或 ID 模糊搜尋 | —      |
| page     | number | 否   | 頁碼               | 1      |
| pageSize | number | 否   | 每頁筆數           | 30     |

- **篩選邏輯**：
  - `name` 參數同時對 `id` 和 `name` 欄位做 LIKE 搜尋（方便使用者用 ID 或名稱搜尋）
  - 固定加上 `WHERE deleted_at IS NULL`

- **Response 200**：

```json
{
  "success": true,
  "data": [
    {
      "id": "baccarat_001",
      "name": "Baccarat Room 1",
      "online_user_count": 120,
      "created_at": "2026-01-01 00:00:00",
      "updated_at": "2026-01-01 00:00:00"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 30,
    "total": 5,
    "totalPages": 1
  }
}
```

- **Error 401**：`AUTH_MISSING_TOKEN`
- **Error 403**：`FORBIDDEN_INSUFFICIENT_PERMISSIONS`

### 5.6 API — GET `/api/chat_messages`

- **需認證**：`auth` middleware
- **需權限**：`chat:read`
- **Query Parameters**：

| 參數           | 型別   | 必填 | 說明                      | 預設值 |
| -------------- | ------ | ---- | ------------------------- | ------ |
| chatroomId     | string | 否   | 聊天室 ID（精確比對）     | —      |
| playerUsername | string | 否   | 玩家帳號（精確比對）      | —      |
| playerNickname | string | 否   | 玩家暱稱（模糊搜尋）      | —      |
| message        | string | 否   | 訊息內容（模糊搜尋）      | —      |
| startDate      | string | 否   | 起始日期（UTC，ISO 8601） | —      |
| endDate        | string | 否   | 結束日期（UTC，ISO 8601） | —      |
| page           | number | 否   | 頁碼                      | 1      |
| pageSize       | number | 否   | 每頁筆數                  | 30     |

- **篩選邏輯**：
  - `chatroomId` 精確比對 `chatroom_id`
  - `playerUsername` 精確比對 `player_username`
  - `playerNickname` LIKE `%value%` 比對 `player_nickname`
  - `message` LIKE `%value%` 比對 `message`
  - `startDate` / `endDate` 範圍查詢 `created_at`
  - 固定加上 `WHERE deleted_at IS NULL`

- **Response 200**：

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "chatroom_id": "baccarat_001",
      "player_username": "player123",
      "player_nickname": "LuckyBoy",
      "message": "Hello everyone",
      "created_at": "2026-03-15 08:30:00"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 30,
    "total": 100,
    "totalPages": 4
  }
}
```

- **Error 401**：`AUTH_MISSING_TOKEN`
- **Error 403**：`FORBIDDEN_INSUFFICIENT_PERMISSIONS`

### 5.7 API — DELETE `/api/chat_messages/:id`

- **需認證**：`auth` middleware
- **需權限**：`chat:delete`
- **路徑參數**：`id`（INTEGER，訊息 ID）
- **行為**：
  - 軟刪除：`UPDATE chat_messages SET deleted_at = CURRENT_TIMESTAMP WHERE id = :id AND deleted_at IS NULL`
  - 觸發操作紀錄：`res.locals.operationLog = { operationType: 'DELETE_MESSAGE' }`

- **Response 200**：

```json
{
  "success": true,
  "data": {
    "message": "訊息已刪除"
  }
}
```

- **Error 401**：`AUTH_MISSING_TOKEN`
- **Error 403**：`FORBIDDEN_INSUFFICIENT_PERMISSIONS`
- **Error 404**：`CHAT_MESSAGE_NOT_FOUND`（訊息不存在或已刪除）

**新增 Error Code**（`server/src/utils/errorCodes.ts`）：

```ts
CHAT_MESSAGE_NOT_FOUND = 'CHAT_MESSAGE_NOT_FOUND',
// ERROR_MESSAGES:
[ErrorCode.CHAT_MESSAGE_NOT_FOUND]: { statusCode: 404, message: '訊息不存在或已刪除' },
```

### 5.8 後端 Module — chatroom

遵循既有 module 三層架構（route → controller → service）。

**route.ts**（`server/src/module/chatroom/route.ts`）：

```ts
export function createChatroomRoutes(db: Knex): Router {
  const router = Router();
  const service = new ChatroomService(db);
  const controller = new ChatroomController(service);

  router.get('/', auth, requirePermission('chatroom:read'), controller.list);

  return router;
}
```

**service.ts**（`server/src/module/chatroom/service.ts`）：

- `list(query)` — 組裝 Knex 查詢（name/id LIKE + 分頁 + WHERE deleted_at IS NULL）

**controller.ts**（`server/src/module/chatroom/controller.ts`）：

- `list(req, res, next)` — 驗證 query params → 呼叫 service → ResponseHelper.paginated()

### 5.9 後端 Module — chatMessage

**route.ts**（`server/src/module/chatMessage/route.ts`）：

```ts
export function createChatMessageRoutes(db: Knex): Router {
  const router = Router();
  const service = new ChatMessageService(db);
  const controller = new ChatMessageController(service);

  router.get('/', auth, requirePermission('chat:read'), controller.list);
  router.delete('/:id', auth, requirePermission('chat:delete'), controller.remove);

  return router;
}
```

**service.ts**（`server/src/module/chatMessage/service.ts`）：

- `list(query)` — 組裝 Knex 查詢（多條件篩選 + 分頁 + WHERE deleted_at IS NULL + ORDER BY created_at DESC）
- `remove(id)` — 軟刪除，回傳是否成功（找不到或已刪除 → 拋出 AppError）

**controller.ts**（`server/src/module/chatMessage/controller.ts`）：

- `list(req, res, next)` — 驗證 query params → 呼叫 service → ResponseHelper.paginated()
- `remove(req, res, next)` — 呼叫 service.remove() → 設定 `res.locals.operationLog = { operationType: 'DELETE_MESSAGE' }` → ResponseHelper.success()

### 5.10 Seed 資料

#### chatrooms（5 筆）

| id            | name             | online_user_count |
| ------------- | ---------------- | ----------------- |
| baccarat_001  | Baccarat Room 1  | 120               |
| baccarat_002  | Baccarat Room 2  | 85                |
| blackjack_001 | Blackjack Room 1 | 64                |
| roulette_001  | Roulette Room 1  | 45                |
| slots_001     | Slots Room 1     | 200               |

#### players（15~20 筆）

分佈不同暱稱，包含：

- 正常玩家（nickname_review_status IS NULL）— 未申請暱稱審核
- 待審核玩家（nickname_review_status = 'pending'）— 為後續暱稱審核模組做準備

#### chatroom_players

將 15~20 位玩家分配至 5 個聊天室，每個聊天室 5~10 位玩家。

#### chat_messages（50~100 筆）

- 分佈在 5 個聊天室
- 模擬真實遊戲對話（正向內容）
- 時間分佈在近 7 天內
- 包含幾筆 `deleted_at IS NOT NULL` 的已刪除訊息（用於測試軟刪除）

### 5.11 前端 ChatroomPage

**檔案**：`client/src/pages/ChatroomPage.tsx`

**頁面結構**：

```
ChatroomPage
├── 篩選區域（Card）
│   ├── Input — 名稱或 ID 搜尋
│   └── Button — 查詢 / 重置
└── 資料表格（Table）
    ├── Column: 聊天室 ID（id）
    ├── Column: 聊天室名稱（name）
    ├── Column: 線上人數（online_user_count）
    ├── Column: 建立時間（created_at — UTC+8 格式化）
    └── Pagination（pageSize=30）
```

**樣式**：使用 `createStyles` 管理，顏色/間距使用 Antd design token。

**路由**（`client/src/router.tsx`）：

```tsx
{
  path: 'chatrooms',
  element: (
    <ProtectedRoute permission="chatroom:read">
      <ChatroomPage />
    </ProtectedRoute>
  ),
}
```

### 5.12 前端 ChatMonitoringPage

**檔案**：`client/src/pages/ChatMonitoringPage.tsx`

**頁面結構**：

```
ChatMonitoringPage
├── 篩選區域（Card）
│   ├── Select — 聊天室（從 chatrooms API 取得選項）
│   ├── Input — 玩家帳號
│   ├── Input — 玩家暱稱
│   ├── Input — 訊息關鍵字
│   ├── DatePicker.RangePicker — 時間範圍
│   └── Button — 查詢 / 重置
└── 資料表格（Table）
    ├── Column: 聊天室（chatroom_id）
    ├── Column: 玩家帳號（player_username）
    ├── Column: 玩家暱稱（player_nickname）
    ├── Column: 訊息內容（message）
    ├── Column: 發送時間（created_at — UTC+8 格式化）
    ├── Column: 操作（Action）
    │   ├── Button — 刪除訊息（呼叫 DELETE API）
    │   ├── Button — 封鎖玩家（disabled，tooltip: "功能開發中"）
    │   └── Button — 重設暱稱（disabled，tooltip: "功能開發中"）
    └── Pagination（pageSize=30）
```

**互動行為**：

- 刪除訊息前顯示確認 Modal（Antd Modal.confirm）
- 刪除成功後自動重新查詢當前頁
- 封鎖玩家 / 重設暱稱按鈕為 disabled 狀態

**樣式**：使用 `createStyles` 管理，顏色/間距使用 Antd design token。

**路由**（`client/src/router.tsx`）：

```tsx
{
  path: 'chat',
  element: (
    <ProtectedRoute permission="chat:read">
      <ChatMonitoringPage />
    </ProtectedRoute>
  ),
}
```

### 5.13 Shared types / schemas

**`shared/types/chatroom.ts`**：

```ts
export type TChatroomItem = {
  id: string;
  name: string;
  online_user_count: number;
  created_at: string;
  updated_at: string;
};

export type TChatroomQuery = {
  name?: string;
  page?: number;
  pageSize?: number;
};
```

**`shared/types/chatMessage.ts`**：

```ts
export type TChatMessageItem = {
  id: number;
  chatroom_id: string;
  player_username: string;
  player_nickname: string;
  message: string;
  created_at: string;
};

export type TChatMessageQuery = {
  chatroomId?: string;
  playerUsername?: string;
  playerNickname?: string;
  message?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
};
```

**`shared/schemas/chatroom.ts`**：

```ts
import { z } from 'zod';

export const chatroomQuerySchema = z.object({
  name: z.string().optional(),
  page: z.coerce.number().int().min(1, '頁碼必須為正整數').optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(30),
});
```

**`shared/schemas/chatMessage.ts`**：

```ts
import { z } from 'zod';

export const chatMessageQuerySchema = z.object({
  chatroomId: z.string().optional(),
  playerUsername: z.string().optional(),
  playerNickname: z.string().optional(),
  message: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().int().min(1, '頁碼必須為正整數').optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(30),
});
```

**`shared/index.ts`** — re-export 所有新增的 types 和 schemas。

### 5.14 Phase 1 相容性 — rfc_01 Route 表更新

更新 [rfc_01](rfc_01-auth-and-response.md) §5.9 Route 權限對照表：

| 原路徑                          | 新路徑                          |
| ------------------------------- | ------------------------------- |
| `GET /api/chat/messages`        | `GET /api/chat_messages`        |
| `DELETE /api/chat/messages/:id` | `DELETE /api/chat_messages/:id` |

---

## 6. 測試計畫

測試策略沿用 [rfc_00 §6](rfc_00-project_tech_stack.md)。

### 6.1 測試檔案

| 層級        | 測試檔案                      | 測試目標                                            |
| ----------- | ----------------------------- | --------------------------------------------------- |
| Integration | `chatroom.list.test.ts`       | GET /api/chatrooms 完整 pipeline                    |
| Integration | `chatMessage.list.test.ts`    | GET /api/chat_messages 完整 pipeline                |
| Integration | `chatMessage.delete.test.ts`  | DELETE /api/chat_messages/:id 軟刪除 + 操作紀錄     |
| Component   | `ChatroomPage.test.tsx`       | 頁面渲染、搜尋互動、分頁                            |
| Component   | `ChatMonitoringPage.test.tsx` | 頁面渲染、多條件篩選、刪除確認、分頁、disabled 按鈕 |

### 6.2 Gherkin Scenario 映射

| Gherkin Tag    | 對應測試檔案                                                                      |
| -------------- | --------------------------------------------------------------------------------- |
| `@happy_path`  | `chatroom.list.test.ts`、`chatMessage.list.test.ts`、`chatMessage.delete.test.ts` |
| `@soft_delete` | `chatMessage.delete.test.ts`、`chatMessage.list.test.ts`                          |
| `@permissions` | `chatroom.list.test.ts`、`chatMessage.list.test.ts`、`chatMessage.delete.test.ts` |
| `@validation`  | `chatroom.list.test.ts`、`chatMessage.list.test.ts`                               |
| `@ui_only`     | `ChatMonitoringPage.test.tsx`                                                     |

---

## 7. 風險與緩解

| 風險                              | 影響                           | 緩解方式                                                     |
| --------------------------------- | ------------------------------ | ------------------------------------------------------------ |
| chatroom.id 為 string PK          | 無法自增，依賴外部系統產生 ID  | 本系統為 Mock Data，seed 預設固定 ID；正式環境由遊戲系統提供 |
| 軟刪除可能累積大量已刪除資料      | 查詢效能下降                   | `deleted_at` 加入複合索引；Demo 環境資料量小，不構成問題     |
| ~~封鎖玩家 / 暱稱重設按鈕 disabled~~ | 已於 Phase 4/9 啟用         | 封鎖（Phase 4）、暱稱重設（Phase 9）                        |
| players 表為共用基礎表            | 後續模組修改可能影響現有功能   | Schema 設計預留擴充空間；migration 獨立，不互相干擾          |
| chat_messages seed 需模擬真實對話 | 不真實的對話影響 Demo 展示效果 | Seed 設計時參考真實遊戲聊天室場景（下注、祝賀、閒聊等）      |

---

## 8. 完成標準

- [ ] 4 張 migration 正常執行，DB 表結構正確
- [ ] Seed data 正常載入（5 聊天室 + 15~20 玩家 + 關聯 + 50~100 訊息）
- [ ] `GET /api/chatrooms` 回傳分頁聊天室列表
- [ ] `GET /api/chatrooms?name=baccarat` 模糊搜尋正常
- [ ] `GET /api/chat_messages` 回傳分頁訊息列表
- [ ] `GET /api/chat_messages` 多條件篩選正常（chatroomId / playerUsername / playerNickname / message / startDate / endDate）
- [ ] `DELETE /api/chat_messages/:id` 軟刪除成功
- [ ] 刪除訊息後 operation_logs 有紀錄（afterware 模式）
- [ ] 已軟刪除的訊息不出現在 GET 列表中
- [ ] 前端 ChatroomPage 正確顯示聊天室列表
- [ ] 前端 ChatMonitoringPage 正確顯示訊息列表
- [ ] 前端刪除功能正常（確認 Modal + 刪除 + 重新查詢）
- [x] 前端封鎖玩家按鈕已啟用（Phase 4）
- [x] 前端暱稱重設按鈕已啟用（Phase 9）
- [ ] 前端時間顯示為 UTC+8 格式
- [ ] rfc_01 Route 權限對照表已同步更新
- [ ] Vitest 測試全部通過
