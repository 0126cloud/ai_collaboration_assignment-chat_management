# RFC: 暱稱審核 + 玩家檢舉審核

## 1. 背景

Phase 4（[rfc_04](rfc_04-blacklist-and-ip-blocking.md)）已完成黑名單與 IP 封鎖模組，建立了 `BlacklistService` 與封鎖 / 解封 API。現進入 Phase 5，實作兩個審核模組：

1. **暱稱審核（Nickname Review）** — 管理員審核玩家提交的暱稱變更申請
2. **玩家檢舉審核（Player Report Review）** — 管理員審核玩家提交的聊天檢舉，核准後自動封鎖被檢舉玩家

兩個模組合併為一份 RFC，原因：

- 兩者皆為「審核佇列」模式（列表 + 核准 / 駁回），業務結構相似
- 暱稱審核直接操作 `players` 表（rfc_03 建立）
- 玩家檢舉審核依賴 `BlacklistService`（rfc_04 建立）進行自動封鎖

**範圍界定**：本 RFC 涵蓋 1 個 migration（players 新增欄位）、1 個新資料表（reports）、2 組 API、2 個前端頁面。不含 players 表的 `is_online` 欄位（無更新機制，延後實作）。

---

## 2. 目標

- 新增 `players.nickname_apply_at` 欄位（暱稱申請時間）
- 建立 `reports` 資料表
- 建立 `GET/POST /api/nickname_reviews` API（列表 + 核准 / 駁回）
- 建立 `GET/POST /api/reports` API（列表 + 核准 / 駁回）
- 核准檢舉時自動呼叫 `BlacklistService.create()` 封鎖被檢舉玩家
- 建立前端 `NicknameReviewPage`（暱稱審核列表）
- 建立前端 `ReportReviewPage`（檢舉審核列表）

---

## 3. 提案

### 3.1 DB Schema 設計

**修改現有表：**

| 表名      | 變更          | 說明                                              |
| --------- | ------------- | ------------------------------------------------- |
| `players` | 新增 4 個欄位 | `nickname_apply_at DATETIME nullable`（申請時間，審核後**保留**）、`nickname_review_status VARCHAR(20) nullable`（審核狀態）、`nickname_reviewed_by VARCHAR(50) nullable`（審核者）、`nickname_reviewed_at DATETIME nullable`（審核時間）|

**新增資料表：**

| 表名      | 說明                       | PK 型別               |
| --------- | -------------------------- | --------------------- |
| `reports` | 玩家檢舉紀錄（含審核結果） | INTEGER AUTOINCREMENT |

### 3.2 軟刪除策略

| 表名      | 策略                              | 理由                                     |
| --------- | --------------------------------- | ---------------------------------------- |
| `players` | 沿用既有 `deleted_at`             | rfc_03 已定義                            |
| `reports` | **不加 `deleted_at`**（不軟刪除） | 檢舉為稽核紀錄，一旦建立不應被刪除或隱藏 |

### 3.3 API URL 設計

| API                                            | 權限              | 說明              |
| ---------------------------------------------- | ----------------- | ----------------- |
| `GET /api/nickname_reviews`                    | `nickname:read`   | 待審核暱稱列表    |
| `POST /api/nickname_reviews/:username/approve` | `nickname:review` | 核准暱稱          |
| `POST /api/nickname_reviews/:username/reject`  | `nickname:review` | 駁回暱稱（重設）  |
| `GET /api/reports`                             | `report:read`     | 檢舉列表          |
| `POST /api/reports/:id/approve`                | `report:review`   | 核准檢舉（+封鎖） |
| `POST /api/reports/:id/reject`                 | `report:review`   | 駁回檢舉          |

> HTTP Method 選用 `POST` 而非 `PUT`：核准 / 駁回非冪等操作，第二次呼叫應回傳 `REPORT_ALREADY_REVIEWED` / `PLAYER_NICKNAME_NOT_PENDING` 錯誤，不符合 PUT 的冪等語意。

> 所有 API 路徑對照表請同步更新 [rfc_01](rfc_01-auth-and-response.md) §5.9。

### 3.4 `approve report → block player` 設計

核准檢舉時，ReportService 直接實例化 BlacklistService 並呼叫：

