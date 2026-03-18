# Phase 4: 黑名單與 IP 封鎖

## 背景

Phase 3 完成聊天監控功能後，`ChatMonitoringPage` 的「封鎖玩家」按鈕目前為 disabled 狀態。本 Phase 實作玩家黑名單與 IP 封鎖的完整後端邏輯與前端頁面，並啟用該按鈕。

技術設計詳見 [rfc_04-blacklist-and-ip-blocking.md](rfc_04-blacklist-and-ip-blocking.md)，驗收規格見 [blacklist.feature](blacklist.feature)。

## 前置條件

- Phase 3 全部完成（Task 3.1~3.8）
- `npm run dev` 前後端正常啟動
- `npm test` 全部通過

---

## Task 4.1: DB Migration — blacklist 表

建立統一的 `blacklist` 資料表，同時儲存玩家黑名單與 IP 封鎖。

**建立檔案：**

1. `server/db/migrations/20260317000006_create_blacklist.ts`
   - `id` INTEGER PRIMARY KEY AUTOINCREMENT
   - `block_type` VARCHAR(10) NOT NULL（'player' | 'ip'）
   - `target` VARCHAR(100) NOT NULL（玩家帳號或 IP 位址）
   - `reason` VARCHAR(20) NOT NULL（'spam' | 'abuse' | 'advertisement'）
   - `operator` VARCHAR(50) NOT NULL（操作者帳號，冗餘欄位）
   - `chatroom_id` VARCHAR(50) NOT NULL DEFAULT '\*'（特定聊天室或 '\*' 全域）
   - `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
   - `deleted_at` DATETIME nullable（軟刪除 = 解封）
   - UNIQUE(block_type, target, chatroom_id)
   - 索引：(block_type, target)、created_at
   - 參照 [rfc_04 §5.1](rfc_04-blacklist-and-ip-blocking.md)

**修改檔案：**

2. `server/src/__tests__/helpers/testDb.ts`
   - 新增 blacklist 表的測試 schema

### 驗證方式

- `npm run db:migrate` 成功建立 blacklist 表
- SQLite 查詢確認 UNIQUE 約束和索引已建立
- 表含 `deleted_at` 欄位、`chatroom_id` 預設值為 `'*'`

---

## Task 4.2: Seed Data

建立玩家黑名單與 IP 封鎖的 mock data。

**建立檔案：**

1. `server/db/seeds/07_blacklist.ts`
   - 5 筆 block_type='player' 資料（不同 reason + chatroom_id 組合）
   - 3 筆 block_type='ip' 資料（含精確 IP 和萬用字元範例）
   - 所有 deleted_at 為 null（有效封鎖）
   - operator 使用 admin01 或 admin02
   - 參照 [rfc_04 §5.8](rfc_04-blacklist-and-ip-blocking.md)

### 驗證方式

- `npm run db:seed` 成功插入 8 筆資料（5 player + 3 IP）
- 確認 `116.62.238.*` 萬用字元格式正確存入
- 確認不同 chatroom_id（含 `'*'`）均有示範資料

---

## Task 4.3: Shared types / schemas

建立黑名單相關的前後端共用型別定義與 Zod schema。

**建立檔案：**

1. `shared/types/blacklist.ts`
   - `TBlacklistItem` — 黑名單列表項目型別
   - `TBlacklistQuery` — 查詢參數型別
   - `TCreatePlayerBlockPayload` — 封鎖玩家的請求 body 型別
   - `TCreateIpBlockPayload` — 封鎖 IP 的請求 body 型別
   - 參照 [rfc_04 §5.9](rfc_04-blacklist-and-ip-blocking.md)

2. `shared/schemas/blacklist.ts`
   - `blacklistQuerySchema` — 查詢參數 Zod schema
   - `createPlayerBlockSchema` — 封鎖玩家 Zod schema（target、reason、chatroom_id optional）
   - `createIpBlockSchema` — 封鎖 IP Zod schema（含 IP regex 驗證：`/^(\d{1,3}\.){3}(\d{1,3}|\*)$/`）

**修改檔案：**

3. `shared/index.ts`
   - re-export 所有新增的 types 和 schemas

### 驗證方式

- TypeScript 編譯正常（client 和 server 皆能 import）
- `createIpBlockSchema` 正確驗證 IP 格式（有效：`116.62.238.199`、`116.62.238.*`；無效：`not-ip`、`116.62.*.199`）
- `createPlayerBlockSchema` reason 必填，chatroom_id 選填預設 `'*'`

---

## Task 4.4: 後端 blacklist module

建立統一的黑名單 API，透過明確路由 `/player` / `/ip` 分開處理兩種類型。

**建立檔案：**

1. `server/src/module/blacklist/service.ts`
   - `list(blockType, query)` — 組裝 Knex 查詢（block_type 固定 + 多條件篩選 + 分頁 + WHERE deleted_at IS NULL + ORDER BY created_at DESC）
   - `create(blockType, payload, operator)` — upsert 邏輯：
     1. 查詢 UNIQUE 組合（block_type + target + chatroom_id）
     2. 存在且 active → 拋出 `BLACKLIST_ALREADY_BLOCKED`
     3. 存在且 deleted → UPDATE SET deleted_at = NULL
     4. 不存在 → INSERT
   - `remove(blockType, id)` — 查詢 id + block_type 驗證 → 軟刪除，不存在或已解封 → 拋出 `BLACKLIST_ENTRY_NOT_FOUND`
   - 參照 [rfc_04 §5.7](rfc_04-blacklist-and-ip-blocking.md)

2. `server/src/module/blacklist/controller.ts`
   - `list(req, res, next)` — 從 `req.path.includes('/ip')` 判斷 blockType → 驗證 query（blacklistQuerySchema）→ 呼叫 service.list() → ResponseHelper.paginated()
   - `create(req, res, next)` — 判斷 blockType → 呼叫 service.create() → 設定 `res.locals.operationLog`（player: `BLOCK_PLAYER`，ip: `BLOCK_IP`）→ ResponseHelper.success(res, result, 201)
   - `remove(req, res, next)` — 判斷 blockType → 呼叫 service.remove() → 設定 `res.locals.operationLog`（player: `UNBLOCK_PLAYER`，ip: `UNBLOCK_IP`）→ ResponseHelper.success()

3. `server/src/module/blacklist/route.ts`
   - `/player` — GET（blacklist:read）、POST（blacklist:create + validate）、DELETE /:id（blacklist:delete）
   - `/ip` — GET（ip_block:read）、POST（ip_block:create + validate）、DELETE /:id（ip_block:delete）
   - export `createBlacklistRoutes(db: Knex): Router`

**修改檔案：**

4. `server/src/app.ts`
   - 掛載 `app.use('/api/blacklist', createBlacklistRoutes(db))`

5. `server/src/utils/errorCodes.ts`
   - 新增 `BLACKLIST_ALREADY_BLOCKED`（409, '該目標已在封鎖名單中'）
   - 新增 `BLACKLIST_ENTRY_NOT_FOUND`（404, '封鎖紀錄不存在或已解封'）

### 驗證方式

```bash
# 查詢玩家黑名單
curl -b cookies.txt http://localhost:3000/api/blacklist/player
# 預期：5 筆玩家封鎖紀錄

