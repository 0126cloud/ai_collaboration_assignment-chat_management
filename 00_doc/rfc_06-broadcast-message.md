# RFC: 系統廣播訊息

## 1. 背景

Phase 5（[rfc_05](rfc_05-nickname-and-report.md)）已完成暱稱審核與玩家檢舉審核模組。現進入 Phase 6，實作系統廣播訊息模組。

廣播功能已在 [prd_00 §3.7](prd_00-chat_management_backstage.md) 與 FR-015、FR-016 中定義，允許高級管理員向指定聊天室或全部聊天室發送廣播訊息，並可設定顯示時長。

[rfc_01 §5.5](rfc_01-auth-and-response.md) 已預先定義 `broadcast:read` 與 `broadcast:create` 兩個權限，[rfc_01 §5.9](rfc_01-auth-and-response.md) 已預先規劃 `GET /api/broadcasts` 與 `POST /api/broadcasts` 路由。本 RFC 補充完整技術設計，並新增 `broadcast:delete` 權限與 `DELETE /api/broadcasts/:id` 路由。

**範圍界定**：本 RFC 涵蓋 1 個 migration（`broadcasts` 表）、3 支 API（GET / POST / DELETE）、1 個前端頁面（`BroadcastPage`）。不含 WebSocket 即時推播（依 [prd_00 §6](prd_00-chat_management_backstage.md) Non-Goals）。

---

## 2. 目標

- 建立 `broadcasts` 資料表
- 建立 `GET /api/broadcasts` API（廣播列表）
- 建立 `POST /api/broadcasts` API（發送廣播）
- 建立 `DELETE /api/broadcasts/:id` API（下架廣播）
- 廣播狀態（`scheduled` / `active` / `expired`）由後端計算後回傳，前端直接顯示
- 建立前端 `BroadcastPage`（廣播列表 + 發送表單）
- 操作紀錄自動寫入（`SEND_BROADCAST`、`DELETE_BROADCAST`）
- 更新 [rfc_01](rfc_01-auth-and-response.md) 新增 `broadcast:delete` 權限

---

## 3. 提案

### 3.1 DB Schema 設計

新增 1 張資料表：

| 表名         | 說明                       | PK 型別               |
| ------------ | -------------------------- | --------------------- |
| `broadcasts` | 廣播訊息紀錄（含發送結果） | INTEGER AUTOINCREMENT |

### 3.2 廣播狀態計算邏輯

狀態為計算欄位，不存入 DB，由後端在查詢時計算後附加至回應。

| 狀態   | 英文        | 計算條件                                             |
| ------ | ----------- | ---------------------------------------------------- |
| 未開始 | `scheduled` | `start_at > now()`                                   |
| 廣播中 | `active`    | `start_at <= now()` 且 `start_at + duration > now()` |
| 已過期 | `expired`   | `start_at + duration <= now()`                       |

> `now()` 以後端伺服器時間（UTC）為準。`duration` 單位為秒。

軟刪除（`deleted_at IS NOT NULL`）的廣播不在列表中顯示；下架操作等同提前結束廣播。

### 3.3 API URL 設計

沿用 [rfc_01 §5.9](rfc_01-auth-and-response.md) 已規劃的路徑，補充 DELETE：

| API                          | Permission         | 說明               |
| ---------------------------- | ------------------ | ------------------ |
| `GET /api/broadcasts`        | `broadcast:read`   | 廣播列表（含狀態） |
| `POST /api/broadcasts`       | `broadcast:create` | 發送廣播           |
| `DELETE /api/broadcasts/:id` | `broadcast:delete` | 下架廣播（軟刪除） |

### 3.4 `chatroom_id = 'all'` 語意設計

`chatroom_id` 欄位使用字串 `'all'` 表示向所有聊天室廣播，而非 NULL。

原因：