```ts
blacklistService.create(
  'player',
  { target: report.target_username, reason: report.reason, chatroom_id: report.chatroom_id },
  operator,
);
```

- `BlacklistService` 透過 constructor 注入 `ReportService`
- 若 target 已封鎖（拋出 `BLACKLIST_ALREADY_BLOCKED`），靜默忽略（目標已達成）
- 整個操作包裹在 Knex transaction 中，避免 report 已標記 approved 但封鎖失敗的部分失敗
- 核准動作只產生 1 筆操作紀錄（`APPROVE_REPORT`），封鎖為副作用，不另寫 `BLOCK_PLAYER` log

---

## 4. 高層設計

### 4.1 新增 / 修改檔案結構

```
chat-management/
├── server/
│   ├── db/
│   │   ├── migrations/
│   │   │   ├── 20260317000008_add_nickname_apply_at_to_players.ts  # [新增]
│   │   │   └── 20260317000009_create_reports.ts                    # [新增]
│   │   └── seeds/
│   │       ├── 04_players.ts                                        # [修改] nickname_apply_at + player019/020
│   │       └── 08_reports.ts                                        # [新增]
│   └── src/
│       ├── app.ts                                                   # [修改] 掛載新路由
│       ├── utils/
│       │   └── errorCodes.ts                                        # [修改] 新增 4 個 error codes
│       └── module/
│           ├── nicknameReview/
│           │   ├── controller.ts                                    # [新增]
│           │   ├── service.ts                                       # [新增]
│           │   └── route.ts                                         # [新增]
│           └── report/
│               ├── controller.ts                                    # [新增]
│               ├── service.ts                                       # [新增]
│               └── route.ts                                         # [新增]
├── client/
│   └── src/
│       ├── api/
│       │   ├── nicknameReview.ts                                    # [新增]
│       │   └── report.ts                                            # [新增]
│       ├── pages/
│       │   ├── NicknameReviewPage.tsx                               # [新增]
│       │   └── ReportReviewPage.tsx                                 # [新增]
│       ├── layouts/
│       │   └── AdminLayout.tsx                                      # [修改] sidebar key 修正
│       └── router.tsx                                               # [修改] 新增路由
└── shared/
    ├── schemas/
    │   ├── nicknameReview.ts                                        # [新增]
    │   └── report.ts                                                # [新增]
    ├── types/
    │   ├── nicknameReview.ts                                        # [新增]
    │   └── report.ts                                                # [新增]
    └── index.ts                                                     # [修改] re-export
```

---

## 5. 詳細設計

### 5.1 DB Migration — players 表新增欄位

**Migration**（`server/db/migrations/20260317000008_add_nickname_apply_at_to_players.ts`）：

| 欄位              | 型別              | 說明                                         |
| ----------------- | ----------------- | -------------------------------------------- |
| nickname_apply_at | DATETIME nullable | 玩家提交暱稱申請的時間；核准 / 駁回後設 NULL |

```ts
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('players', (table) => {
    table.datetime('nickname_apply_at').nullable().defaultTo(null);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('players', (table) => {
    table.dropColumn('nickname_apply_at');
  });
}
```

### 5.2 DB Schema — reports 表

**Migration**（`server/db/migrations/20260317000009_create_reports.ts`）：

| 欄位              | 型別                                   | 說明                                        |
| ----------------- | -------------------------------------- | ------------------------------------------- |
| id                | INTEGER PRIMARY KEY AUTOINCREMENT      |                                             |
| reporter_username | VARCHAR(50) NOT NULL                   | 檢舉人帳號（FK → players.username）         |
| target_username   | VARCHAR(50) NOT NULL                   | 被檢舉玩家帳號（FK → players.username）     |
| chatroom_id       | VARCHAR(50) NOT NULL                   | 事發聊天室                                  |
| chat_message_id   | INTEGER nullable                       | FK → chat_messages.id（訊息可能已刪除）     |
| chat_message      | TEXT NOT NULL                          | 被檢舉訊息內容快照                          |
| reason            | VARCHAR(20) NOT NULL                   | `'spam'` \| `'abuse'` \| `'advertisement'`  |
| status            | VARCHAR(20) NOT NULL DEFAULT 'pending' | `'pending'` \| `'approved'` \| `'rejected'` |
| reviewed_by       | VARCHAR(50) nullable                   | 審核管理員帳號                              |
| reviewed_at       | DATETIME nullable                      | 審核時間                                    |
| created_at        | DATETIME DEFAULT CURRENT_TIMESTAMP     |                                             |

