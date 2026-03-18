# Phase 3: 聊天室管理 + 聊天監控

## 背景

Phase 2 完成操作紀錄模組後，進入功能模組開發。本 Phase 涵蓋聊天室管理（唯讀列表）與聊天監控（訊息查看 / 搜尋 / 刪除）兩個模組，技術設計詳見 [rfc_03-chatroom-and-chat.md](rfc_03-chatroom-and-chat.md)，驗收規格見 [chatroom-management.feature](chatroom-management.feature) 與 [chat-monitoring.feature](chat-monitoring.feature)。

## 前置條件

- Phase 2 全部完成（Task 2.1~2.6）
- `npm run dev` 前後端正常啟動
- `npm test` 全部通過

---

## Task 3.1: DB Migrations（4 張表）

建立 4 張資料表，所有表皆含 `deleted_at` 軟刪除欄位。

**建立檔案：**

1. `server/db/migrations/20260317000002_create_chatrooms.ts`
   - `id` VARCHAR(50) PRIMARY KEY（業務 ID，如 `baccarat_001`）
   - `name` VARCHAR(100) NOT NULL
   - `online_user_count` INTEGER DEFAULT 0
   - `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
   - `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP
   - `deleted_at` DATETIME nullable
   - 索引：`name`
   - 參照 [rfc_03 §5.1](rfc_03-chatroom-and-chat.md)

2. `server/db/migrations/20260317000003_create_players.ts`
   - `username` VARCHAR(50) PRIMARY KEY
   - `nickname` VARCHAR(50) NOT NULL
   - `nickname_approved` BOOLEAN DEFAULT true
   - `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
   - `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP
   - `deleted_at` DATETIME nullable
   - 參照 [rfc_03 §5.2](rfc_03-chatroom-and-chat.md)

3. `server/db/migrations/20260317000004_create_chatroom_players.ts`
   - `id` INTEGER PRIMARY KEY AUTOINCREMENT
   - `chatroom_id` VARCHAR(50) NOT NULL
   - `player_username` VARCHAR(50) NOT NULL
   - UNIQUE(`chatroom_id`, `player_username`)
   - `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
   - `deleted_at` DATETIME nullable
   - 索引：`chatroom_id`、`player_username`
   - 參照 [rfc_03 §5.3](rfc_03-chatroom-and-chat.md)

4. `server/db/migrations/20260317000005_create_chat_messages.ts`
   - `id` INTEGER PRIMARY KEY AUTOINCREMENT
   - `chatroom_id` VARCHAR(50) NOT NULL
   - `player_username` VARCHAR(50) NOT NULL
   - `player_nickname` VARCHAR(50) NOT NULL
   - `message` TEXT NOT NULL
   - `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
   - `deleted_at` DATETIME nullable
   - 索引：`chatroom_id`、`player_username`、`created_at`
   - 參照 [rfc_03 §5.4](rfc_03-chatroom-and-chat.md)

**修改檔案：**

5. `server/src/__tests__/helpers/testDb.ts`
   - 新增 4 張表的測試 schema

### 驗證方式

- `npm run db:migrate` 成功建立 4 張表
- SQLite 查詢確認欄位正確、索引已建立
- 每張表皆有 `deleted_at` 欄位

---

## Task 3.2: Seed Data

建立聊天室、玩家、聊天室玩家關聯、聊天訊息的 mock data。

**建立檔案：**

1. `server/db/seeds/03_chatrooms.ts`
   - 5 筆聊天室（baccarat_001、baccarat_002、blackjack_001、roulette_001、slots_001）
   - 參照 [rfc_03 §5.10](rfc_03-chatroom-and-chat.md)

2. `server/db/seeds/04_players.ts`
   - 15~20 筆玩家
   - 大部分 `nickname_approved = true`，少數 `false`（為後續暱稱審核準備）

3. `server/db/seeds/05_chatroom_players.ts`
   - 將玩家分配至聊天室，每個聊天室 5~10 位玩家

4. `server/db/seeds/06_chat_messages.ts`
   - 50~100 筆訊息，分佈在 5 個聊天室
   - 模擬真實遊戲對話（下注、祝賀、閒聊等正向內容）
   - 時間分佈在近 7 天內
   - 包含 2~3 筆 `deleted_at IS NOT NULL` 的已刪除訊息

### 驗證方式

