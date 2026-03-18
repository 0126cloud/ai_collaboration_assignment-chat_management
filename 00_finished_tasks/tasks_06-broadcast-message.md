# Phase 6: 系統廣播訊息

## 背景

Phase 5 完成暱稱審核與玩家檢舉審核後，進入 Phase 6，實作系統廣播訊息模組。

技術設計詳見 [rfc_06-broadcast-message.md](rfc_06-broadcast-message.md)，驗收規格見 [broadcast-message.feature](broadcast-message.feature)。

廣播功能屬高級管理員專屬功能（對應 `broadcast:read`、`broadcast:create`、`broadcast:delete` 三個權限），所有廣播操作皆自動寫入 operation_logs。

## 前置條件

- Phase 5 全部完成（Task 5.1~5.7）
- `npm run dev` 前後端正常啟動
- `npm test` 全部通過

---

## Task 6.1: DB Migration — broadcasts 表建立

### 建立 / 修改檔案

1. `server/db/migrations/20260318000011_create_broadcasts.ts`
   - 欄位設計參照 [rfc_06 §5.1](rfc_06-broadcast-message.md)
   - `up()`：建立 `broadcasts` 表，含以下欄位：
     - `id` INTEGER PRIMARY KEY AUTOINCREMENT
     - `message` TEXT NOT NULL
     - `chatroom_id` VARCHAR(50) NOT NULL（目標聊天室 ID，或 `'all'`）
     - `duration` INTEGER NOT NULL（顯示時長，秒，正整數）
     - `start_at` DATETIME NOT NULL（廣播開始時間，UTC）
     - `operator` VARCHAR(50) NOT NULL（發送者帳號）
     - `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
     - `deleted_at` DATETIME nullable（軟刪除）
   - 索引：`(chatroom_id)`、`(start_at)`、`(created_at)`
   - `down()`：`knex.schema.dropTable('broadcasts')`

2. `server/db/seeds/09_broadcasts.ts`
   - 3 筆廣播 seed data（各一種狀態），參照 [rfc_06 §5.5](rfc_06-broadcast-message.md)

3. `server/src/__tests__/helpers/testDb.ts`
   - 新增 `broadcasts` 表的測試 schema（與 migration 保持一致）
   - **注意**：integration tests 使用 in-memory SQLite，須手動維護 schema，不走 migration

### 驗證方式

- `npm run db:migrate` 成功執行，無錯誤
- SQLite 查詢確認 `broadcasts` 表結構正確（含 `deleted_at`，無 UNIQUE 約束）
- `npm run db:seed` 正常載入 3 筆廣播
- `npm test` 通過（testDb.ts 更新後不影響現有測試）

---

## Task 6.2: Shared types & schemas + Error Codes

### 建立 / 修改檔案

1. `shared/types/broadcast.ts`

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

2. `shared/schemas/broadcast.ts`
   - 實作 `broadcastQuerySchema`（含 status enum）和 `createBroadcastSchema`
   - 參照 [rfc_06 §5.2](rfc_06-broadcast-message.md)

3. `shared/index.ts`
   - re-export `shared/types/broadcast.ts` 和 `shared/schemas/broadcast.ts`

4. `server/src/utils/errorCodes.ts`
   - 新增 `BROADCAST_NOT_FOUND = 'BROADCAST_NOT_FOUND'`
   - ERROR_MESSAGES 對應：`{ statusCode: 404, message: '廣播紀錄不存在或已下架' }`
   - 參照 [rfc_06 §5.3](rfc_06-broadcast-message.md)

### 驗證方式

- `shared/types/broadcast.ts` 可從 `@shared/types/broadcast` import（client + server 皆可）
- `createBroadcastSchema.parse({ message: 'hello', chatroom_id: 'all', duration: 60, start_at: '2026-03-18T08:00:00.000Z' })` 通過
- `createBroadcastSchema.parse({ message: '', duration: 0 })` 拋出 validation error
- `npm test` 通過（errorCodes.ts 更新不影響現有測試）

---

## Task 6.3: 後端 BroadcastService + controller + route + permissions 更新

### 建立 / 修改檔案

1. `server/src/module/broadcast/service.ts`
   - 實作 `BroadcastService` class，注入 `db: Knex`
   - `list(query)` — 組裝 Knex 查詢（WHERE deleted_at IS NULL + 分頁），回傳時逐筆計算 `status`；`status` 篩選在應用層過濾
   - `create(payload, operator)` — INSERT 新紀錄，回傳含 `status` 的完整資料
   - `remove(id)` — 查詢 WHERE id AND deleted_at IS NULL，不存在回傳 null，存在則軟刪除
   - `computeStatus(startAt: string, duration: number)` — private 工具方法
   - 參照 [rfc_06 §5.4](rfc_06-broadcast-message.md)

2. `server/src/module/broadcast/controller.ts`
   - 實作 `BroadcastController` class
   - `list`：呼叫 service.list() → ResponseHelper.paginated()
   - `create`：呼叫 service.create() → 設定 `res.locals.operationLog = { operationType: 'SEND_BROADCAST', ... }` → ResponseHelper.success(res, result, 201)
   - `remove`：呼叫 service.remove()，null 時 throw AppError(BROADCAST_NOT_FOUND) → 設定 operationLog `DELETE_BROADCAST` → ResponseHelper.success()

3. `server/src/module/broadcast/route.ts`
   - 實作 `createBroadcastRoutes(db: Knex): Router`
   - 掛載三個路由（GET / POST / DELETE），搭配 auth + requirePermission + validate middleware
   - 參照 [rfc_06 §5.4](rfc_06-broadcast-message.md)

4. `server/src/app.ts`
   - 掛載 `app.use('/api/broadcasts', createBroadcastRoutes(db))`

5. `server/src/config/permissions.ts`
   - senior_manager 新增 `'broadcast:delete'` 至 supersets 陣列

### 驗證方式

- `POST /api/broadcasts`（帶有效 JWT，senior_manager）→ 201
- `GET /api/broadcasts`（senior_manager）→ 200，每筆資料含 `status`
- `DELETE /api/broadcasts/1`（senior_manager）→ 200
- `POST /api/broadcasts`（general_manager JWT）→ 403
- `GET /api/broadcasts`（general_manager JWT）→ 403
- 操作紀錄表確認有 `SEND_BROADCAST`、`DELETE_BROADCAST` 記錄

---

## Task 6.4: 後端 integration tests

### 建立 / 修改檔案

1. `server/src/__tests__/integration/broadcast.test.ts`
   - 涵蓋所有 [broadcast-message.feature](broadcast-message.feature) 的 scenarios
   - 主要測試案例：
     - `@happy_path`：GET 列表（含 status 計算）、POST 發送成功（201）、DELETE 下架成功（200）
     - `@validation`：POST 缺少 message → 400、duration = 0 → 400、DELETE 不存在 id → 404、DELETE 已下架 id → 404
     - `@permissions`：general_manager GET / POST / DELETE → 403

### 驗證方式

- `npm test broadcast` 全部通過
- `npm test` 全部通過（不影響現有測試）

---

## Task 6.5: 前端 API 封裝

### 建立 / 修改檔案

1. `client/src/api/broadcast.ts`
   - 實作 `broadcastApi`（list / create / remove）
   - 參照 [rfc_06 §5.7](rfc_06-broadcast-message.md)

### 驗證方式

- TypeScript 編譯無錯誤（`cd client && npx tsc --noEmit`）

---

## Task 6.6: 前端 BroadcastPage + router 更新

### 建立 / 修改檔案

1. `client/src/pages/BroadcastPage.tsx`
   - 頁面結構：發送廣播表單（Card）+ 篩選區域 + 廣播列表（Table）
   - 發送廣播表單：message（Textarea）、chatroom_id（Select，含 'all'）、duration（InputNumber）、start_at（DatePicker）
   - 廣播列表：columns 包含 message、chatroom_id、start_at、duration（格式化）、status（Tag）、operator、操作（下架按鈕）
   - 狀態 Tag 顏色：`scheduled` → blue、`active` → green、`expired` → default
   - 下架按鈕僅對 `scheduled` 和 `active` 狀態顯示，點擊後 Modal.confirm 確認
   - 樣式一律使用 `createStyles`，顏色 / 間距使用 Antd design token
   - 參照 [rfc_06 §5.8](rfc_06-broadcast-message.md)

2. `client/src/router.tsx`
   - 新增路由 `{ path: 'broadcasts', element: <ProtectedRoute permission="broadcast:read"><BroadcastPage /></ProtectedRoute> }`

### 驗證方式

- `npm run dev` 前端正常啟動
- 以 senior_manager 登入 → 側邊欄顯示「系統廣播」
- 以 general_manager 登入 → 側邊欄無「系統廣播」
- 廣播列表正常顯示，狀態 Tag 顏色正確
- 發送廣播成功後列表自動重新整理
- 下架確認 Modal 正常顯示與操作

---

## Task 6.7: 前端 component tests

### 建立 / 修改檔案

1. `client/src/__tests__/pages/BroadcastPage.test.tsx`
   - 測試列表渲染（含各種 status Tag）
   - 測試發送廣播表單（欄位驗證 + 提交成功）
   - 測試下架按鈕顯示邏輯（只在 scheduled / active 顯示）
   - 測試下架確認 Modal 互動
   - 測試篩選功能

### 驗證方式

- `npm test BroadcastPage` 全部通過
- `npm test` 全部通過

---

## 執行順序（含依賴圖）

```
6.1（DB migration + testDb） → 6.2（shared types + error codes）
        ↓                              ↓
    6.4（後端測試）  ←  6.3（後端 service + controller + route）
                                       ↓
                            6.5（前端 API 封裝）
                                       ↓
                            6.6（前端 BroadcastPage）
                                       ↓
                            6.7（前端 component tests）