**索引**：`(status)`、`(reporter_username)`、`(target_username)`、`(created_at)`

> **設計決策**：使用 `status VARCHAR` 三態而非 `approved BOOLEAN`，原因是需要明確區分「待審核」、「已核准」、「已駁回」三種狀態；布林值無法表達「待審核」。

> **無 deleted_at**：檢舉紀錄為稽核資料，不支援軟刪除。

### 5.3 API — GET `/api/nickname_reviews`

- **需認證**：`auth` middleware
- **需權限**：`nickname:read`
- **Query Parameters**：

| 參數           | 型別   | 必填 | 說明                                          | 預設值    |
| -------------- | ------ | ---- | --------------------------------------------- | --------- |
| status         | string | 否   | `'pending'` \| `'approved'` \| `'rejected'`   | `pending` |
| username       | string | 否   | 玩家帳號（模糊搜尋）                          | —         |
| nickname       | string | 否   | 申請暱稱（模糊搜尋）                          | —         |
| applyStartDate | string | 否   | 申請時間起（UTC ISO 8601）                    | —         |
| applyEndDate   | string | 否   | 申請時間迄（UTC ISO 8601）                    | —         |
| page           | number | 否   | 頁碼                                          | 1         |
| pageSize       | number | 否   | 每頁筆數                                      | 20        |

- **篩選邏輯**：
  - `WHERE nickname_review_status = status`（預設 `'pending'`），以及 `deleted_at IS NULL`
  - `username` LIKE `%value%`
  - `nickname` LIKE `%value%`
  - `applyStartDate` / `applyEndDate` 範圍查詢 `nickname_apply_at`
  - `ORDER BY nickname_apply_at ASC`（最早申請優先）

- **Response 200**：

```json
{
  "success": true,
  "data": [
    {
      "username": "player016",
      "nickname": "DragonKing",
      "nickname_apply_at": "2026-03-15 10:00:00",
      "nickname_review_status": "pending",
      "nickname_reviewed_by": null,
      "nickname_reviewed_at": null
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 5,
    "totalPages": 1
  }
}
```

### 5.4 API — POST `/api/nickname_reviews/:username/approve`

- **需認證**：`auth` middleware
- **需權限**：`nickname:review`
- **路徑參數**：`username`（players.username）
- **Request Body**：無
- **行為**：
  - 查詢 player 確認存在且 `nickname_review_status = 'pending'`，否則拋出對應錯誤
  - `UPDATE players SET nickname_review_status = 'approved', nickname_reviewed_by = operator, nickname_reviewed_at = now(), updated_at = now() WHERE username = :username`
  - 備註：`nickname_apply_at` 審核後保留，不設為 null
  - 觸發操作紀錄：`res.locals.operationLog = { operationType: 'APPROVE_NICKNAME', targetId: username }`

- **Response 200**：

```json
{
  "success": true,
  "data": {
    "message": "暱稱申請已核准"
  }
}
```

- **Error 404**：`PLAYER_NOT_FOUND`
- **Error 409**：`PLAYER_NICKNAME_NOT_PENDING`（無待審核申請）

### 5.5 API — POST `/api/nickname_reviews/:username/reject`

- **需認證**：`auth` middleware
- **需權限**：`nickname:review`
- **路徑參數**：`username`
- **Request Body**：無
- **行為**：
  - 查詢 player 確認存在且 `nickname_review_status = 'pending'`，否則拋出對應錯誤
  - `UPDATE players SET nickname = username, nickname_review_status = 'rejected', nickname_reviewed_by = operator, nickname_reviewed_at = now(), updated_at = now() WHERE username = :username`
  - 觸發操作紀錄：`res.locals.operationLog = { operationType: 'REJECT_NICKNAME', targetId: username }`

- **Response 200**：

```json
{
  "success": true,
  "data": {
    "message": "暱稱申請已駁回，暱稱已重設為帳號名稱"
  }
}
```