# 封鎖玩家
curl -X POST -b cookies.txt -H "Content-Type: application/json" \
  -d '{"target":"playerXX","reason":"spam"}' \
  http://localhost:3000/api/blacklist/player
# 預期：201 + 封鎖紀錄

# 重複封鎖
curl -X POST -b cookies.txt -H "Content-Type: application/json" \
  -d '{"target":"playerXX","reason":"spam"}' \
  http://localhost:3000/api/blacklist/player
# 預期：409 BLACKLIST_ALREADY_BLOCKED

# 封鎖 IP（萬用字元）
curl -X POST -b cookies.txt -H "Content-Type: application/json" \
  -d '{"target":"192.168.1.*","reason":"spam"}' \
  http://localhost:3000/api/blacklist/ip
# 預期：201

# 封鎖 IP（非法格式）
curl -X POST -b cookies.txt -H "Content-Type: application/json" \
  -d '{"target":"not-ip","reason":"spam"}' \
  http://localhost:3000/api/blacklist/ip
# 預期：400 VALIDATION_ERROR
```

對應 Gherkin：`blacklist.feature` `@happy_path`、`@validation` 全系列

### Task 4.4t: Integration Tests — blacklist API

**建立** `server/src/__tests__/integration/blacklist.player.test.ts`

**測試案例：**

- 查詢玩家黑名單 → 200 + 分頁（僅 block_type='player'）（`@happy_path`）
- target 模糊搜尋 → 回傳匹配結果（`@happy_path`）
- reason 精確篩選 → 回傳對應原因的紀錄（`@happy_path`）
- startDate/endDate 日期範圍篩選（`@happy_path`）
- 封鎖玩家（新紀錄）→ 201（`@happy_path`）
- 封鎖玩家（全域，預設 chatroom_id='\*'）→ 201（`@happy_path`）
- 重複封鎖 active 紀錄 → 409 BLACKLIST_ALREADY_BLOCKED（`@validation`）
- 封鎖已解封玩家 → 201，deleted_at 清除（`@soft_delete`）
- 解封玩家 → 200，deleted_at 設定（`@happy_path`）
- 解封後玩家不出現在列表（`@soft_delete`）
- 解封不存在 id → 404 BLACKLIST_ENTRY_NOT_FOUND（`@validation`）
- 解封 ip 類型的 id 用 player 路由 → 404（`@validation`）
- 封鎖/解封後 operation_logs 有對應紀錄（`@happy_path`）
- 未帶 token → 401（`@permissions`）
- general_manager → 200（`@permissions`）
- senior_manager → 200（`@permissions`）

**建立** `server/src/__tests__/integration/blacklist.ip.test.ts`

**測試案例：**

- 查詢 IP 封鎖列表 → 200 + 分頁（僅 block_type='ip'）（`@happy_path`）
- 封鎖精確 IP → 201（`@happy_path`）
- 封鎖萬用字元 IP → 201（`@happy_path`）
- IP 格式錯誤（非法字串）→ 400 VALIDATION_ERROR（`@validation`）
- IP 格式錯誤（中段萬用字元）→ 400 VALIDATION_ERROR（`@validation`）
- 重複封鎖 active IP → 409 BLACKLIST_ALREADY_BLOCKED（`@validation`）
- 解除 IP 封鎖 → 200，deleted_at 設定（`@happy_path`）
- 封鎖/解封後 operation_logs 有對應紀錄（`@happy_path`）
- 未帶 token → 401（`@permissions`）

---

## Task 4.5: 前端 BlacklistPage + CreateBlacklistModal

建立黑名單管理前端頁面與新增封鎖 Modal。

**建立檔案：**

1. `client/src/api/blacklist.ts`
   - `blacklistApi.listPlayers(params)` — GET /api/blacklist/player
   - `blacklistApi.listIps(params)` — GET /api/blacklist/ip
   - `blacklistApi.blockPlayer(data)` — POST /api/blacklist/player
   - `blacklistApi.blockIp(data)` — POST /api/blacklist/ip
   - `blacklistApi.unblockPlayer(id)` — DELETE /api/blacklist/player/:id
   - `blacklistApi.unblockIp(id)` — DELETE /api/blacklist/ip/:id
   - 使用 `@shared/types/blacklist` 型別

2. `client/src/components/CreateBlacklistModal.tsx`
   - Props: `open`、`onClose`、`onSuccess`、`initialValues`（blockType、target、chatroomId 選填）
   - Select — 類型（Player / IP），切換時清除 target 欄位
   - Input — 目標（依 blockType 顯示不同 placeholder 和驗證規則）
   - Select — 封鎖原因（spam / abuse / advertisement）
   - Select — 聊天室（選填，從 chatrooms API 取得選項，含「全域（\*）」選項）
   - 提交成功 → 關閉 Modal、通知父元件重新查詢
   - 使用 `createStyles` 管理樣式
   - 參照 [rfc_04 §5.11](rfc_04-blacklist-and-ip-blocking.md)

3. `client/src/pages/BlacklistPage.tsx`
   - 篩選區域（Antd Card）：
     - Select — 類型（Player / IP，切換時重置其他條件並重新查詢）
     - Input — 目標（模糊搜尋）
     - Select — 封鎖原因（spam / abuse / advertisement）
     - Input — 聊天室（含 `*` 全域）
     - DatePicker.RangePicker — 封鎖時間範圍
     - Button — 查詢 / 重置
   - Button — 新增封鎖（開啟 CreateBlacklistModal）
   - 資料表格（Antd Table）：
     - Column: 類型、目標、封鎖原因、操作者、聊天室（`'*'` 顯示為「全域」）、封鎖時間（UTC+8）、操作（解封）
   - 解封前顯示確認 Modal
   - 分頁：pageSize=30
   - 使用 `createStyles` 管理樣式
   - 參照 [rfc_04 §5.10](rfc_04-blacklist-and-ip-blocking.md)

**修改檔案：**

4. `client/src/router.tsx`
   - 新增 `/blacklist` 路由，包裹 `ProtectedRoute` + `permission="blacklist:read"`

5. `client/src/layouts/AdminLayout.tsx`
   - 更新 sidebar 選單：`{ key: '/blacklist', label: '黑名單管理', permission: 'blacklist:read' }`

### 驗證方式

1. 登入後點擊 Sidebar「黑名單管理」→ 顯示黑名單列表
2. 預設顯示 Player 類型，表格顯示 5 筆玩家封鎖紀錄
3. 切換類型為 IP → 表格改顯示 3 筆 IP 封鎖紀錄
4. 輸入 target 搜尋 → 表格篩選
5. 切換原因篩選 → 表格篩選
6. 時間欄位顯示為 UTC+8 格式，`chatroom_id='*'` 顯示為「全域」
7. 點擊「新增封鎖」→ 開啟 CreateBlacklistModal
8. Modal 中切換類型 → target 欄位清空
9. 提交封鎖 → 成功後 Modal 關閉，表格重新查詢
10. 點擊解封 → 確認 Modal → 解封成功 → 表格重新查詢

### Task 4.5t: Component Tests — BlacklistPage + CreateBlacklistModal

**建立** `client/src/__tests__/pages/BlacklistPage.test.tsx`

**測試案例：**

- 頁面載入後呼叫 listPlayers API 並渲染表格（`@happy_path`）
- 表格包含類型、目標、原因、操作者、聊天室、時間、操作欄位（`@happy_path`）
- 時間顯示為 UTC+8 格式（`@happy_path`）
- chatroom_id='\*' 顯示為「全域」（`@happy_path`）
- 切換 type 為 IP → 呼叫 listIps API（`@ui_only`）
- 輸入 target → 重新呼叫 API 帶 target 參數（`@happy_path`）
- 點擊查詢按鈕 → 重新查詢（`@happy_path`）
- 點擊重置 → 清除篩選條件（`@happy_path`）
- 點擊解封按鈕 → 顯示確認 Modal（`@happy_path`）
- 分頁元件顯示正確的 total（`@happy_path`）

**建立** `client/src/__tests__/components/CreateBlacklistModal.test.tsx`

**測試案例：**

- Modal 渲染後顯示 type、target、reason 欄位（`@ui_only`）
- 切換 type 為 IP → target 欄位清空（`@ui_only`）
- Player 模式下提交空白 target → 顯示驗證錯誤（`@validation`）
- IP 模式下提交非法 IP → 顯示驗證錯誤（`@validation`）
- 提交成功 → 呼叫 onSuccess callback（`@happy_path`）
- initialValues 有值時預填對應欄位（`@ui_only`）

---

## Task 4.6: ChatMonitoringPage 更新 — 啟用封鎖玩家按鈕

修改 ChatMonitoringPage，啟用「封鎖玩家」按鈕並串接 CreateBlacklistModal。

**修改檔案：**

1. `client/src/pages/ChatMonitoringPage.tsx`
   - 移除「封鎖玩家」按鈕的 `disabled` 屬性和 tooltip `"功能開發中"`
   - 新增 `CreateBlacklistModal` 的狀態管理（open、initialValues）
   - 點擊「封鎖玩家」→ 開啟 Modal，帶入：
     ```ts
     initialValues={{ blockType: 'player', target: record.player_username, chatroomId: record.chatroom_id }}
     ```
   - 封鎖成功後顯示 `message.success('已成功封鎖玩家')`
   - 參照 [rfc_04 §5.12](rfc_04-blacklist-and-ip-blocking.md)

### 驗證方式

1. 登入後至聊天監控頁面
2. 「封鎖玩家」按鈕為 enabled 狀態
3. 點擊「封鎖玩家」→ CreateBlacklistModal 開啟，預填玩家帳號和聊天室
4. 填寫原因後提交 → 成功封鎖，顯示成功提示
5. 前往黑名單管理頁面，確認新封鎖紀錄出現

### Task 4.6t: Component Tests — ChatMonitoringPage 更新

**更新** `client/src/__tests__/pages/ChatMonitoringPage.test.tsx`

**更新測試案例：**

- 「封鎖玩家」按鈕為 enabled 狀態（移除原 disabled 測試）（`@ui_only`）
- 點擊「封鎖玩家」→ CreateBlacklistModal 開啟（`@ui_only`）
- Modal 預填 player_username 和 chatroom_id（`@ui_only`）

---

## Task 4.7: 文件更新 + Prettier Format

更新相關文件並執行格式化。

**修改檔案：**

1. `00_doc/rfc_01-auth-and-response.md`
   - §5.9 Route 權限對照表：
     - `GET /api/blacklist` → `GET /api/blacklist/player`
     - `POST /api/blacklist` → `POST /api/blacklist/player`
     - `DELETE /api/blacklist/:id` → `DELETE /api/blacklist/player/:id`
     - `GET /api/ip-blocks` → `GET /api/blacklist/ip`
     - `POST /api/ip-blocks` → `POST /api/blacklist/ip`
     - `DELETE /api/ip-blocks/:id` → `DELETE /api/blacklist/ip/:id`

2. 執行 prettier format（針對本次改動的所有檔案）：
   ```bash
   npx prettier --write \
     CLAUDE.md \
     00_doc/prd_00-chat_management_backstage.md \
     00_doc/rfc_04-blacklist-and-ip-blocking.md \
     00_doc/blacklist.feature \
     00_doc/tasks_04-blacklist-and-ip-blocking.md \
     00_doc/rfc_01-auth-and-response.md
   ```

### 驗證方式

- rfc_01 §5.9 中不再有 `/api/blacklist`（不含 /player 或 /ip）路徑
- rfc_01 §5.9 中不再有 `/api/ip-blocks` 路徑
- CLAUDE.md Document Routing 指向新文件
- prettier format 執行無錯誤

---

## 執行順序

```
Task 4.1（DB Migration — blacklist 表）
  ↓
