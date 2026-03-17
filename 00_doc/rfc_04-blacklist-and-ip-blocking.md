# RFC: 黑名單與 IP 封鎖

## 1. 背景

Phase 3（[rfc_03](rfc_03-chatroom-and-chat.md)）已完成聊天室管理與聊天監控模組，其中 `ChatMonitoringPage` 的「封鎖玩家」按鈕因後端邏輯尚未實作，暫以 disabled 狀態呈現。

本 RFC 定義黑名單（玩家封鎖）與 IP 封鎖兩個功能模組的技術設計，並啟用 ChatMonitoringPage 的封鎖操作。

兩個模組合併為一份 RFC，原因：

- 共用同一張 `blacklist` 資料表（以 `block_type` 欄位區分玩家 / IP）
- 共用同一個後端 module（`blacklist`），透過明確路由區分操作對象
- 前端共用同一個 `BlacklistPage` 入口

**範圍界定**：本 RFC 涵蓋 `blacklist` 資料表、`/api/blacklist/player` 與 `/api/blacklist/ip` API、前端 `BlacklistPage` 與 `CreateBlacklistModal`，以及 `ChatMonitoringPage` 的封鎖按鈕啟用。

---

## 2. 目標

- 建立 `blacklist` 資料表（統一管理玩家黑名單與 IP 封鎖）
- 建立 `POST/GET/DELETE /api/blacklist/player` API（玩家黑名單）
- 建立 `POST/GET/DELETE /api/blacklist/ip` API（IP 封鎖）
- 建立前端 `BlacklistPage`（統一列表 + 篩選 + 新增封鎖 Modal）
- 啟用 `ChatMonitoringPage` 的「封鎖玩家」按鈕（串接黑名單 API）
- 操作紀錄自動寫入（`BLOCK_PLAYER`、`UNBLOCK_PLAYER`、`BLOCK_IP`、`UNBLOCK_IP`）

---

## 3. 提案

### 3.1 DB Schema 設計

新增 1 張資料表：

| 表名        | 說明                       | PK 型別               |
| ----------- | -------------------------- | --------------------- |
| `blacklist` | 玩家黑名單與 IP 封鎖統一表 | INTEGER AUTOINCREMENT |

統一設計可避免重複邏輯，`block_type` 欄位明確區分操作對象。

### 3.2 軟刪除策略

`blacklist` 表含 `deleted_at`（DATETIME nullable）欄位：

- `deleted_at IS NULL` → 有效的封鎖紀錄（目標被封鎖中）
- `deleted_at IS NOT NULL` → 已解封

所有 GET API 預設加上 `WHERE deleted_at IS NULL` 條件。

### 3.3 封鎖邏輯（upsert-like）

建立封鎖時依序檢查：

1. 存在 `deleted_at IS NULL` 的 active 紀錄 → 409 `BLACKLIST_ALREADY_BLOCKED`
2. 存在 `deleted_at IS NOT NULL` 的軟刪除紀錄 → 清除 `deleted_at`（重新封鎖）
3. 無紀錄 → INSERT 新紀錄

### 3.4 API URL 設計

一個 `blacklist` module，透過明確路由區分玩家 / IP，並靜態指定對應權限：

| API                                | Permission         | 說明           |
| ---------------------------------- | ------------------ | -------------- |
| `GET /api/blacklist/player`        | `blacklist:read`   | 玩家黑名單列表 |
| `POST /api/blacklist/player`       | `blacklist:create` | 封鎖玩家       |
| `DELETE /api/blacklist/player/:id` | `blacklist:delete` | 解封玩家       |
| `GET /api/blacklist/ip`            | `ip_block:read`    | IP 封鎖列表    |
| `POST /api/blacklist/ip`           | `ip_block:create`  | 封鎖 IP        |
| `DELETE /api/blacklist/ip/:id`     | `ip_block:delete`  | 解除 IP 封鎖   |

> 此設計更新 [rfc_01](rfc_01-auth-and-response.md) §5.9 Route 權限對照表：原規劃的 `/api/blacklist`、`/api/ip-blocks` 分別改為 `/api/blacklist/player`、`/api/blacklist/ip`，統一掛載於 `/api/blacklist`。

---

## 4. 高層設計

### 4.1 新增 / 修改檔案結構