- `npm run db:seed` 成功插入所有 mock data
- 聊天室 5 筆、玩家 15~20 筆、訊息 50~100 筆
- 已刪除訊息正確標記 `deleted_at`

---

## Task 3.3: Shared types / schemas

建立前後端共用的型別定義與 Zod schema。

**建立檔案：**

1. `shared/types/chatroom.ts`
   - `TChatroomItem` — 聊天室列表項目型別
   - `TChatroomQuery` — 查詢參數型別
   - 參照 [rfc_03 §5.13](rfc_03-chatroom-and-chat.md)

2. `shared/types/chatMessage.ts`
   - `TChatMessageItem` — 訊息列表項目型別
   - `TChatMessageQuery` — 查詢參數型別
   - 參照 [rfc_03 §5.13](rfc_03-chatroom-and-chat.md)

3. `shared/schemas/chatroom.ts`
   - `chatroomQuerySchema` — Zod schema（name optional、page >= 1、pageSize 1~100 default 30）

4. `shared/schemas/chatMessage.ts`
   - `chatMessageQuerySchema` — Zod schema（多條件 optional、page >= 1、pageSize 1~100 default 30）

**修改檔案：**

5. `shared/index.ts`
   - re-export 所有新增的 types 和 schemas

### 驗證方式

- TypeScript 編譯正常（client 和 server 皆能 import）
- Zod schema 正確驗證（page 負數 → error、pageSize default 30）

---

## Task 3.4: 後端 chatroom module（GET /api/chatrooms）

建立聊天室列表 API。

**建立檔案：**

1. `server/src/module/chatroom/service.ts`
   - `list(query)` — 組裝 Knex 查詢（name/id LIKE + 分頁 + WHERE deleted_at IS NULL）
   - 參照 [rfc_03 §5.8](rfc_03-chatroom-and-chat.md)

2. `server/src/module/chatroom/controller.ts`
   - `list(req, res, next)` — 驗證 query params（chatroomQuerySchema）→ 呼叫 service → ResponseHelper.paginated()

3. `server/src/module/chatroom/route.ts`
   - `GET /` — `auth` → `requirePermission('chatroom:read')` → `controller.list`
   - export `createChatroomRoutes(db: Knex): Router`

**修改檔案：**

4. `server/src/app.ts`
   - 掛載 `app.use('/api/chatrooms', createChatroomRoutes(db))`

### 驗證方式

```bash
# 查詢所有聊天室
curl -b cookies.txt http://localhost:3000/api/chatrooms
# 預期：5 筆聊天室，pageSize=30

# 搜尋名稱
curl -b cookies.txt "http://localhost:3000/api/chatrooms?name=Baccarat"
# 預期：2 筆（baccarat_001、baccarat_002）

# 搜尋 ID
curl -b cookies.txt "http://localhost:3000/api/chatrooms?name=blackjack_001"
# 預期：1 筆
```

對應 Gherkin：`chatroom-management.feature` `@happy_path` 全系列

### Task 3.4t: Integration Tests — chatroom API

**建立** `server/src/__tests__/integration/chatroom.list.test.ts`

**測試案例：**

- 預設分頁查詢 → 200 + 資料 + pagination（pageSize=30）（`@happy_path`）
- 自訂 page/pageSize → 正確分頁（`@happy_path`）
- 搜尋 name → 回傳名稱包含關鍵字的聊天室（`@happy_path`）
- 搜尋 ID → 回傳 ID 包含關鍵字的聊天室（`@happy_path`）
- 搜尋無結果 → 200 + 空陣列 + total 0（`@validation`）
- page 為負數 → 400 VALIDATION_ERROR（`@validation`）
- general_manager → 200（`@permissions`）
- senior_manager → 200（`@permissions`）
- 未帶 token → 401（`@permissions`）
- 已軟刪除的聊天室不出現在列表中

---

## Task 3.5: 後端 chatMessage module（GET + DELETE /api/chat_messages）

建立聊天訊息查詢與刪除 API。

**建立檔案：**

1. `server/src/module/chatMessage/service.ts`
   - `list(query)` — 組裝 Knex 查詢（多條件篩選 + 分頁 + WHERE deleted_at IS NULL + ORDER BY created_at DESC）
   - `remove(id)` — 軟刪除（UPDATE deleted_at）。找不到或已刪除 → 拋出 AppError
   - 參照 [rfc_03 §5.9](rfc_03-chatroom-and-chat.md)