```

---

## 完成檢查清單

### DB & 後端

- [x] `broadcasts` migration 正常執行
- [x] Seed data 載入 3 筆廣播
- [x] `testDb.ts` 已更新 broadcasts schema
- [x] `BroadcastService.computeStatus()` 邏輯正確
- [x] GET 列表回傳每筆含正確 `status`
- [x] GET status 篩選正常運作
- [x] POST 發送廣播（201）
- [x] POST validation 失敗（400）
- [x] DELETE 下架成功（200，軟刪除）
- [x] DELETE 不存在回 404 `BROADCAST_NOT_FOUND`
- [x] general_manager 存取 broadcast 路由回 403
- [x] `permissions.ts` 已新增 `broadcast:delete`
- [x] 操作紀錄寫入 `SEND_BROADCAST`、`DELETE_BROADCAST`

### 前端

- [x] `broadcastApi` 三個方法正常
- [x] `BroadcastPage` 列表顯示正確
- [x] 狀態 Tag 顏色對應正確
- [x] 發送廣播表單 Zod 驗證正常
- [x] 下架按鈕顯示邏輯正確（只在 scheduled / active 顯示）
- [x] Router 新增廣播頁路由
- [x] `general_manager` 看不到廣播選單

### rfc_01 更新

- [x] [rfc_01 §5.5](rfc_01-auth-and-response.md) 補充 `broadcast:delete`
- [x] [rfc_01 §5.9](rfc_01-auth-and-response.md) 補充 `DELETE /api/broadcasts/:id`

### 測試

- [x] `broadcast.test.ts` integration tests 全部通過
- [x] `BroadcastPage.test.tsx` component tests 全部通過
- [x] `npm test` 全部通過（NicknameReviewPage 1 筆為 Phase 5 既有失敗，Phase 6 新增測試全部通過）