```
chat-management/
├── server/
│   ├── db/
│   │   ├── migrations/
│   │   │   └── 20260317000006_create_blacklist.ts         # [新增]
│   │   └── seeds/
│   │       └── 07_blacklist.ts                            # [新增]
│   └── src/
│       ├── app.ts                                         # [修改] 掛載 blacklist routes
│       ├── utils/
│       │   └── errorCodes.ts                              # [修改] 新增 error codes
│       └── module/
│           └── blacklist/
│               ├── controller.ts                          # [新增]
│               ├── service.ts                             # [新增]
│               └── route.ts                              # [新增]
├── client/
│   └── src/
│       ├── api/
│       │   └── blacklist.ts                               # [新增]
│       ├── pages/
│       │   ├── BlacklistPage.tsx                          # [新增]
│       │   └── ChatMonitoringPage.tsx                     # [修改] 啟用封鎖玩家按鈕
│       ├── components/
│       │   └── CreateBlacklistModal.tsx                   # [新增]
│       └── router.tsx                                     # [修改] 新增路由
└── shared/
    ├── schemas/
    │   └── blacklist.ts                                   # [新增]
    ├── types/
    │   └── blacklist.ts                                   # [新增]
    └── index.ts                                           # [修改] re-export
```

---

## 5. 詳細設計

### 5.1 DB Schema — blacklist 表

**Migration**（`server/db/migrations/20260317000006_create_blacklist.ts`）：

| 欄位        | 型別                               | 說明                                       |
| ----------- | ---------------------------------- | ------------------------------------------ |
| id          | INTEGER PRIMARY KEY AUTOINCREMENT  |                                            |
| block_type  | VARCHAR(10) NOT NULL               | `'player'` \| `'ip'`                       |
| target      | VARCHAR(100) NOT NULL              | 玩家帳號 或 IP 位址（含萬用字元格式）      |
| reason      | VARCHAR(20) NOT NULL               | `'spam'` \| `'abuse'` \| `'advertisement'` |
| operator    | VARCHAR(50) NOT NULL               | 操作者帳號（冗餘欄位，方便查詢顯示）       |
| chatroom_id | VARCHAR(50) NOT NULL DEFAULT '\*'  | 特定聊天室 ID 或 `'*'`（全域封鎖）         |
| created_at  | DATETIME DEFAULT CURRENT_TIMESTAMP |                                            |
| deleted_at  | DATETIME nullable                  | 軟刪除標記（解封時間）                     |

**約束**：`UNIQUE(block_type, target, chatroom_id)`

> 使用 `'*'` 作為全域封鎖的 `chatroom_id`（而非 NULL），以確保 UNIQUE 約束正確運作（SQLite 中 NULL ≠ NULL，無法防止重複插入）。

**索引**：`(block_type, target)`、`created_at`

### 5.2 API — GET `/api/blacklist/player` 與 GET `/api/blacklist/ip`

- **需認證**：`auth` middleware
- **需權限**：`blacklist:read`（player）、`ip_block:read`（ip）
- **Query Parameters**：

| 參數       | 型別   | 必填 | 說明                               | 預設值 |
| ---------- | ------ | ---- | ---------------------------------- | ------ |
| target     | string | 否   | 玩家帳號或 IP（模糊搜尋）          | —      |
| reason     | string | 否   | 封鎖原因（精確比對）               | —      |
| chatroomId | string | 否   | 聊天室 ID（模糊搜尋，含 `*` 全域） | —      |
| startDate  | string | 否   | 封鎖起始日期（UTC，ISO 8601）      | —      |
| endDate    | string | 否   | 封鎖結束日期（UTC，ISO 8601）      | —      |
| page       | number | 否   | 頁碼                               | 1      |
| pageSize   | number | 否   | 每頁筆數                           | 30     |

- **篩選邏輯**：
  - `block_type` 由路由層固定（player 路由固定 `'player'`，ip 路由固定 `'ip'`）
  - `target` LIKE `%value%`
  - `reason` 精確比對
  - `chatroomId` LIKE `%value%`
  - 固定加上 `WHERE deleted_at IS NULL`
  - 排序：`ORDER BY created_at DESC`

- **Response 200**：

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "block_type": "player",
      "target": "player123",
      "reason": "spam",
      "operator": "admin01",
      "chatroom_id": "baccarat_001",
      "created_at": "2026-03-15 10:00:00"
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

### 5.3 API — POST `/api/blacklist/player`

- **需認證**：`auth` middleware
- **需權限**：`blacklist:create`
- **Validation**：`createPlayerBlockSchema`（Zod）
- **Request Body**：

```json
{
  "target": "player123",
  "reason": "spam",
  "chatroom_id": "baccarat_001"
}
```