2. `server/src/module/chatMessage/controller.ts`
   - `list(req, res, next)` — 驗證 query params（chatMessageQuerySchema）→ 呼叫 service → ResponseHelper.paginated()
   - `remove(req, res, next)` — 呼叫 service.remove() → 設定 `res.locals.operationLog = { operationType: 'DELETE_MESSAGE' }` → ResponseHelper.success()

3. `server/src/module/chatMessage/route.ts`
   - `GET /` — `auth` → `requirePermission('chat:read')` → `controller.list`
   - `DELETE /:id` — `auth` → `requirePermission('chat:delete')` → `controller.remove`
   - export `createChatMessageRoutes(db: Knex): Router`

**修改檔案：**

4. `server/src/app.ts`
   - 掛載 `app.use('/api/chat_messages', createChatMessageRoutes(db))`

5. `server/src/utils/errorCodes.ts`
   - 新增 `CHAT_MESSAGE_NOT_FOUND`（404, '訊息不存在或已刪除'）

### 驗證方式

```bash
# 查詢所有訊息
curl -b cookies.txt http://localhost:3000/api/chat_messages
# 預期：分頁訊息列表（不含已軟刪除）

# 篩選聊天室
curl -b cookies.txt "http://localhost:3000/api/chat_messages?chatroomId=baccarat_001"

# 刪除訊息
curl -X DELETE -b cookies.txt http://localhost:3000/api/chat_messages/1
# 預期：200 + 訊息已刪除

# 重複刪除
curl -X DELETE -b cookies.txt http://localhost:3000/api/chat_messages/1
# 預期：404 CHAT_MESSAGE_NOT_FOUND
```

對應 Gherkin：`chat-monitoring.feature` `@happy_path`、`@soft_delete` 全系列

### Task 3.5t: Integration Tests — chatMessage API

**建立** `server/src/__tests__/integration/chatMessage.list.test.ts`

**測試案例：**

- 預設分頁查詢 → 200 + 資料 + pagination（pageSize=30）（`@happy_path`）
- 自訂 page/pageSize → 正確分頁（`@happy_path`）
- 篩選 chatroomId → 僅回傳該聊天室訊息（`@happy_path`）
- 篩選 playerUsername → 僅回傳該玩家訊息（`@happy_path`）
- 篩選 playerNickname（模糊搜尋）→ 回傳匹配結果（`@happy_path`）
- 篩選 message（模糊搜尋）→ 回傳匹配結果（`@happy_path`）
- 篩選 startDate + endDate → 回傳範圍內訊息（`@happy_path`）
- 複合條件篩選 → 同時滿足（`@happy_path`）
- 紀錄依 created_at 降冪排列（`@happy_path`）
- 無結果 → 200 + 空陣列 + total 0（`@validation`）
- page 為負數 → 400 VALIDATION_ERROR（`@validation`）
- general_manager → 200（`@permissions`）
- senior_manager → 200（`@permissions`）
- 未帶 token → 401（`@permissions`）
- 已軟刪除的訊息不出現在列表中（`@soft_delete`）

**建立** `server/src/__tests__/integration/chatMessage.delete.test.ts`

**測試案例：**

- 刪除未刪除的訊息 → 200（`@happy_path`）
- 刪除後該訊息不出現在 GET 列表（`@soft_delete`）
- 刪除後 operation_logs 有 DELETE_MESSAGE 紀錄（`@soft_delete`）
- 重複刪除已刪除訊息 → 404 CHAT_MESSAGE_NOT_FOUND（`@soft_delete`）
- 刪除不存在的訊息 → 404（`@validation`）
- general_manager 可刪除 → 200（`@permissions`）
- 未帶 token → 401（`@permissions`）

---

## Task 3.6: 前端 ChatroomPage

建立聊天室列表頁面。

**建立檔案：**

1. `client/src/api/chatroom.ts`
   - `chatroomApi.list(params)` — GET /api/chatrooms
   - 使用 `@shared/types/chatroom` 型別