- **Error 404**：`PLAYER_NOT_FOUND`
- **Error 409**：`PLAYER_NICKNAME_NOT_PENDING`

### 5.6 API — GET `/api/reports`

- **需認證**：`auth` middleware
- **需權限**：`report:read`
- **Query Parameters**：

| 參數             | 型別   | 必填 | 說明                                        | 預設值    |
| ---------------- | ------ | ---- | ------------------------------------------- | --------- |
| status           | string | 否   | `'pending'` \| `'approved'` \| `'rejected'` | `pending` |
| reporterUsername | string | 否   | 檢舉人帳號（模糊搜尋）                      | —         |
| targetUsername   | string | 否   | 被檢舉玩家帳號（模糊搜尋）                  | —         |
| startDate        | string | 否   | 舉報時間起（UTC ISO 8601）                  | —         |
| endDate          | string | 否   | 舉報時間迄（UTC ISO 8601）                  | —         |
| page             | number | 否   | 頁碼                                        | 1         |
| pageSize         | number | 否   | 每頁筆數                                    | 20        |

- **篩選邏輯**：
  - 不加 `deleted_at` 條件（reports 無軟刪除）
  - `status` 精確比對；若未傳入預設 `'pending'`
  - `reporterUsername` LIKE `%value%`
  - `targetUsername` LIKE `%value%`
  - `startDate` / `endDate` 範圍查詢 `created_at`
  - `ORDER BY created_at DESC`

- **Response 200**：

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "reporter_username": "player001",
      "target_username": "player003",
      "chatroom_id": "baccarat_001",
      "chat_message_id": 42,
      "chat_message": "你這個混蛋！",
      "reason": "abuse",
      "status": "pending",
      "reviewed_by": null,
      "reviewed_at": null,
      "created_at": "2026-03-16 14:30:00"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 2,
    "totalPages": 1
  }
}
```

### 5.7 API — POST `/api/reports/:id/approve`

- **需認證**：`auth` middleware
- **需權限**：`report:review`
- **路徑參數**：`id`（INTEGER，報告 ID）
- **Request Body**：無
- **行為**（包裹在 Knex transaction 中）：
  1. 查詢 report 確認 `id` 存在，否則拋出 `REPORT_NOT_FOUND`
  2. 確認 `status = 'pending'`，否則拋出 `REPORT_ALREADY_REVIEWED`
  3. `UPDATE reports SET status = 'approved', reviewed_by = operator, reviewed_at = now()`
  4. 呼叫 `blacklistService.create('player', { target: target_username, reason, chatroom_id }, operator)`
  5. 若拋出 `BLACKLIST_ALREADY_BLOCKED` 則靜默忽略（目標已封鎖）；其他錯誤 rethrow（觸發 transaction rollback）
  6. 觸發操作紀錄：`res.locals.operationLog = { operationType: 'APPROVE_REPORT', targetId: id }`

- **Response 200**：

```json
{
  "success": true,
  "data": {
    "message": "檢舉已核准，被檢舉玩家已封鎖"
  }
}
```

- **Error 404**：`REPORT_NOT_FOUND`
- **Error 409**：`REPORT_ALREADY_REVIEWED`

### 5.8 API — POST `/api/reports/:id/reject`

- **需認證**：`auth` middleware
- **需權限**：`report:review`
- **路徑參數**：`id`（INTEGER）
- **Request Body**：無
- **行為**：
  - 查詢 report 確認存在且 `status = 'pending'`
  - `UPDATE reports SET status = 'rejected', reviewed_by = operator, reviewed_at = now()`
  - 觸發操作紀錄：`res.locals.operationLog = { operationType: 'REJECT_REPORT', targetId: id }`

- **Response 200**：

```json
{
  "success": true,
  "data": {
    "message": "檢舉已駁回"
  }
}
```

- **Error 404**：`REPORT_NOT_FOUND`
- **Error 409**：`REPORT_ALREADY_REVIEWED`

### 5.9 Error Codes（新增）

**`server/src/utils/errorCodes.ts`**：

```ts
// 玩家
PLAYER_NOT_FOUND = 'PLAYER_NOT_FOUND',
PLAYER_NICKNAME_NOT_PENDING = 'PLAYER_NICKNAME_NOT_PENDING',