> `chatroom_id` 選填，預設為 `'*'`（全域封鎖）

- **封鎖邏輯**（upsert-like）：
  1. 查詢 `WHERE block_type='player' AND target=:target AND chatroom_id=:chatroom_id`
  2. 存在且 `deleted_at IS NULL` → 409 `BLACKLIST_ALREADY_BLOCKED`
  3. 存在且 `deleted_at IS NOT NULL` → `UPDATE SET deleted_at = NULL`
  4. 不存在 → `INSERT`

- **行為**：觸發操作紀錄 `res.locals.operationLog = { operationType: 'BLOCK_PLAYER' }`

- **Response 201**：

```json
{
  "success": true,
  "data": {
    "id": 6,
    "block_type": "player",
    "target": "player123",
    "reason": "spam",
    "operator": "admin01",
    "chatroom_id": "baccarat_001",
    "created_at": "2026-03-17 08:00:00"
  }
}
```

- **Error 400**：`VALIDATION_ERROR`
- **Error 409**：`BLACKLIST_ALREADY_BLOCKED`

### 5.4 API — POST `/api/blacklist/ip`

與 `POST /api/blacklist/player` 邏輯相同，差異：

- **需權限**：`ip_block:create`
- **Validation**：`createIpBlockSchema`（含 IP 格式 regex 驗證）
- **block_type 固定為** `'ip'`
- **行為**：觸發操作紀錄 `operationType: 'BLOCK_IP'`

### 5.5 API — DELETE `/api/blacklist/player/:id` 與 DELETE `/api/blacklist/ip/:id`

- **需認證**：`auth` middleware
- **需權限**：`blacklist:delete`（player）、`ip_block:delete`（ip）
- **路徑參數**：`id`（INTEGER）
- **行為**：
  - 查詢 `WHERE id = :id AND block_type = :blockType AND deleted_at IS NULL`
  - 不存在或已解封 → 404 `BLACKLIST_ENTRY_NOT_FOUND`
  - 存在 → `UPDATE SET deleted_at = CURRENT_TIMESTAMP`
  - 觸發操作紀錄：player → `UNBLOCK_PLAYER`，ip → `UNBLOCK_IP`

- **Response 200**：

```json
{
  "success": true,
  "data": {
    "message": "已成功解封"
  }
}
```

- **Error 404**：`BLACKLIST_ENTRY_NOT_FOUND`

### 5.6 新增 Error Codes

**`server/src/utils/errorCodes.ts`**：

```ts
BLACKLIST_ALREADY_BLOCKED = 'BLACKLIST_ALREADY_BLOCKED',
BLACKLIST_ENTRY_NOT_FOUND = 'BLACKLIST_ENTRY_NOT_FOUND',
```

**ERROR_MESSAGES**：

```ts
[ErrorCode.BLACKLIST_ALREADY_BLOCKED]: { statusCode: 409, message: '該目標已在封鎖名單中' },
[ErrorCode.BLACKLIST_ENTRY_NOT_FOUND]: { statusCode: 404, message: '封鎖紀錄不存在或已解封' },
```

### 5.7 後端 Module — blacklist

遵循既有 module 三層架構（route → controller → service）。

**route.ts**（`server/src/module/blacklist/route.ts`）：

```ts
export function createBlacklistRoutes(db: Knex): Router {
  const router = Router();
  const service = new BlacklistService(db);
  const controller = new BlacklistController(service);

  // Player blacklist routes
  router.get('/player', auth, requirePermission('blacklist:read'), controller.list);
  router.post(
    '/player',
    auth,
    requirePermission('blacklist:create'),
    validate(createPlayerBlockSchema),
    controller.create,
  );
  router.delete('/player/:id', auth, requirePermission('blacklist:delete'), controller.remove);

  // IP block routes
  router.get('/ip', auth, requirePermission('ip_block:read'), controller.list);
  router.post(
    '/ip',
    auth,
    requirePermission('ip_block:create'),
    validate(createIpBlockSchema),
    controller.create,
  );
  router.delete('/ip/:id', auth, requirePermission('ip_block:delete'), controller.remove);

  return router;
}
```

**service.ts**（`server/src/module/blacklist/service.ts`）：

- `list(blockType, query)` — 組裝 Knex 查詢（block_type 固定 + 多條件 + 分頁 + WHERE deleted_at IS NULL）
- `create(blockType, payload, operator)` — upsert 邏輯（查重 → 重新啟用或插入新紀錄）
- `remove(blockType, id)` — 軟刪除，驗證 block_type 匹配，回傳是否成功