- 沿用 [rfc_04](rfc_04-blacklist-and-ip-blocking.md) 的 `chatroom_id = '*'` 全域封鎖設計經驗
- 字串值可直接顯示在 UI，`'all'` 比 `NULL` 或 `'*'` 語意更清晰
- 避免 UNIQUE 約束在 SQLite 中對 NULL 值的特殊行為

### 3.5 新增 `broadcast:delete` 權限

原 [rfc_01 §5.5](rfc_01-auth-and-response.md) 僅列 `broadcast:read` 與 `broadcast:create`，本 RFC 補充 `broadcast:delete`：

| Category  | Permission Code    | 說明         | General Mgr | Senior Mgr |
| --------- | ------------------ | ------------ | :---------: | :--------: |
| broadcast | `broadcast:read`   | 查看廣播紀錄 |             |     v      |
| broadcast | `broadcast:create` | 發送廣播訊息 |             |     v      |
| broadcast | `broadcast:delete` | 下架廣播訊息 |             |     v      |

**需同步更新**（詳見 §5.9）：

- [rfc_01 §5.5](rfc_01-auth-and-response.md) 權限矩陣
- [rfc_01 §5.9](rfc_01-auth-and-response.md) Route 權限對照表
- `server/src/config/permissions.ts`（senior_manager 新增 `broadcast:delete`）

---

## 4. 高層設計

### 4.1 新增 / 修改檔案結構

```
chat-management/
├── server/
│   ├── db/
│   │   ├── migrations/
│   │   │   └── 20260318000011_create_broadcasts.ts     # [新增]
│   │   └── seeds/
│   │       └── 09_broadcasts.ts                        # [新增]
│   └── src/
│       ├── app.ts                                      # [修改] 掛載 broadcast routes
│       ├── utils/
│       │   └── errorCodes.ts                           # [修改] 新增 BROADCAST_NOT_FOUND
│       ├── config/
│       │   └── permissions.ts                          # [修改] 新增 broadcast:delete
│       └── module/
│           └── broadcast/
│               ├── controller.ts                       # [新增]
│               ├── service.ts                          # [新增]
│               └── route.ts                            # [新增]
├── client/
│   └── src/
│       ├── api/
│       │   └── broadcast.ts                            # [新增]
│       ├── pages/
│       │   └── BroadcastPage.tsx                       # [新增]
│       └── router.tsx                                  # [修改] 新增路由
└── shared/
    ├── schemas/
    │   └── broadcast.ts                                # [新增]
    ├── types/
    │   └── broadcast.ts                                # [新增]
    └── index.ts                                        # [修改] re-export
```

---

## 5. 詳細設計

### 5.1 DB Schema — broadcasts 表

**Migration**（`server/db/migrations/20260318000011_create_broadcasts.ts`）：

| 欄位        | 型別                               | 說明                                    |
| ----------- | ---------------------------------- | --------------------------------------- |
| id          | INTEGER PRIMARY KEY AUTOINCREMENT  |                                         |
| message     | TEXT NOT NULL                      | 廣播訊息內容                            |
| chatroom_id | VARCHAR(50) NOT NULL               | 目標聊天室 ID，或 `'all'`（全部聊天室） |
| duration    | INTEGER NOT NULL                   | 顯示時長（秒），需為正整數              |
| start_at    | DATETIME NOT NULL                  | 廣播開始時間（UTC）                     |
| operator    | VARCHAR(50) NOT NULL               | 發送者帳號（冗餘欄位，方便查詢顯示）    |
| created_at  | DATETIME DEFAULT CURRENT_TIMESTAMP |                                         |
| deleted_at  | DATETIME nullable                  | 軟刪除標記（下架時間）                  |

**索引**：`(chatroom_id)`、`(start_at)`、`(created_at)`

**軟刪除策略**：

- `deleted_at IS NULL` → 有效廣播
- `deleted_at IS NOT NULL` → 已下架
- 所有 GET API 預設加上 `WHERE deleted_at IS NULL` 條件