// 玩家檢舉
REPORT_NOT_FOUND = 'REPORT_NOT_FOUND',
REPORT_ALREADY_REVIEWED = 'REPORT_ALREADY_REVIEWED',

// ERROR_MESSAGES:
[ErrorCode.PLAYER_NOT_FOUND]: { statusCode: 404, message: '玩家不存在或已刪除' },
[ErrorCode.PLAYER_NICKNAME_NOT_PENDING]: { statusCode: 409, message: '該玩家沒有待審核的暱稱申請' },
[ErrorCode.REPORT_NOT_FOUND]: { statusCode: 404, message: '檢舉紀錄不存在' },
[ErrorCode.REPORT_ALREADY_REVIEWED]: { statusCode: 409, message: '該檢舉已審核過' },
```

### 5.10 後端 Module — nicknameReview

遵循既有 module 三層架構（route → controller → service）。

**route.ts**（`server/src/module/nicknameReview/route.ts`）：

```ts
export function createNicknameReviewRoutes(db: Knex): Router {
  const router = Router();
  const service = new NicknameReviewService(db);
  const controller = new NicknameReviewController(service);

  router.get('/', auth, requirePermission('nickname:read'), controller.list);
  router.post('/:username/approve', auth, requirePermission('nickname:review'), controller.approve);
  router.post('/:username/reject', auth, requirePermission('nickname:review'), controller.reject);

  return router;
}
```

**service.ts** 關鍵方法：

- `list(query)` — 篩選 `nickname_review_status = status`（預設 `'pending'`）+ 搜尋條件 + 分頁
- `approve(username, operator)` — 確認存在且 `nickname_review_status = 'pending'` → UPDATE `nickname_review_status = 'approved'`, `reviewed_by`, `reviewed_at`
- `reject(username, operator)` — 確認存在且 `nickname_review_status = 'pending'` → UPDATE `nickname = username`, `nickname_review_status = 'rejected'`, `reviewed_by`, `reviewed_at`

**controller.ts** 關鍵方法：

- `list(req, res, next)` — 驗證 query → 呼叫 service.list() → ResponseHelper.paginated()
- `approve(req, res, next)` — 呼叫 service.approve() → 設定 operationLog → ResponseHelper.success()
- `reject(req, res, next)` — 呼叫 service.reject() → 設定 operationLog → ResponseHelper.success()

### 5.11 後端 Module — report

**route.ts**（`server/src/module/report/route.ts`）：

```ts
export function createReportRoutes(db: Knex): Router {
  const router = Router();
  const blacklistService = new BlacklistService(db);
  const service = new ReportService(db, blacklistService);
  const controller = new ReportController(service);

  router.get('/', auth, requirePermission('report:read'), controller.list);
  router.post('/:id/approve', auth, requirePermission('report:review'), controller.approve);
  router.post('/:id/reject', auth, requirePermission('report:review'), controller.reject);

  return router;
}
```

**service.ts** 關鍵方法：

- `list(query)` — 篩選 status（預設 pending）+ 搜尋條件 + 分頁
- `approve(id, operator)` — transaction：確認 pending → UPDATE approved → blacklistService.create()（catch ALREADY_BLOCKED）
- `reject(id, operator)` — 確認 pending → UPDATE rejected

**controller.ts** 關鍵方法：

- `list(req, res, next)` — 驗證 query → 呼叫 service.list() → ResponseHelper.paginated()
- `approve(req, res, next)` — 解析 id → service.approve(id, operator) → 設定 operationLog → ResponseHelper.success()
- `reject(req, res, next)` — 解析 id → service.reject(id, operator) → 設定 operationLog → ResponseHelper.success()

### 5.12 Seed 資料

#### 修改 players（`server/db/seeds/04_players.ts`）

在既有 3 筆 `nickname_review_status = 'pending'` 的玩家（player016/017/018）補上 `nickname_apply_at`，並新增 player019 / player020 以達成 PRD §7 要求的 5 筆待審核：

| username  | nickname      | nickname_review_status | nickname_apply_at   |
| --------- | ------------- | :--------------------: | ------------------- |
| player016 | DragonKing    |        pending         | 2026-03-15 10:00:00 |
| player017 | LuckyStrike99 |        pending         | 2026-03-15 11:30:00 |
| player018 | PokerGod777   |        pending         | 2026-03-16 09:00:00 |
| player019 | CasinoMaster  |        pending         | 2026-03-16 14:00:00 |
| player020 | GoldenChip_X  |        pending         | 2026-03-17 08:00:00 |

#### 新增 reports（`server/db/seeds/08_reports.ts`）

5 筆覆蓋 pending / approved / rejected 三種狀態：

| id  | reporter  | target    | chatroom      | reason        | status   | reviewed_by |
| --- | --------- | --------- | ------------- | ------------- | -------- | ----------- |
| 1   | player001 | player003 | baccarat_001  | spam          | pending  | null        |
| 2   | player002 | player007 | blackjack_001 | abuse         | pending  | null        |
| 3   | player004 | player010 | roulette_001  | advertisement | approved | admin01     |
| 4   | player005 | player012 | baccarat_001  | spam          | rejected | admin02     |
| 5   | player006 | player015 | blackjack_001 | abuse         | approved | admin01     |

### 5.13 前端 NicknameReviewPage

**檔案**：`client/src/pages/NicknameReviewPage.tsx`

**頁面結構**：

```
NicknameReviewPage
├── 篩選區域（Card）
│   ├── Input — 玩家帳號（模糊搜尋）
│   ├── Input — 申請暱稱（模糊搜尋）
│   ├── DatePicker.RangePicker — 申請時間範圍
│   └── Button — 查詢 / 重置
└── 資料表格（Table）
    ├── Column: 申請時間（nickname_apply_at — UTC+8 格式化）
    ├── Column: 玩家帳號（username）
    ├── Column: 申請暱稱（nickname）
    └── Column: 操作
        ├── Button — 核准（呼叫 approve API）
        └── Button — 駁回（呼叫 reject API）