**controller.ts**（`server/src/module/blacklist/controller.ts`）：

- `list(req, res, next)` — 從 URL path 判斷 blockType → 呼叫 service.list() → ResponseHelper.paginated()
- `create(req, res, next)` — 從 URL path 判斷 blockType → 呼叫 service.create() → 設定 operationLog → ResponseHelper.success(res, result, 201)
- `remove(req, res, next)` — 從 URL path 判斷 blockType → 呼叫 service.remove() → 設定 operationLog → ResponseHelper.success()

> Controller 透過 `req.path.includes('/ip')` 判斷 blockType（`'ip'` 或 `'player'`），無需額外 middleware。

**operationType 對應**：

| blockType | 操作   | operationType    |
| --------- | ------ | ---------------- |
| player    | create | `BLOCK_PLAYER`   |
| player    | remove | `UNBLOCK_PLAYER` |
| ip        | create | `BLOCK_IP`       |
| ip        | remove | `UNBLOCK_IP`     |

**掛載**（`server/src/app.ts`）：

```ts
app.use('/api/blacklist', createBlacklistRoutes(db));
```

### 5.8 Seed 資料

**檔案**：`server/db/seeds/07_blacklist.ts`

#### 玩家黑名單（5 筆）

| block_type | target   | reason        | chatroom_id   | deleted_at |
| ---------- | -------- | ------------- | ------------- | ---------- |
| player     | player03 | spam          | baccarat_001  | null       |
| player     | player07 | abuse         | \*            | null       |
| player     | player10 | advertisement | blackjack_001 | null       |
| player     | player12 | spam          | roulette_001  | null       |
| player     | player15 | abuse         | \*            | null       |

#### IP 封鎖（3 筆）

| block_type | target         | reason | chatroom_id  | deleted_at |
| ---------- | -------------- | ------ | ------------ | ---------- |
| ip         | 116.62.238.199 | spam   | \*           | null       |
| ip         | 116.62.238.\*  | abuse  | \*           | null       |
| ip         | 192.168.1.100  | spam   | baccarat_001 | null       |

### 5.9 Shared types / schemas

**`shared/types/blacklist.ts`**：

```ts
export type TBlacklistItem = {
  id: number;
  block_type: 'player' | 'ip';
  target: string;
  reason: 'spam' | 'abuse' | 'advertisement';
  operator: string;
  chatroom_id: string;
  created_at: string;
};

export type TBlacklistQuery = {
  target?: string;
  reason?: string;
  chatroomId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
};

export type TCreatePlayerBlockPayload = {
  target: string;
  reason: 'spam' | 'abuse' | 'advertisement';
  chatroom_id?: string;
};

export type TCreateIpBlockPayload = {
  target: string;
  reason: 'spam' | 'abuse' | 'advertisement';
  chatroom_id?: string;
};
```

**`shared/schemas/blacklist.ts`**：

```ts
import { z } from 'zod';

const IP_PATTERN = /^(\d{1,3}\.){3}(\d{1,3}|\*)$/;
const REASON_ENUM = z.enum(['spam', 'abuse', 'advertisement']);

export const blacklistQuerySchema = z.object({
  target: z.string().optional(),
  reason: REASON_ENUM.optional(),
  chatroomId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(30),
});

export const createPlayerBlockSchema = z.object({
  target: z.string().min(1, '請輸入玩家帳號'),
  reason: REASON_ENUM,
  chatroom_id: z.string().optional().default('*'),
});

export const createIpBlockSchema = z.object({
  target: z
    .string()
    .min(1, '請輸入 IP 位址')
    .regex(IP_PATTERN, 'IP 格式不正確，支援精確 IP 或萬用字元（如 116.62.238.* ）'),
  reason: REASON_ENUM,
  chatroom_id: z.string().optional().default('*'),
});
```

**`shared/index.ts`** — re-export 所有新增的 types 和 schemas。

### 5.10 前端 BlacklistPage

**檔案**：`client/src/pages/BlacklistPage.tsx`

**頁面結構**：