2. `client/src/pages/ChatroomPage.tsx`
   - 篩選區域（Antd Card）：
     - `Input` — 名稱或 ID 搜尋
     - `Button` — 查詢 / 重置
   - 資料表格（Antd Table）：
     - Column: 聊天室 ID（id）
     - Column: 聊天室名稱（name）
     - Column: 線上人數（online_user_count）
     - Column: 建立時間（created_at）— dayjs UTC+8 格式化
   - 分頁：pageSize=30
   - 樣式：使用 `createStyles` 管理，顏色/間距使用 token
   - 參照 [rfc_03 §5.11](rfc_03-chatroom-and-chat.md)

**修改檔案：**

3. `client/src/router.tsx`
   - 新增 `/chatrooms` 路由，包裹 `ProtectedRoute` + `permission="chatroom:read"`

### 驗證方式

1. 登入後點擊 Sidebar「聊天室」→ 顯示聊天室列表
2. 表格顯示 5 筆聊天室 + 線上人數
3. 輸入名稱搜尋 → 表格篩選
4. 輸入 ID 搜尋 → 表格篩選
5. 點擊重置 → 清除搜尋條件
6. 時間欄位顯示為 UTC+8 格式

### Task 3.6t: Component Tests — ChatroomPage

**建立** `client/src/__tests__/pages/ChatroomPage.test.tsx`

**測試案例：**

- 頁面載入後呼叫 API 並渲染表格
- 表格包含聊天室 ID、名稱、線上人數、建立時間欄位
- 時間顯示為 UTC+8 格式
- 輸入搜尋關鍵字 → 重新呼叫 API（帶 name 參數）
- 點擊重置 → 清除搜尋條件
- 分頁元件顯示正確的 total

---

## Task 3.7: 前端 ChatMonitoringPage

建立聊天監控頁面。

**建立檔案：**

1. `client/src/api/chatMessage.ts`
   - `chatMessageApi.list(params)` — GET /api/chat_messages
   - `chatMessageApi.remove(id)` — DELETE /api/chat_messages/:id
   - 使用 `@shared/types/chatMessage` 型別

2. `client/src/pages/ChatMonitoringPage.tsx`
   - 篩選區域（Antd Card）：
     - `Select` — 聊天室（從 chatrooms API 取得選項）
     - `Input` — 玩家帳號
     - `Input` — 玩家暱稱
     - `Input` — 訊息關鍵字
     - `DatePicker.RangePicker` — 時間範圍
     - `Button` — 查詢 / 重置
   - 資料表格（Antd Table）：
     - Column: 聊天室（chatroom_id）
     - Column: 玩家帳號（player_username）
     - Column: 玩家暱稱（player_nickname）
     - Column: 訊息內容（message）
     - Column: 發送時間（created_at）— dayjs UTC+8 格式化
     - Column: 操作（Action）
       - Button — 刪除訊息（Modal.confirm 確認後呼叫 DELETE API）
       - Button — 封鎖玩家（disabled，tooltip: "功能開發中"）
       - Button — 重設暱稱（disabled，tooltip: "功能開發中"）
   - 分頁：pageSize=30
   - 樣式：使用 `createStyles` 管理，顏色/間距使用 token
   - 參照 [rfc_03 §5.12](rfc_03-chatroom-and-chat.md)

**修改檔案：**

3. `client/src/router.tsx`
   - 新增 `/chat` 路由，包裹 `ProtectedRoute` + `permission="chat:read"`

### 驗證方式

1. 登入後點擊 Sidebar「聊天監控」→ 顯示訊息列表
2. 頁面載入後自動查詢，表格顯示 mock data
3. 選擇聊天室篩選 → 表格僅顯示該聊天室訊息
4. 輸入玩家帳號/暱稱/關鍵字 → 表格篩選
5. 選擇時間範圍 → 表格篩選
6. 點擊重置 → 清除所有篩選條件
7. 點擊刪除按鈕 → 確認 Modal → 刪除成功 → 表格自動重新查詢
8. 封鎖玩家 / 重設暱稱按鈕為 disabled
9. 切換分頁 → 資料正確更新
10. 時間欄位顯示為 UTC+8 格式

### Task 3.7t: Component Tests — ChatMonitoringPage

**建立** `client/src/__tests__/pages/ChatMonitoringPage.test.tsx`

**測試案例：**