```

**互動行為**：

- 操作按鈕使用 per-row loading state（`loadingUsername: string | null`），防止重複提交
- 核准 / 駁回後自動重新查詢
- 每個操作前顯示確認 Modal（`Modal.confirm`）

**樣式**：使用 `createStyles` 管理，顏色 / 間距使用 Antd design token。

**路由**（`client/src/router.tsx`）：

```tsx
{
  path: 'nickname-reviews',
  element: (
    <ProtectedRoute permission="nickname:read">
      <NicknameReviewPage />
    </ProtectedRoute>
  ),
}
```

### 5.14 前端 ReportReviewPage

**檔案**：`client/src/pages/ReportReviewPage.tsx`

**頁面結構**：

```
ReportReviewPage
├── 篩選區域（Card）
│   ├── Select — 狀態（全部 / 待審核 / 已核准 / 已駁回）
│   ├── Input — 檢舉人帳號（模糊搜尋）
│   ├── Input — 被檢舉玩家帳號（模糊搜尋）
│   ├── DatePicker.RangePicker — 舉報時間範圍
│   └── Button — 查詢 / 重置
└── 資料表格（Table）
    ├── Column: 舉報時間（created_at — UTC+8 格式化）
    ├── Column: 檢舉人（reporter_username）
    ├── Column: 被檢舉玩家（target_username）
    ├── Column: 聊天室（chatroom_id）
    ├── Column: 原因（reason — Tag 顯示，spam=橘、abuse=紅、advertisement=藍）
    ├── Column: 訊息內容（chat_message — 截斷顯示，Tooltip 顯示全文）
    ├── Column: 狀態（status — Tag 顯示，pending=橘、approved=綠、rejected=紅）
    ├── Column: 審核者（reviewed_by）
    └── Column: 操作
        ├── Button — 核准（status !== 'pending' 時 disabled）
        └── Button — 駁回（status !== 'pending' 時 disabled）