```
BlacklistPage
├── 篩選區域（Card）
│   ├── Select — 類型（Player / IP），無「全部」選項（兩個 API 分開，切換類型重新查詢）
│   ├── Input — 目標（玩家帳號或 IP，模糊搜尋）
│   ├── Select — 封鎖原因（spam / abuse / advertisement）
│   ├── Input — 聊天室（模糊搜尋，可輸入 * 搜尋全域封鎖）
│   ├── DatePicker.RangePicker — 封鎖時間範圍
│   └── Button — 查詢 / 重置
├── Button — 新增封鎖（開啟 CreateBlacklistModal）
└── 資料表格（Table）
    ├── Column: 類型（block_type）
    ├── Column: 目標（target）
    ├── Column: 封鎖原因（reason）
    ├── Column: 操作者（operator）
    ├── Column: 聊天室（chatroom_id，'*' 顯示為「全域」）
    ├── Column: 封鎖時間（created_at — UTC+8 格式化）
    └── Column: 操作
        └── Button — 解封（Modal.confirm 確認後呼叫 DELETE API）
    └── Pagination（pageSize=30）
```

**互動行為**：

- 切換 type Select → 重置其他篩選條件、重新查詢對應 API
- 解封前顯示確認 Modal（Antd Modal.confirm）
- 解封成功後重新查詢當前頁

**樣式**：使用 `createStyles` 管理，顏色/間距使用 Antd design token。

**路由**（`client/src/router.tsx`）：

```tsx
{
  path: 'blacklist',
  element: (
    <ProtectedRoute permission="blacklist:read">
      <BlacklistPage />
    </ProtectedRoute>
  ),
}
```

> Sidebar 選單更新：`{ key: '/blacklist', label: '黑名單管理 (IP, Player)', permission: 'blacklist:read' }`

### 5.11 前端 CreateBlacklistModal

**檔案**：`client/src/components/CreateBlacklistModal.tsx`

**Props**：

```ts
type TCreateBlacklistModalProps = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialValues?: {
    blockType?: 'player' | 'ip';
    target?: string; // 從 ChatMonitoringPage 預填玩家帳號
    chatroomId?: string; // 從 ChatMonitoringPage 預填聊天室
  };
};
```

**表單結構**（依 blockType 動態渲染）：

```
CreateBlacklistModal
├── Select — 類型（Player / IP）
├── Input — 目標
│   ├── blockType=player: 玩家帳號（文字輸入）
│   └── blockType=ip: IP 位址（含 regex 驗證提示）
├── Select — 封鎖原因（spam / abuse / advertisement）
├── Select — 聊天室（選填，可選「全域」或特定聊天室；從 chatrooms API 取得選項）
└── Button — 確認 / 取消
```

**互動行為**：

- 切換 blockType → 清除 target 欄位
- 提交成功後關閉 Modal 並通知父元件重新查詢

### 5.12 ChatMonitoringPage 更新

**修改檔案**：`client/src/pages/ChatMonitoringPage.tsx`

**修改內容**：

- 「封鎖玩家」按鈕從 `disabled` 改為啟用
- 移除 tooltip `"功能開發中"`
- 點擊時開啟 `CreateBlacklistModal`，傳入 `initialValues`:
  ```ts
  initialValues={{ blockType: 'player', target: record.player_username, chatroomId: record.chatroom_id }}
  ```
- 封鎖成功後：顯示成功提示（Antd message.success）

### 5.13 API 封裝

**`client/src/api/blacklist.ts`**：

```ts
export const blacklistApi = {
  listPlayers: (params: TBlacklistQuery) =>
    client.get<TApiResponse<TBlacklistItem[]>>('/api/blacklist/player', { params }),
  listIps: (params: TBlacklistQuery) =>
    client.get<TApiResponse<TBlacklistItem[]>>('/api/blacklist/ip', { params }),
  blockPlayer: (data: TCreatePlayerBlockPayload) =>
    client.post<TApiResponse<TBlacklistItem>>('/api/blacklist/player', data),
  blockIp: (data: TCreateIpBlockPayload) =>
    client.post<TApiResponse<TBlacklistItem>>('/api/blacklist/ip', data),
  unblockPlayer: (id: number) =>
    client.delete<TApiResponse<{ message: string }>>(`/api/blacklist/player/${id}`),
  unblockIp: (id: number) =>
    client.delete<TApiResponse<{ message: string }>>(`/api/blacklist/ip/${id}`),
};
```

### 5.14 rfc_01 Route 表更新

更新 [rfc_01](rfc_01-auth-and-response.md) §5.9 Route 權限對照表：

| 原路徑                      | 新路徑                             |
| --------------------------- | ---------------------------------- |
| `GET /api/blacklist`        | `GET /api/blacklist/player`        |
| `POST /api/blacklist`       | `POST /api/blacklist/player`       |
| `DELETE /api/blacklist/:id` | `DELETE /api/blacklist/player/:id` |
| `GET /api/ip-blocks`        | `GET /api/blacklist/ip`            |
| `POST /api/ip-blocks`       | `POST /api/blacklist/ip`           |
| `DELETE /api/ip-blocks/:id` | `DELETE /api/blacklist/ip/:id`     |