- 頁面載入後呼叫 API 並渲染表格
- 表格包含聊天室、玩家帳號、玩家暱稱、訊息內容、發送時間、操作欄位
- 時間顯示為 UTC+8 格式
- 選擇聊天室篩選 → 重新呼叫 API（帶 chatroomId 參數）
- 點擊重置 → 清除篩選條件
- 點擊刪除按鈕 → 顯示確認 Modal
- 封鎖玩家按鈕為 disabled 狀態（`@ui_only`）
- 重設暱稱按鈕為 disabled 狀態（`@ui_only`）
- 分頁元件顯示正確的 total

---

## Task 3.8: rfc_01 Route 表更新 + CLAUDE.md 更新

**修改檔案：**

1. `00_doc/rfc_01-auth-and-response.md`
   - §5.9 Route 權限對照表：`/api/chat/messages` → `/api/chat_messages`

2. `CLAUDE.md`
   - Current progress 確認指向 tasks_03
   - Document Routing 確認包含所有新文件

### 驗證方式

- rfc_01 中不再有 `/api/chat/messages` 路徑
- CLAUDE.md Document Routing 連結正確
- 所有文件已執行 prettier format

---

## 執行順序

```
Task 3.1（DB Migrations — 4 張表）
  ↓
Task 3.2（Seed Data）
  ↓
Task 3.3（Shared types / schemas）
  ↓
Task 3.4 → 3.4t（chatroom GET API + 測試）
  ↓
Task 3.5 → 3.5t（chatMessage GET + DELETE API + 測試）
  ↓
Task 3.6 → 3.6t（ChatroomPage + 測試）
  ↓
Task 3.7 → 3.7t（ChatMonitoringPage + 測試）
  ↓
Task 3.8（rfc_01 更新 + CLAUDE.md 更新）
```

> Task 3.1~3.3 為基礎建設，必須依序執行。Task 3.4 起為功能開發，chatroom 先於 chatMessage（因 ChatMonitoringPage 的聊天室篩選需要 chatroom API）。每個功能 task 後緊接對應的測試 task。

## Progress

| Task      | 狀態 | 完成日期   | 備註                         |
| --------- | ---- | ---------- | ---------------------------- |
| Task 3.1  | ✅   | 2026-03-17 | 4 張表 migration + testDb    |
| Task 3.2  | ✅   | 2026-03-17 | 5 聊天室 + 18 玩家 + 64 訊息 |
| Task 3.3  | ✅   | 2026-03-17 | types + schemas + index 更新 |
| Task 3.4  | ✅   | 2026-03-17 | GET /api/chatrooms           |
| Task 3.4t | ✅   | 2026-03-17 | 10 integration tests         |
| Task 3.5  | ✅   | 2026-03-17 | GET + DELETE /api/chat_messages |
| Task 3.5t | ✅   | 2026-03-17 | 21 integration tests         |
| Task 3.6  | ✅   | 2026-03-17 | ChatroomPage + api + router  |
| Task 3.6t | ✅   | 2026-03-17 | 7 component tests            |
| Task 3.7  | ✅   | 2026-03-17 | ChatMonitoringPage + api     |
| Task 3.7t | ✅   | 2026-03-17 | 10 component tests           |
| Task 3.8  | ✅   | 2026-03-17 | 文件更新 + prettier          |

## 完成檢查清單

- [x] 4 張 migration 正常執行，DB 表結構正確
- [x] Seed data 正常載入（5 聊天室 + 18 玩家 + 64 訊息）
- [x] `GET /api/chatrooms` 回傳分頁聊天室列表
- [x] `GET /api/chatrooms?name=xxx` 模糊搜尋正常
- [x] `GET /api/chat_messages` 回傳分頁訊息列表
- [x] `GET /api/chat_messages` 多條件篩選正常
- [x] `DELETE /api/chat_messages/:id` 軟刪除成功
- [x] 刪除訊息後 operation_logs 有紀錄
- [x] 已軟刪除的訊息不出現在 GET 列表中
- [x] 前端 ChatroomPage 正確顯示聊天室列表
- [x] 前端 ChatMonitoringPage 正確顯示訊息列表
- [x] 前端刪除功能正常（確認 Modal + 刪除 + 重新查詢）
- [x] 前端封鎖玩家 / 暱稱重設按鈕為 disabled 狀態
- [x] 前端時間顯示為 UTC+8 格式
- [x] rfc_01 Route 權限對照表已同步更新（原已正確）
- [x] `npm test` 全部通過（server 116 + client 42 = 158 tests）