```

**互動行為**：

- 操作按鈕使用 per-row loading state（`loadingId: number | null`）
- 核准時顯示確認 Modal，提醒「核准後將自動封鎖該玩家」
- 操作後自動重新查詢
- 狀態篩選預設為「待審核」（`status=pending`）

**樣式**：使用 `createStyles` 管理，顏色 / 間距使用 Antd design token。

**路由**（`client/src/router.tsx`）：

```tsx
{
  path: 'reports',
  element: (
    <ProtectedRoute permission="report:read">
      <ReportReviewPage />
    </ProtectedRoute>
  ),
}
```

### 5.15 AdminLayout Sidebar 修正

**`client/src/layouts/AdminLayout.tsx`**：

現有 sidebar key `'/nickname-requests'` 與新路由 `/nickname-reviews` 不符，需修正：

```ts
// 修改前
{ key: '/nickname-requests', label: '暱稱審核', ... }
// 修改後
{ key: '/nickname-reviews', label: '暱稱審核', ... }
```

### 5.16 Shared types / schemas

**`shared/types/nicknameReview.ts`**：

```ts
export type TNicknameReviewStatus = 'pending' | 'approved' | 'rejected';

export type TNicknameReviewItem = {
  username: string;
  nickname: string;
  nickname_apply_at: string;
  nickname_review_status: TNicknameReviewStatus;
  nickname_reviewed_by: string | null;
  nickname_reviewed_at: string | null;
};

export type TNicknameReviewQuery = {
  status?: TNicknameReviewStatus;
  username?: string;
  nickname?: string;
  applyStartDate?: string;
  applyEndDate?: string;
  page?: number;
  pageSize?: number;
};
```

**`shared/types/report.ts`**：

```ts
export type TReportStatus = 'pending' | 'approved' | 'rejected';
export type TReportReason = 'spam' | 'abuse' | 'advertisement';