### 5.2 Shared types & schemas

**`shared/types/broadcast.ts`**：

```ts
export type TBroadcastStatus = 'scheduled' | 'active' | 'expired';

export type TBroadcastItem = {
  id: number;
  message: string;
  chatroom_id: string;
  duration: number;
  start_at: string;
  operator: string;
  created_at: string;
  status: TBroadcastStatus;
};

export type TBroadcastQuery = {
  chatroom_id?: string;
  status?: TBroadcastStatus;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
};

export type TCreateBroadcastPayload = {
  message: string;
  chatroom_id: string;
  duration: number;
  start_at: string;
};
```

**`shared/schemas/broadcast.ts`**：

```ts
import { z } from 'zod';

export const broadcastQuerySchema = z.object({
  chatroom_id: z.string().optional(),
  status: z.enum(['scheduled', 'active', 'expired']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const createBroadcastSchema = z.object({
  message: z.string().min(1, '請輸入廣播訊息').max(500, '廣播訊息最多 500 字'),
  chatroom_id: z.string().min(1, '請選擇目標聊天室'),
  duration: z
    .number()
    .int()
    .min(1, '顯示時長至少 1 秒')
    .max(86400, '顯示時長最多 86400 秒（24 小時）'),
  start_at: z.string().datetime({ message: '開始時間格式不正確' }),
});
```

**`shared/index.ts`** — re-export 所有新增的 types 和 schemas。

### 5.3 新增 Error Codes

**`server/src/utils/errorCodes.ts`**：

```ts
BROADCAST_NOT_FOUND = 'BROADCAST_NOT_FOUND',
```

**ERROR_MESSAGES**：

```ts
[ErrorCode.BROADCAST_NOT_FOUND]: { statusCode: 404, message: '廣播紀錄不存在或已下架' },
```

### 5.4 後端 BroadcastService + controller + route

#### 狀態計算工具

後端在 service 層統一計算 `status`：

```ts
function computeStatus(startAt: string, duration: number): TBroadcastStatus {
  const now = Date.now();
  const start = new Date(startAt).getTime();
  const end = start + duration * 1000;
  if (now < start) return 'scheduled';
  if (now < end) return 'active';
  return 'expired';
}
```

#### service.ts（`server/src/module/broadcast/service.ts`）

- `list(query: TBroadcastQuery)` — 組裝 Knex 查詢（`WHERE deleted_at IS NULL` + 多條件 + 分頁），回傳時逐筆計算 `status` 並附加
- `create(payload: TCreateBroadcastPayload, operator: string)` — INSERT 新紀錄，回傳含 `status` 的完整資料
- `remove(id: number)` — 查詢 `WHERE id = :id AND deleted_at IS NULL`，不存在回傳 null，存在則 `UPDATE SET deleted_at = CURRENT_TIMESTAMP`

#### controller.ts（`server/src/module/broadcast/controller.ts`）

- `list(req, res, next)` — 呼叫 service.list() → `ResponseHelper.paginated()`
- `create(req, res, next)` — 呼叫 service.create() → 設定 `res.locals.operationLog` → `ResponseHelper.success(res, result, 201)`
- `remove(req, res, next)` — 呼叫 service.remove()，null 時 throw `AppError(BROADCAST_NOT_FOUND)` → 設定 `res.locals.operationLog` → `ResponseHelper.success()`

#### route.ts（`server/src/module/broadcast/route.ts`）

```ts
export function createBroadcastRoutes(db: Knex): Router {
  const router = Router();
  const service = new BroadcastService(db);
  const controller = new BroadcastController(service);

  router.get('/', auth, requirePermission('broadcast:read'), controller.list);
  router.post(
    '/',
    auth,
    requirePermission('broadcast:create'),
    validate(createBroadcastSchema),
    controller.create,
  );
  router.delete('/:id', auth, requirePermission('broadcast:delete'), controller.remove);

  return router;
}
```