---

## 6. 測試計畫

測試策略沿用 [rfc_00 §6](rfc_00-project_tech_stack.md)。

### 6.1 測試檔案

| 層級        | 測試檔案                        | 測試目標                                                   |
| ----------- | ------------------------------- | ---------------------------------------------------------- |
| Integration | `blacklist.player.test.ts`      | GET/POST/DELETE /api/blacklist/player 完整 pipeline        |
| Integration | `blacklist.ip.test.ts`          | GET/POST/DELETE /api/blacklist/ip 完整 pipeline            |
| Component   | `BlacklistPage.test.tsx`        | 頁面渲染、type 切換、篩選互動、解封確認 Modal              |
| Component   | `CreateBlacklistModal.test.tsx` | Modal 渲染、player/ip 表單切換、提交成功/失敗              |
| Component   | `ChatMonitoringPage.test.tsx`   | 封鎖玩家按鈕啟用、點擊開啟 Modal、預填資料（更新既有測試） |

### 6.2 Gherkin Scenario 映射

| Gherkin Tag    | 對應測試檔案                                                                             |
| -------------- | ---------------------------------------------------------------------------------------- |
| `@happy_path`  | `blacklist.player.test.ts`、`blacklist.ip.test.ts`                                       |
| `@validation`  | `blacklist.player.test.ts`、`blacklist.ip.test.ts`                                       |
| `@soft_delete` | `blacklist.player.test.ts`、`blacklist.ip.test.ts`                                       |
| `@permissions` | `blacklist.player.test.ts`、`blacklist.ip.test.ts`                                       |
| `@ui_only`     | `BlacklistPage.test.tsx`、`CreateBlacklistModal.test.tsx`、`ChatMonitoringPage.test.tsx` |

---

## 7. 風險與緩解

| 風險                                      | 影響                             | 緩解方式                                                         |
| ----------------------------------------- | -------------------------------- | ---------------------------------------------------------------- |
| UNIQUE 約束與 `'*'` chatroom_id           | 全域封鎖與聊天室封鎖視為不同紀錄 | 設計合理：同一玩家可同時被全域封鎖與特定聊天室封鎖，業務上有意義 |
| IP 萬用字元格式驗證                       | 前後端 regex 不一致              | regex 定義在 `shared/schemas/blacklist.ts`，前後端共用同一規則   |
| ChatMonitoringPage 啟用封鎖按鈕後測試更新 | 原有 disabled 測試需更新         | Task 4.6t 明確包含更新 ChatMonitoringPage 測試                   |
| upsert 邏輯中的 race condition            | 極低概率重複插入                 | Demo 環境單用戶，不構成問題；SQLite 行鎖保護                     |
| `req.path.includes('/ip')` 判斷 blockType | 路由路徑變更時邏輯失效           | 集中在 controller 一處，搭配明確路由定義，修改時易發現           |

---

## 8. 完成標準

- [ ] `blacklist` migration 正常執行，DB 表結構正確
- [ ] UNIQUE(block_type, target, chatroom_id) 約束有效
- [ ] Seed data 正常載入（5 筆 player + 3 筆 IP）
- [ ] `GET /api/blacklist/player` 回傳分頁玩家黑名單
- [ ] `GET /api/blacklist/ip` 回傳分頁 IP 封鎖列表
- [ ] `POST /api/blacklist/player` 封鎖成功（201）
- [ ] `POST /api/blacklist/player` 重複封鎖回 409 `BLACKLIST_ALREADY_BLOCKED`
- [ ] `POST /api/blacklist/player` 重新封鎖已解封玩家（清除 deleted_at）
- [ ] `DELETE /api/blacklist/player/:id` 解封成功（軟刪除）
- [ ] `POST /api/blacklist/ip` IP 格式驗證（精確 IP 和萬用字元格式通過，非法格式 400）
- [ ] 所有封鎖/解封操作自動寫入 operation_logs
- [ ] 前端 BlacklistPage 正確顯示列表、切換 type、篩選、解封
- [ ] 前端 CreateBlacklistModal 表單驗證正常
- [ ] ChatMonitoringPage「封鎖玩家」按鈕已啟用並可開啟 Modal
- [ ] rfc_01 Route 權限對照表已同步更新
- [ ] Vitest 測試全部通過