export type TReportItem = {
  id: number;
  reporter_username: string;
  target_username: string;
  chatroom_id: string;
  chat_message_id: number | null;
  chat_message: string;
  reason: TReportReason;
  status: TReportStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export type TReportQuery = {
  status?: TReportStatus;
  reporterUsername?: string;
  targetUsername?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
};
```

**`shared/schemas/nicknameReview.ts`**：

```ts
import { z } from 'zod';

export const nicknameReviewQuerySchema = z.object({
  username: z.string().optional(),
  nickname: z.string().optional(),
  applyStartDate: z.string().optional(),
  applyEndDate: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
});
```

**`shared/schemas/report.ts`**：

```ts
import { z } from 'zod';

export const reportStatusValues = ['pending', 'approved', 'rejected'] as const;

export const reportQuerySchema = z.object({
  status: z.enum(reportStatusValues).optional().default('pending'),
  reporterUsername: z.string().optional(),
  targetUsername: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
});
```

**`shared/index.ts`** — re-export 所有新增的 types 和 schemas。

### 5.17 rfc_01 Route 權限對照表更新

更新 [rfc_01](rfc_01-auth-and-response.md) §5.9 Route 權限對照表，新增 Phase 5 路由。

---

## 6. 測試計畫

測試策略沿用 [rfc_00 §6](rfc_00-project_tech_stack.md)。

### 6.1 測試檔案

| 層級        | 測試檔案                      | 測試目標                                                             |
| ----------- | ----------------------------- | -------------------------------------------------------------------- |
| Integration | `nicknameReview.test.ts`      | GET /api/nickname_reviews + approve / reject 完整 pipeline           |
| Integration | `report.test.ts`              | GET /api/reports + approve（含自動封鎖） / reject 完整 pipeline      |
| Component   | `NicknameReviewPage.test.tsx` | 頁面渲染、搜尋互動、核准 / 駁回按鈕行為、loading state               |
| Component   | `ReportReviewPage.test.tsx`   | 頁面渲染、狀態篩選、核准 confirm Modal、disabled 狀態、loading state |

### 6.2 Integration Test 關鍵場景

**nicknameReview**：

- GET 列出待審核暱稱（`nickname_review_status=pending`）
- GET 搜尋條件篩選（username / nickname / 日期範圍）
- POST approve 核准暱稱 → `nickname_review_status=approved`, `nickname_reviewed_by` 有值
- POST approve 對已核准玩家 → 409 `PLAYER_NICKNAME_NOT_PENDING`
- POST approve 對不存在玩家 → 404 `PLAYER_NOT_FOUND`
- POST reject 駁回暱稱 → `nickname=username`, `nickname_review_status=rejected`

**report**：

- GET 列出待審核檢舉（`status=pending`）
- GET 依 status / reporter / target / 日期篩選
- POST approve 核准 → status=approved + blacklist 新增
- POST approve 已封鎖的 target → 靜默成功（不報 409）
- POST approve 已審核的 report → 409 `REPORT_ALREADY_REVIEWED`
- POST approve 不存在的 report → 404 `REPORT_NOT_FOUND`
- POST reject 駁回 → status=rejected

### 6.3 Gherkin Scenario 映射

| Gherkin Tag         | 對應測試                                   |
| ------------------- | ------------------------------------------ |
| `@happy_path`       | `nicknameReview.test.ts`, `report.test.ts` |
| `@auto_block`       | `report.test.ts`（approve → block 驗證）   |
| `@permissions`      | `nicknameReview.test.ts`, `report.test.ts` |
| `@validation`       | 兩個 integration test                      |
| `@already_reviewed` | `report.test.ts`（approve 已審核 → 409）   |

---

## 7. 風險與緩解

| 風險                                 | 影響                                         | 緩解方式                                                                       |
| ------------------------------------ | -------------------------------------------- | ------------------------------------------------------------------------------ |
| approve report 的 transaction 跨表   | report 更新成功但封鎖失敗 → 資料不一致       | Knex transaction 確保原子性；BLACKLIST_ALREADY_BLOCKED 靜默忽略                |
| players 表 nickname_apply_at 為 null | 部分舊資料無申請時間，影響日期篩選           | 欄位 nullable，日期篩選為 optional，無值時不影響查詢；seed 補充正確日期        |
| reports 表無軟刪除                   | 錯誤檢舉無法移除                             | Demo 環境不需刪除功能；若未來需要，加 `is_deleted` 欄位即可，不影響現有 status |
| AdminLayout sidebar key 不符         | 暱稱審核頁面的選單高亮失效                   | 同步修正 `AdminLayout.tsx` 中的 key 值                                         |
| testDb.ts 需同步更新                 | integration test schema 與 production 不同步 | Task 5.3 / 5.4 開始前確認 testDb.ts 已加入新欄位與新表                         |

---

## 8. 完成標準

- [ ] `20260317000008` migration 執行後 players 表含 `nickname_apply_at` 欄位
- [ ] `20260317000009` migration 執行後 reports 表結構正確
- [ ] Seed 執行後有 5 筆 `nickname_review_status=pending` 玩家（含 nickname_apply_at）
- [ ] Seed 執行後有 5 筆 reports（含 pending / approved / rejected 三種狀態）
- [ ] `GET /api/nickname_reviews` 正確回傳待審核列表（分頁 + 篩選）
- [ ] `POST /api/nickname_reviews/:username/approve` 核准後 `nickname_review_status=approved`
- [ ] `POST /api/nickname_reviews/:username/reject` 駁回後 nickname=username
- [ ] 重複 approve / reject 回傳 409 `PLAYER_NICKNAME_NOT_PENDING`
- [ ] `GET /api/reports` 正確回傳列表（預設 status=pending，分頁 + 篩選）
- [ ] `POST /api/reports/:id/approve` 核准後 status=approved 且目標玩家被封鎖
- [ ] `POST /api/reports/:id/approve` 目標玩家已封鎖時不報錯
- [ ] `POST /api/reports/:id/reject` 駁回後 status=rejected
- [ ] 重複 approve / reject 已審核的 report 回傳 409 `REPORT_ALREADY_REVIEWED`
- [ ] 所有操作自動記錄至 operation_logs（`APPROVE_NICKNAME`, `REJECT_NICKNAME`, `APPROVE_REPORT`, `REJECT_REPORT`）
- [ ] 前端 NicknameReviewPage 核准 / 駁回功能正常，含確認 Modal 與 loading state
- [ ] 前端 ReportReviewPage 核准 / 駁回功能正常，核准時提示「將自動封鎖玩家」
- [ ] AdminLayout sidebar `/nickname-reviews` key 修正，選單高亮正確
- [ ] rfc_01 Route 權限對照表已更新
- [ ] Vitest 測試全部通過