Task 4.2（Seed Data — 07_blacklist.ts）
  ↓
Task 4.3（Shared types / schemas）
  ↓
Task 4.4（後端 blacklist module）→ Task 4.4t（Integration Tests）
  ↓
Task 4.5（前端 BlacklistPage + CreateBlacklistModal）→ Task 4.5t（Component Tests）
  ↓
Task 4.6（ChatMonitoringPage 更新）→ Task 4.6t（Component Tests 更新）
  ↓
Task 4.7（rfc_01 更新 + Prettier Format）
```

> Task 4.1~4.3 為基礎建設，必須依序執行。Task 4.4 完成後可同步進行前後端開發。Task 4.6 依賴 Task 4.5（CreateBlacklistModal）完成後才能修改 ChatMonitoringPage。

---

## Task 4.8: `deleted_at` → `is_blocked` + 前端狀態篩選

將 `blacklist.deleted_at`（軟刪除）改為 `is_blocked`（boolean），語義與 `admins.is_active` 一致；同時新增 API `status` 篩選與前端狀態 Select。

### 修改檔案

**後端：**

1. `server/db/migrations/20260317000007_blacklist_is_blocked.ts`
   - 新增 `is_blocked` BOOLEAN NOT NULL DEFAULT TRUE
   - 移除 `deleted_at` 欄位

2. `server/db/seeds/07_blacklist.ts`
   - `deleted_at: null` → `is_blocked: true`

3. `server/src/module/blacklist/service.ts`
   - `list()` 新增 `status` 篩選（`'blocked'` / `'unblocked'` / `'all'`，預設 `'blocked'`）
   - `create()` / `remove()` 改用 `is_blocked`（`create` 時檢查 `is_blocked = true` 為重複；`remove` 時 `UPDATE SET is_blocked = false`）
   - `list()` select 新增 `is_blocked` 欄位

4. `server/src/__tests__/helpers/testDb.ts`
   - blacklist schema：`deleted_at` → `is_blocked`

5. `server/src/__tests__/integration/blacklist.player.test.ts`
   - 斷言改用 `is_blocked`；新增 `status` 篩選測試

6. `server/src/__tests__/integration/blacklist.ip.test.ts`
   - 斷言改用 `is_blocked`

**Shared：**

7. `shared/types/blacklist.ts`
   - `TBlacklistItem` 新增 `is_blocked: boolean`
   - `TBlacklistQuery` 新增 `status?: 'blocked' | 'unblocked' | 'all'`

8. `shared/schemas/blacklist.ts`
   - `blacklistQuerySchema` 新增 `status`（預設 `'blocked'`）

**前端：**

9. `client/src/pages/BlacklistPage.tsx`
   - 篩選區新增 Select「狀態（封鎖中 / 已解封 / 全部）」，預設「封鎖中」
   - Table 新增「狀態」欄位（封鎖中 / 已解封）
   - 「解封」按鈕只在 `is_blocked = true` 時顯示

10. `client/src/__tests__/pages/BlacklistPage.test.tsx`
    - 新增狀態篩選測試；更新 mock data 加入 `is_blocked`

### 驗證方式

```bash
# 預設只查封鎖中
GET /api/blacklist/player → 5 筆，is_blocked=true
# 查已解封
GET /api/blacklist/player?status=unblocked → 0 筆（seed 全是封鎖中）
# 查全部
GET /api/blacklist/player?status=all → 5 筆
# 解封後
DELETE /api/blacklist/player/:id → is_blocked=false，不出現在預設列表
# 解封後查全部
GET /api/blacklist/player?status=all → 仍有 5 筆，is_blocked 其中 1 筆為 false
```

---

## Progress

| Task      | 狀態      | 完成日期   | 備註 |
| --------- | --------- | ---------- | ---- |
| Task 4.1  | completed | 2026-03-17 |      |
| Task 4.2  | completed | 2026-03-17 |      |
| Task 4.3  | completed | 2026-03-17 |      |
| Task 4.4  | completed | 2026-03-17 |      |
| Task 4.4t | completed | 2026-03-17 |      |
| Task 4.5  | completed | 2026-03-17 |      |
| Task 4.5t | completed | 2026-03-17 |      |
| Task 4.6  | completed | 2026-03-17 |      |
| Task 4.6t | completed | 2026-03-17 |      |
| Task 4.7  | completed | 2026-03-17 |      |
| Task 4.8  | completed | 2026-03-17 |      |

## 完成檢查清單

- [x] `blacklist` migration 正常執行，DB 表結構正確
- [x] UNIQUE(block_type, target, chatroom_id) 約束有效
- [x] Seed data 正常載入（5 筆 player + 3 筆 IP）
- [x] `GET /api/blacklist/player` 回傳分頁玩家黑名單
- [x] `GET /api/blacklist/ip` 回傳分頁 IP 封鎖列表
- [x] `POST /api/blacklist/player` 封鎖成功（201）
- [x] `POST /api/blacklist/player` 重複封鎖回 409 `BLACKLIST_ALREADY_BLOCKED`
- [x] `POST /api/blacklist/player` 重新封鎖已解封玩家（`is_blocked` 改回 true）
- [x] `DELETE /api/blacklist/player/:id` 解封成功（`is_blocked` 改為 false）
- [x] `POST /api/blacklist/ip` IP 格式驗證正確（精確 IP 和萬用字元通過，非法格式 400）
- [x] 所有封鎖/解封操作自動寫入 operation_logs
- [x] 前端 BlacklistPage 正確顯示列表
- [x] 前端 type 切換正確查詢對應 API
- [x] 前端狀態篩選（封鎖中 / 已解封 / 全部）正常運作
- [x] 前端解封功能正常（確認 Modal + 解封 + 重新查詢）
- [x] 前端 CreateBlacklistModal 表單驗證正常
- [x] ChatMonitoringPage「封鎖玩家」按鈕已啟用
- [x] 從 ChatMonitoringPage 封鎖時預填玩家帳號和聊天室
- [x] rfc_01 §5.9 Route 表已同步更新
- [x] `npm test` 全部通過（server 142 tests + client 61 tests）