**掛載**（`server/src/app.ts`）：

```ts
app.use('/api/broadcasts', createBroadcastRoutes(db));
```

#### operationType 對應

| 操作   | operationType      |
| ------ | ------------------ |
| create | `SEND_BROADCAST`   |
| remove | `DELETE_BROADCAST` |

### 5.5 Seed 資料

**檔案**：`server/db/seeds/09_broadcasts.ts`

3 筆廣播，各對應一種狀態：

| message                              | chatroom_id  | duration | start_at（相對）               | 預期狀態    |
| ------------------------------------ | ------------ | -------- | ------------------------------ | ----------- |
| System maintenance in 10 minutes     | all          | 600      | 2026-03-18 08:00:00（未來）    | `scheduled` |
| Welcome bonus event is now live!     | baccarat_001 | 3600     | 2026-03-17 12:00:00（過去 1h） | `active`    |
| Server update completed successfully | all          | 300      | 2026-03-16 00:00:00（過去）    | `expired`   |

> Seed 時間為絕對時間，actual status 取決於執行時間，以 service 計算為準。

### 5.6 API 規格

#### GET `/api/broadcasts`

- **需認證**：`auth` middleware
- **需權限**：`broadcast:read`
- **Query Parameters**：

| 參數        | 型別   | 必填 | 說明                          | 預設值 |
| ----------- | ------ | ---- | ----------------------------- | ------ |
| chatroom_id | string | 否   | 聊天室 ID（精確比對）         | —      |
| status      | string | 否   | 廣播狀態篩選（計算後過濾）    | —      |
| startDate   | string | 否   | 發送起始日期（UTC, ISO 8601） | —      |
| endDate     | string | 否   | 發送結束日期（UTC, ISO 8601） | —      |
| page        | number | 否   | 頁碼                          | 1      |
| pageSize    | number | 否   | 每頁筆數                      | 20     |

- **篩選邏輯**：
  - 固定加 `WHERE deleted_at IS NULL`
  - `status` 篩選：先取回資料後，service 層依 `computeStatus` 結果過濾（非 DB 層過濾）
  - `chatroom_id` 精確比對
  - `startDate` / `endDate` 對應 `created_at` 範圍
  - 排序：`ORDER BY created_at DESC`

- **Response 200**：

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "message": "System maintenance in 10 minutes",
      "chatroom_id": "all",
      "duration": 600,
      "start_at": "2026-03-18T08:00:00.000Z",
      "operator": "admin01",
      "created_at": "2026-03-18T07:50:00.000Z",
      "status": "scheduled"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 3,
    "totalPages": 1
  }
}
```

#### POST `/api/broadcasts`

- **需認證**：`auth` middleware
- **需權限**：`broadcast:create`
- **Validation**：`createBroadcastSchema`（Zod）
- **Request Body**：

```json
{
  "message": "System maintenance in 10 minutes",
  "chatroom_id": "all",
  "duration": 600,
  "start_at": "2026-03-18T08:00:00.000Z"
}
```

- **行為**：INSERT 新紀錄，`operator` 從 `req.user.username` 取得；觸發操作紀錄 `SEND_BROADCAST`

- **Response 201**：

```json
{
  "success": true,
  "data": {
    "id": 4,
    "message": "System maintenance in 10 minutes",
    "chatroom_id": "all",
    "duration": 600,
    "start_at": "2026-03-18T08:00:00.000Z",
    "operator": "admin01",
    "created_at": "2026-03-18T07:50:00.000Z",
    "status": "scheduled"
  }
}
```

- **Error 400**：`VALIDATION_ERROR`（缺少必填欄位 / duration 非正整數 / 時間格式錯誤）
- **Error 403**：`FORBIDDEN_INSUFFICIENT_PERMISSIONS`（非 senior_manager）

#### DELETE `/api/broadcasts/:id`

- **需認證**：`auth` middleware
- **需權限**：`broadcast:delete`
- **路徑參數**：`id`（INTEGER）
- **行為**：
  - 查詢 `WHERE id = :id AND deleted_at IS NULL`
  - 不存在 → 404 `BROADCAST_NOT_FOUND`
  - 存在 → `UPDATE SET deleted_at = CURRENT_TIMESTAMP`
  - 觸發操作紀錄 `DELETE_BROADCAST`

- **Response 200**：

```json
{
  "success": true,
  "data": {
    "message": "廣播已下架"
  }
}
```

- **Error 404**：`BROADCAST_NOT_FOUND`

### 5.7 前端 API 封裝

**`client/src/api/broadcast.ts`**：

```ts
export const broadcastApi = {
  list: (params: TBroadcastQuery) =>
    client.get<TApiResponse<TBroadcastItem[]>>('/api/broadcasts', { params }),
  create: (data: TCreateBroadcastPayload) =>
    client.post<TApiResponse<TBroadcastItem>>('/api/broadcasts', data),
  remove: (id: number) => client.delete<TApiResponse<{ message: string }>>(`/api/broadcasts/${id}`),
};
```

### 5.8 前端 BroadcastPage

**檔案**：`client/src/pages/BroadcastPage.tsx`

**頁面結構**：

```
BroadcastPage
├── 發送廣播表單區域（Card，僅 senior_manager 顯示）
│   ├── Textarea — 廣播訊息內容（最多 500 字）
│   ├── Select — 目標聊天室（'all' 或選擇特定聊天室；從 chatrooms API 取得選項）
│   ├── InputNumber — 顯示時長（秒）
│   ├── DatePicker — 開始時間
│   └── Button — 發送廣播
├── 篩選區域
│   ├── Select — 狀態篩選（scheduled / active / expired）
│   ├── Select — 聊天室篩選
│   └── Button — 查詢 / 重置
└── 廣播列表（Table）
    ├── Column: 廣播內容（message，文字截斷）
    ├── Column: 目標聊天室（chatroom_id，'all' 顯示為「全部聊天室」）
    ├── Column: 開始時間（start_at — UTC+8 格式化）
    ├── Column: 時長（duration，秒 → 可讀格式，如 "10 分鐘"）
    ├── Column: 狀態（status — Tag 元件，含顏色語意）
    ├── Column: 發送者（operator）
    └── Column: 操作
        └── Button — 下架（僅 scheduled / active 狀態顯示，Modal.confirm 確認後呼叫 DELETE API）
    └── Pagination（pageSize=20）
```

**狀態 Tag 顏色對應**：

| 狀態        | Tag color | 顯示文字 |
| ----------- | --------- | -------- |
| `scheduled` | `blue`    | 未開始   |
| `active`    | `green`   | 廣播中   |
| `expired`   | `default` | 已過期   |

**樣式**：使用 `createStyles` 管理，顏色 / 間距使用 Antd design token。

**路由**（`client/src/router.tsx`）：

```tsx
{
  path: 'broadcasts',
  element: (
    <ProtectedRoute permission="broadcast:read">
      <BroadcastPage />
    </ProtectedRoute>
  ),
}
```

> Sidebar 的 `{ key: '/broadcasts', label: '系統廣播', permission: 'broadcast:read' }` 已在 [rfc_01 §5.10](rfc_01-auth-and-response.md) 規劃，無需額外修改 `AdminLayout.tsx`（確認 icon 已使用 `SoundOutlined`）。

### 5.9 rfc_01 更新對照

本 RFC 完成後，需同步更新 [rfc_01-auth-and-response.md](rfc_01-auth-and-response.md) 以下位置：

| 位置              | 更新內容                                                                           |
| ----------------- | ---------------------------------------------------------------------------------- |
| §5.5 權限矩陣     | 在 broadcast 區塊新增 `broadcast:delete`（senior_manager 有）                      |
| §5.9 Route 對照表 | 新增 `DELETE /api/broadcasts/:id`，permission = `broadcast:delete`，備注 = Phase 6 |

### 5.10 測試計畫

測試策略沿用 [rfc_00 §6](rfc_00-project_tech_stack.md)。

#### 測試檔案

| 層級        | 測試檔案                 | 測試目標                                                   |
| ----------- | ------------------------ | ---------------------------------------------------------- |
| Integration | `broadcast.test.ts`      | GET / POST / DELETE `/api/broadcasts` 完整 pipeline        |
| Component   | `BroadcastPage.test.tsx` | 頁面渲染、發送廣播表單、列表顯示、狀態 Tag、下架確認 Modal |

#### Integration test 重點

- `GET /api/broadcasts` — 回傳含正確 `status` 計算值的列表
- `POST /api/broadcasts` — 發送成功（201）
- `POST /api/broadcasts` — validation 失敗（400）
- `DELETE /api/broadcasts/:id` — 下架成功（200）
- `DELETE /api/broadcasts/:id` — 不存在或已下架（404）
- general_manager 存取 broadcast 路由 → 403

#### Gherkin Scenario 映射

| Gherkin Tag    | 對應測試檔案             |
| -------------- | ------------------------ |
| `@happy_path`  | `broadcast.test.ts`      |
| `@validation`  | `broadcast.test.ts`      |
| `@permissions` | `broadcast.test.ts`      |
| `@ui_only`     | `BroadcastPage.test.tsx` |

---

## 6. 風險與緩解

| 風險                               | 影響                                    | 緩解方式                                                                                |
| ---------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------- |
| `status` 計算依賴伺服器時間        | 前後端時區不一致導致狀態顯示差異        | `status` 由後端統一計算後回傳，前端直接顯示，不自行計算                                 |
| status 篩選在應用層而非 DB 層      | 資料量大時需取回全量後過濾，效能較差    | Demo 環境資料量小，可接受；正式環境可改為 DB 計算 status 或使用 Generated Column        |
| `start_at` 時區格式                | 前端傳 UTC 字串但 SQLite 儲存格式不一致 | Zod schema 限制 `datetime`（ISO 8601 UTC）；後端存入前不做轉換，以 ISO 8601 字串存入 DB |
| 發送廣播後 `start_at` 可為過去時間 | 可能立即顯示為 active 或 expired        | 為 Demo 目的允許此行為，未做業務驗證（不強制 start_at > now()）                         |

---

## 7. 完成標準

- [ ] `broadcasts` migration 正常執行，DB 表結構正確（含索引）
- [ ] Seed data 正常載入（3 筆廣播）
- [ ] `GET /api/broadcasts` 回傳分頁廣播列表，每筆含正確 `status` 計算值
- [ ] `GET /api/broadcasts` status 篩選正常運作
- [ ] `POST /api/broadcasts` 發送廣播成功（201）
- [ ] `POST /api/broadcasts` validation 失敗回 400（缺少 message / duration 非正整數 / 時間格式錯誤）
- [ ] `DELETE /api/broadcasts/:id` 下架成功（軟刪除）
- [ ] `DELETE /api/broadcasts/:id` 不存在回 404 `BROADCAST_NOT_FOUND`
- [ ] general_manager 存取 broadcast 路由一律回 403
- [ ] `permissions.ts` 已新增 `broadcast:delete` 至 senior_manager
- [ ] 發送廣播與下架廣播自動寫入 operation_logs
- [ ] 前端 BroadcastPage 正確顯示列表與狀態 Tag
- [ ] 前端發送廣播表單驗證正常（Zod schema）
- [ ] 前端下架廣播確認 Modal 正常
- [ ] [rfc_01](rfc_01-auth-and-response.md) §5.5 已更新（broadcast:delete）
- [ ] [rfc_01](rfc_01-auth-and-response.md) §5.9 已更新（DELETE 路由）
- [ ] Vitest 測試全部通過
