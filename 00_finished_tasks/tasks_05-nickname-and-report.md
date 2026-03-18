# Phase 5: 暱稱審核 + 玩家檢舉審核

## 背景

Phase 4 完成黑名單與 IP 封鎖後，`ChatMonitoringPage` 的「封鎖玩家」按鈕已啟用。本 Phase 實作兩個審核模組：

1. **暱稱審核（Nickname Review）** — 管理員審核玩家提交的暱稱變更申請，駁回時自動重設暱稱為帳號名稱
2. **玩家檢舉審核（Player Report Review）** — 管理員審核玩家提交的聊天檢舉，核准時自動封鎖被檢舉玩家

技術設計詳見 [rfc_05-nickname-and-report.md](rfc_05-nickname-and-report.md)，驗收規格見 [nickname-and-report.feature](nickname-and-report.feature)。

## 前置條件

- Phase 4 全部完成（Task 4.1~4.8）
- `npm run dev` 前後端正常啟動
- `npm test` 全部通過

---

## Task 5.1: DB Migration — players 表新增欄位 + reports 表建立

### 建立 / 修改檔案

1. `server/db/migrations/20260317000008_add_nickname_apply_at_to_players.ts`
   - `players` 表新增 `nickname_apply_at DATETIME nullable`（暱稱申請時間）
   - `up()`：`knex.schema.alterTable('players', table => table.datetime('nickname_apply_at').nullable().defaultTo(null))`
   - `down()`：`knex.schema.alterTable('players', table => table.dropColumn('nickname_apply_at'))`
   - 參照 [rfc_05 §5.1](rfc_05-nickname-and-report.md)

2. `server/db/migrations/20260317000009_create_reports.ts`
   - `id` INTEGER PRIMARY KEY AUTOINCREMENT
   - `reporter_username` VARCHAR(50) NOT NULL（FK → players.username）
   - `target_username` VARCHAR(50) NOT NULL（FK → players.username）
   - `chatroom_id` VARCHAR(50) NOT NULL（事發聊天室）
   - `chat_message_id` INTEGER nullable（FK → chat_messages.id）
   - `chat_message` TEXT NOT NULL（訊息快照）
   - `reason` VARCHAR(20) NOT NULL（'spam' | 'abuse' | 'advertisement'）
   - `status` VARCHAR(20) NOT NULL DEFAULT 'pending'（'pending' | 'approved' | 'rejected'）
   - `reviewed_by` VARCHAR(50) nullable（審核管理員帳號）
   - `reviewed_at` DATETIME nullable（審核時間）
   - `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
   - **無 deleted_at**（檢舉為稽核紀錄，不支援軟刪除）
   - 索引：`(status)`、`(reporter_username)`、`(target_username)`、`(created_at)`
   - 參照 [rfc_05 §5.2](rfc_05-nickname-and-report.md)

3. `server/src/__tests__/helpers/testDb.ts`
   - 新增 `reports` 表的測試 schema
   - 在 `players` 表的 schema 中新增 `nickname_apply_at` 欄位
   - **注意**：integration tests 使用 in-memory SQLite，須手動維護 schema，不走 migration

### 驗證方式

- `npm run db:migrate` 成功執行，無錯誤
- SQLite 查詢確認 `players.nickname_apply_at` 欄位存在
- SQLite 查詢確認 `reports` 表結構正確（含索引，無 deleted_at）
- `npm test` 通過（testDb.ts 更新後不影響現有測試）

---

## Task 5.2: Shared types & schemas

### 建立 / 修改檔案

1. `shared/types/nicknameReview.ts`

   ```ts
   export type TNicknameReviewItem = {
     username: string;
     nickname: string;
     nickname_apply_at: string;
   };

   export type TNicknameReviewQuery = {
     username?: string;
     nickname?: string;
     applyStartDate?: string;
     applyEndDate?: string;
     page?: number;
     pageSize?: number;
   };
   ```

2. `shared/types/report.ts`

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

3. `shared/schemas/nicknameReview.ts`

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

4. `shared/schemas/report.ts`

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

5. `shared/index.ts` — 新增 re-export：
   ```ts
   export * from './types/nicknameReview';
   export * from './types/report';
   export * from './schemas/nicknameReview';
   export * from './schemas/report';
   ```

### 驗證方式

- TypeScript 編譯無錯誤（`tsc --noEmit`）
- `shared/index.ts` 可正確 import 所有新型別與 schema

---

## Task 5.3: 後端 nicknameReview module + integration tests

### 建立 / 修改檔案

1. `server/src/utils/errorCodes.ts`
   — 新增 4 個 error codes（`PLAYER_NOT_FOUND`, `PLAYER_NICKNAME_NOT_PENDING`, `REPORT_NOT_FOUND`, `REPORT_ALREADY_REVIEWED`）與對應 `ERROR_MESSAGES`
   — 參照 [rfc_05 §5.9](rfc_05-nickname-and-report.md)

2. `server/src/module/nicknameReview/service.ts`
   — `NicknameReviewService(db: Knex)`
   — `list(query: TNicknameReviewQuery)` — 篩選 `nickname_approved = false`, 搜尋條件, 分頁
   — `approve(username: string)` — 確認存在且 pending → UPDATE `nickname_approved=true, nickname_apply_at=null`
   — `reject(username: string)` — 確認存在且 pending → UPDATE `nickname=username, nickname_approved=true, nickname_apply_at=null`

3. `server/src/module/nicknameReview/controller.ts`
   — `NicknameReviewController(service: NicknameReviewService)`
   — `list`, `approve`, `reject` 方法
   — approve / reject 需設定 `res.locals.operationLog = { operationType: 'APPROVE_NICKNAME' | 'REJECT_NICKNAME', targetId: username }`

4. `server/src/module/nicknameReview/route.ts`
   — `createNicknameReviewRoutes(db: Knex): Router`
   — `GET /` → `auth, requirePermission('nickname:read'), controller.list`
   — `POST /:username/approve` → `auth, requirePermission('nickname:review'), controller.approve`
   — `POST /:username/reject` → `auth, requirePermission('nickname:review'), controller.reject`

5. `server/src/module/player/route.ts` — 新增 nickname review 路由（合併於 player module）

6. `server/src/__tests__/integration/nicknameReview.test.ts`
   — 覆蓋 Gherkin `@happy_path`、`@validation`、`@permissions` 場景
   — 關鍵 cases：
   - GET 列出待審核（含搜尋條件）
   - POST approve 成功（驗證 db 狀態）
   - POST reject 成功（驗證 nickname = username）
   - POST approve/reject 對已核准玩家 → 409
   - POST approve 對不存在玩家 → 404
   - 未帶 JWT → 401
   - 無 nickname:review 權限 → 403

### 設計要點

- `approve` / `reject` 時需確認 `nickname_approved = false`，若已為 true 拋出 `PLAYER_NICKNAME_NOT_PENDING`
- `reject` 執行後 `nickname = username`（players.username 欄位值）
- `deleted_at IS NULL` 條件須加入 list 查詢

### 驗證方式

- `npm test` 通過（nicknameReview integration tests 全綠）
- `curl -H "Authorization: Bearer <token>" http://localhost:3000/api/players/nickname/reviews` 回傳 200 + 待審核列表

---

## Task 5.4: 後端 report module + integration tests

### 建立 / 修改檔案

1. `server/src/module/report/service.ts`
   — `ReportService(db: Knex, blacklistService: BlacklistService)`
   — `list(query: TReportQuery)` — 篩選（預設 `status='pending'`），搜尋條件，分頁，`ORDER BY created_at DESC`
   — `approve(id: number, operator: string)` — transaction：確認 pending → UPDATE approved → `blacklistService.create()` + catch ALREADY_BLOCKED
   — `reject(id: number, operator: string)` — 確認 pending → UPDATE rejected

2. `server/src/module/report/controller.ts`
   — `ReportController(service: ReportService)`
   — `list`, `approve`, `reject` 方法
   — approve / reject 需設定 `res.locals.operationLog = { operationType: 'APPROVE_REPORT' | 'REJECT_REPORT', targetId: id }`

3. `server/src/module/report/route.ts`
   — `createReportRoutes(db: Knex): Router`
   — `GET /` → `auth, requirePermission('report:read'), controller.list`
   — `POST /:id/approve` → `auth, requirePermission('report:review'), controller.approve`
   — `POST /:id/reject` → `auth, requirePermission('report:review'), controller.reject`
   — 路由函式內實例化 `BlacklistService(db)` 並注入 `ReportService`

4. `server/src/app.ts` — 掛載路由：`app.use('/api/reports', createReportRoutes(db))`

5. `server/src/__tests__/integration/report.test.ts`
   — 覆蓋 Gherkin `@happy_path`、`@auto_block`、`@already_reviewed`、`@validation`、`@permissions` 場景
   — 關鍵 cases：
   - GET 列出待審核 / 依 status 篩選
   - POST approve 成功（驗證 reports.status + blacklist.is_blocked）
   - POST approve 已封鎖玩家 → 成功（不報錯）
   - POST approve 已審核 report → 409
   - POST reject 成功
   - POST reject 已審核 report → 409
   - POST approve/reject 不存在 id → 404
   - transaction 失敗時 report 狀態應 rollback

### 設計要點

- Transaction 確保「更新 report + 封鎖玩家」原子性，任一失敗全部 rollback
- `BLACKLIST_ALREADY_BLOCKED` 靜默忽略；其他 BlacklistService 錯誤應 rethrow
- `id` 路徑參數需做 `parseInt` 並驗證為有效整數，無效時回傳 400

### 驗證方式

- `npm test` 通過（report integration tests 全綠）
- 手動測試 approve：core flow + blacklist 效果
- 手動測試 approve 已封鎖玩家：確認不回傳 409

---

## Task 5.5: Seed 資料

### 修改 / 建立檔案

1. `server/db/seeds/04_players.ts`
   — 在既有 player016 / player017 / player018 的物件中新增 `nickname_apply_at` 欄位
   — 新增 player019 / player020（`nickname_approved: false`，分別設定 `nickname_apply_at`）
   — 確保共 5 筆待審核暱稱申請
   — 參照 [rfc_05 §5.12](rfc_05-nickname-and-report.md)

2. `server/db/seeds/08_reports.ts`
   — 5 筆 reports（2 pending、2 approved、1 rejected）
   — `chat_message` 欄位填入合理的聊天訊息快照
   — `reviewed_at` 對 approved / rejected 筆數填入有效日期
   — 參照 [rfc_05 §5.12](rfc_05-nickname-and-report.md)

### 驗證方式

- `npm run db:seed` 成功執行，無錯誤
- 資料庫查詢確認 players 有 5 筆 `nickname_approved=false` + `nickname_apply_at` 不為 null
- 資料庫查詢確認 reports 有 5 筆，3 種 status 皆有

---

## Task 5.6: 前端 NicknameReviewPage + component tests

### 建立 / 修改檔案

1. `client/src/api/nicknameReview.ts`
   — `getNicknameReviews(params: TNicknameReviewQuery)` → `GET /api/players/nickname/reviews`
   — `approveNickname(username: string)` → `POST /api/players/:username/nickname/approve`
   — `rejectNickname(username: string)` → `POST /api/players/:username/nickname/reject`

2. `client/src/pages/NicknameReviewPage.tsx`
   — 搜尋區（玩家帳號 Input、申請暱稱 Input、申請時間 DateRangePicker）
   — 資料表格（申請時間、玩家帳號、申請暱稱、操作按鈕）
   — Per-row loading state：`loadingUsername: string | null`
   — 核准 / 駁回前顯示 `Modal.confirm`
   — 操作成功後自動 refetch
   — 時間顯示 UTC+8 格式（`dayjs().utcOffset(8)`）
   — 樣式使用 `createStyles`，顏色使用 Antd design token
   — 參照 [rfc_05 §5.13](rfc_05-nickname-and-report.md)

3. `client/src/layouts/AdminLayout.tsx`
   — 修正 sidebar item key：`'/nickname-requests'` → `'/nickname-reviews'`
   — 參照 [rfc_05 §5.15](rfc_05-nickname-and-report.md)

4. `client/src/router.tsx`
   — 新增路由 `{ path: 'nickname-reviews', element: <ProtectedRoute permission="nickname:read"><NicknameReviewPage /></ProtectedRoute> }`

5. `client/src/__tests__/pages/NicknameReviewPage.test.tsx`
   — 頁面正常渲染，顯示待審核列表
   — 搜尋條件互動（輸入關鍵字 → API 帶對應 query params）
   — 點擊「核准」按鈕顯示確認 Modal，確認後呼叫 approve API
   — 點擊「駁回」按鈕顯示確認 Modal，確認後呼叫 reject API
   — Loading state 期間按鈕禁用

### 驗證方式

- 前端頁面 `/nickname-reviews` 正確渲染待審核列表
- 核准 / 駁回流程完整（確認 Modal → API 呼叫 → 列表更新）
- Sidebar「暱稱審核」項目在 `/nickname-reviews` 頁面時正確高亮
- `npm test` 通過（NicknameReviewPage component tests 全綠）

---

## Task 5.7: 前端 ReportReviewPage + component tests

### 建立 / 修改檔案

1. `client/src/api/report.ts`
   — `getReports(params: TReportQuery)` → `GET /api/reports`
   — `approveReport(id: number)` → `POST /api/reports/:id/approve`
   — `rejectReport(id: number)` → `POST /api/reports/:id/reject`

2. `client/src/pages/ReportReviewPage.tsx`
   — 搜尋區（狀態 Select、檢舉人 Input、被檢舉玩家 Input、舉報時間 DateRangePicker）
   — 資料表格（舉報時間、檢舉人、被檢舉玩家、聊天室、原因 Tag、訊息內容、狀態 Tag、審核者、操作按鈕）
   — 狀態 Tag 顏色：`pending=orange`, `approved=green`, `rejected=red`
   — 原因 Tag 顏色：`spam=orange`, `abuse=red`, `advertisement=blue`
   — 訊息內容欄位截斷顯示，完整內容以 Tooltip 呈現
   — Per-row loading state：`loadingId: number | null`
   — `status !== 'pending'` 時操作按鈕 disabled
   — 核准時 `Modal.confirm` 提示「核准後將自動封鎖被檢舉玩家」
   — 操作成功後自動 refetch
   — 時間顯示 UTC+8 格式
   — 狀態篩選預設值為 `'pending'`
   — 樣式使用 `createStyles`，顏色使用 Antd design token
   — 參照 [rfc_05 §5.14](rfc_05-nickname-and-report.md)

3. `client/src/router.tsx`
   — 新增路由 `{ path: 'reports', element: <ProtectedRoute permission="report:read"><ReportReviewPage /></ProtectedRoute> }`

4. `client/src/__tests__/pages/ReportReviewPage.test.tsx`
   — 頁面正常渲染，顯示待審核列表（預設 status=pending）
   — 狀態 Select 切換後 API 帶對應 status 參數
   — 非 pending 紀錄的操作按鈕應 disabled
   — 點擊「核准」按鈕顯示包含封鎖提示的確認 Modal
   — 核准確認後呼叫 approve API，列表更新
   — Loading state 期間按鈕禁用

### 驗證方式

- 前端頁面 `/reports` 正確渲染待審核檢舉列表
- 核准操作：確認 Modal 有「自動封鎖」提示 → API 呼叫 → 列表更新
- 已審核紀錄的操作按鈕正確 disabled
- `npm test` 通過（ReportReviewPage component tests 全綠）

---

## 執行順序

```
Task 5.1 (DB Migration)
    ↓
Task 5.2 (Shared types & schemas)
    ↓
Task 5.3 (後端 nicknameReview)  ←→  Task 5.4 (後端 report)
    ↓                                         ↓
                Task 5.5 (Seed 資料)
                         ↓
Task 5.6 (前端 NicknameReviewPage)  ←→  Task 5.7 (前端 ReportReviewPage)
```

**依賴關係**：

- Task 5.3、5.4 依賴 5.1（schema）、5.2（types）
- Task 5.5 依賴 5.1（migration 必須先執行）
- Task 5.6、5.7 依賴 5.2（types）、5.3、5.4（API 確定後開發前端）
- Task 5.3、5.4 可並行開發

---

## 完成檢查清單

### DB & Seed

- [x] migration 20260317000008 執行後 players 表含 `nickname_apply_at` 欄位
- [x] migration 20260317000009 執行後 reports 表結構正確（無 deleted_at）
- [x] Seed 執行後有 5 筆 `nickname_approved=false` 玩家（含 nickname_apply_at）
- [x] Seed 執行後有 5 筆 reports（pending / approved / rejected 三種狀態皆有）

### 後端 API

- [x] `GET /api/players/nickname/reviews` 回傳待審核列表（含分頁與篩選）
- [x] `POST /api/players/:username/nickname/approve` 核准後 `nickname_review_status=approved`
- [x] `POST /api/players/:username/nickname/reject` 駁回後 `nickname=username`
- [x] 重複操作已核准玩家 → 409 `PLAYER_NICKNAME_NOT_PENDING`
- [x] `GET /api/reports` 預設回傳 status=pending 列表（含分頁與篩選）
- [x] `POST /api/reports/:id/approve` 核准後 `status=approved` + 目標玩家被封鎖
- [x] `POST /api/reports/:id/approve` 目標玩家已封鎖時不報錯
- [x] `POST /api/reports/:id/reject` 駁回後 `status=rejected`
- [x] 重複操作已審核 report → 409 `REPORT_ALREADY_REVIEWED`
- [x] 所有操作寫入 operation_logs（APPROVE_NICKNAME, REJECT_NICKNAME, APPROVE_REPORT, REJECT_REPORT）
- [x] 未攜帶 JWT → 401；缺少對應 permission → 403

### 前端

- [x] NicknameReviewPage 正確顯示待審核列表
- [x] 核准 / 駁回流程含確認 Modal 與 per-row loading state
- [x] ReportReviewPage 正確顯示待審核列表（預設 status=pending）
- [x] 核准 Modal 有「自動封鎖」提示
- [x] 非 pending 紀錄的操作按鈕 disabled
- [x] Sidebar `/nickname-reviews` key 修正，選單高亮正確

### 測試

- [x] `npm test` 全部通過
- [x] Integration: nicknameReview.test.ts 全綠
- [x] Integration: report.test.ts 全綠（含 approve → block 場景）
- [x] Component: NicknameReviewPage.test.tsx 全綠
- [x] Component: ReportReviewPage.test.tsx 全綠

### 文件

- [x] rfc_01 §5.9 Route 權限對照表已更新（新增 Phase 5 路由）

---

## Phase 5C：Nickname Review 改用 Status 設計

**背景**：Phase 5 使用 `nickname_approved`（boolean）標記待審核狀態，設計與 `reports.status`（'pending' | 'approved' | 'rejected'）不一致。本 Phase 統一為 status 欄位設計，並在 NicknameReviewPage 加入 status 篩選器與欄位。

**關鍵設計決策**：

- `nickname_apply_at` 在 approve/reject 後**保留**（不設 null），對齊 `reports.created_at` 永不清除的慣例，歷史列表可按申請時間排序
- 所有狀態的列表皆以 `ORDER BY nickname_apply_at ASC` 排序

**受影響檔案**：

| 動作   | 路徑                                                                        |
| ------ | --------------------------------------------------------------------------- |
| Create | `server/db/migrations/20260318000010_nickname_review_status.ts`             |
| Modify | `server/db/seeds/04_players.ts`                                             |
| Modify | `shared/types/nicknameReview.ts`                                            |
| Modify | `shared/schemas/nicknameReview.ts`                                          |
| Modify | `server/src/module/nicknameReview/service.ts`                               |
| Modify | `server/src/module/nicknameReview/controller.ts`                            |
| Modify | `server/src/__tests__/helpers/testDb.ts`                                    |
| Modify | `server/src/__tests__/integration/nicknameReview.test.ts`                   |
| Modify | `server/src/__tests__/integration/report.test.ts`（移除 nickname_approved） |
| Modify | `client/src/pages/NicknameReviewPage.tsx`                                   |
| Modify | `client/src/__tests__/pages/NicknameReviewPage.test.tsx`                    |
| Modify | `00_doc/rfc_03-chatroom-and-chat.md`                                        |
| Modify | `00_doc/rfc_05-nickname-and-report.md`                                      |
| Modify | `00_doc/prd_00-chat_management_backstage.md`                                |

---

## Task 5C.1: DB Migration — 新增 nickname_review_status，移除 nickname_approved

### 建立 / 修改檔案

1. `server/db/migrations/20260318000010_nickname_review_status.ts`
   - `up()`：
     1. `alterTable('players')` 新增 `nickname_review_status VARCHAR(20) nullable`、`nickname_reviewed_by VARCHAR(50) nullable`、`nickname_reviewed_at DATETIME nullable`
     2. 資料遷移：`knex('players').whereRaw('nickname_approved = ? AND nickname_apply_at IS NOT NULL', [false]).update({ nickname_review_status: 'pending' })`
     3. `alterTable('players')` dropColumn `nickname_approved`
   - `down()`：
     1. `alterTable('players')` 新增回 `nickname_approved BOOLEAN NOT NULL DEFAULT true`
     2. 資料回遷：`nickname_review_status='pending'` → `nickname_approved=false`
     3. `alterTable('players')` dropColumn 三個新欄位

2. `server/db/seeds/04_players.ts`
   - 移除所有 `nickname_approved` 欄位
   - player016~020 改為 `nickname_review_status: 'pending'`（不帶 `nickname_apply_at: null` 設定，保留原有值）
   - player001~015 不帶 `nickname_review_status`（null）

### 步驟

- [ ] 新增 migration `20260318000010_nickname_review_status.ts`
- [ ] 更新 `server/db/seeds/04_players.ts`
- [ ] `git add server/db/migrations/20260318000010_nickname_review_status.ts server/db/seeds/04_players.ts`
- [ ] `git commit -m "feat(db): 新增 nickname_review_status 欄位，移除 nickname_approved"`

---

## Task 5C.2: Shared Layer — 更新 Types 與 Schema

### 建立 / 修改檔案

1. `shared/types/nicknameReview.ts`

   ```typescript
   export type TNicknameReviewStatus = 'pending' | 'approved' | 'rejected';

   export type TNicknameReviewItem = {
     username: string;
     nickname: string;
     nickname_apply_at: string | null;
     nickname_review_status: TNicknameReviewStatus | null;
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

2. `shared/schemas/nicknameReview.ts`
   - 新增 `status: z.enum(['pending', 'approved', 'rejected']).optional()` 至 `nicknameReviewQuerySchema`

### 步驟

- [ ] 更新 `shared/types/nicknameReview.ts`
- [ ] 更新 `shared/schemas/nicknameReview.ts`
- [ ] `git commit -m "feat(shared): nicknameReview 改用 TNicknameReviewStatus 設計"`

---

## Task 5C.3: 後端 Service + Controller — 改用 nickname_review_status

### 建立 / 修改檔案

1. `server/src/module/nicknameReview/service.ts`
   - `list()`：`status = query.status ?? 'pending'`，改為 `.where('nickname_review_status', status)`；`select()` 新增三個新欄位；排序維持 `ORDER BY nickname_apply_at ASC`
   - `approve(username, operator)`：
     - 加入 `operator: string` 第二參數
     - 檢查改為 `player.nickname_review_status !== 'pending'` → 拋 `PLAYER_NICKNAME_NOT_PENDING`
     - update 改為 `{ nickname_review_status: 'approved', nickname_reviewed_by: operator, nickname_reviewed_at: db.fn.now(), updated_at: db.fn.now() }`（**移除 `nickname_apply_at: null`**）
   - `reject(username, operator)`：
     - 同上，status 改為 `'rejected'`，保留 `nickname: username` 重設，**移除 `nickname_apply_at: null`**

2. `server/src/module/nicknameReview/controller.ts`
   - `approve` 與 `reject` 的 service 呼叫補上 `req.user!.username` 作為第二個參數

### 步驟

- [ ] 更新 `service.ts`
- [ ] 更新 `controller.ts`
- [ ] `git commit -m "feat(server): nicknameReview 改用 nickname_review_status，保留 nickname_apply_at"`

---

## Task 5C.4: Test Helper + Integration Tests

### 建立 / 修改檔案

1. `server/src/__tests__/helpers/testDb.ts`
   - players schema：移除 `table.boolean('nickname_approved').notNullable().defaultTo(true)`
   - 新增三欄：`nickname_review_status VARCHAR(20) nullable`、`nickname_reviewed_by VARCHAR(50) nullable`、`nickname_reviewed_at DATETIME nullable`

2. `server/src/__tests__/integration/nicknameReview.test.ts`
   - `beforeAll` 插入資料：移除所有 `nickname_approved`，pending 玩家改用 `nickname_review_status: 'pending'`，`player021` 改用 `nickname_review_status: 'approved'`
   - approve 斷言：移除 `expect(player.nickname_approved).toBe(1)`，改為 `expect(player.nickname_review_status).toBe('approved')`，新增 `expect(player.nickname_reviewed_by).toBeTruthy()`
   - approve 斷言：`nickname_apply_at` **不再斷言為 null**（已保留）
   - reject 斷言：同上，status 改為 `'rejected'`，`nickname_apply_at` 同樣保留
   - 新增測試：`GET /api/players/nickname/reviews?status=approved` → 回傳 approved 列表

3. `server/src/__tests__/integration/report.test.ts`
   - 插入 players 資料：移除所有 `nickname_approved: true`（欄位已不存在）

### 步驟

- [ ] 更新 `testDb.ts` players schema
- [ ] 更新 `nicknameReview.test.ts` 資料插入與斷言，新增 status 篩選測試
- [ ] 更新 `report.test.ts` 移除 `nickname_approved: true`
- [ ] 執行 `npx vitest run server/src/__tests__/integration/nicknameReview.test.ts` 確認全綠
- [ ] 執行 `npx vitest run server/src/__tests__/integration/report.test.ts` 確認全綠
- [ ] `git commit -m "test(server): 更新 integration tests 對齊 nickname_review_status"`

---

## Task 5C.5: 前端 NicknameReviewPage — Status 篩選 + 欄位

### 建立 / 修改檔案

`client/src/pages/NicknameReviewPage.tsx`

- Import 新增：`Select`、`Tag`（from `antd`）；`TNicknameReviewStatus` from shared
- 新增常數（仿照 `ReportReviewPage`）：
  ```typescript
  const STATUS_COLOR: Record<TNicknameReviewStatus, string> = {
    pending: 'orange',
    approved: 'green',
    rejected: 'red',
  };
  const STATUS_LABEL: Record<TNicknameReviewStatus, string> = {
    pending: '待審核',
    approved: '已核准',
    rejected: '已駁回',
  };
  ```
- 新增 state：`const [statusFilter, setStatusFilter] = useState<TNicknameReviewStatus>('pending')`
- `fetchData` params 加入 `params.status = statusFilter`
- `handleReset` 加入 `setStatusFilter('pending')`
- 篩選列最前面加 `<Select>` 選擇狀態（對齊 `ReportReviewPage` 的 statusFilter Select）
- `columns` 新增 `nickname_review_status` 欄（Tag）與 `nickname_reviewed_by` 欄（`val ?? '—'`）
- 操作欄：`const isPending = record.nickname_review_status === 'pending'`；按鈕 `disabled={!isPending || (loadingUsername !== null && loadingUsername !== record.username)}`

### 步驟

- [ ] 更新 `NicknameReviewPage.tsx`
- [ ] `git commit -m "feat(client): NicknameReviewPage 加入 status 篩選與 status/審核者欄位"`

---

## Task 5C.6: 前端元件測試更新

### 建立 / 修改檔案

`client/src/__tests__/pages/NicknameReviewPage.test.tsx`

- `mockData` 各筆加入 `nickname_review_status: 'pending'`、`nickname_reviewed_by: null`、`nickname_reviewed_at: null`
- 新增測試：頁面初始 API 呼叫帶有 `status: 'pending'`
- 新增測試：`nickname_review_status: 'approved'` 的列 — 核准/駁回按鈕為 disabled

### 步驟

- [ ] 更新 `mockData`
- [ ] 新增兩個測試案例
- [ ] 執行 `npx vitest run` 確認全綠
- [ ] `git commit -m "test(client): NicknameReviewPage 測試對齊 status 設計"`

---

## Task 5C.7: 更新 RFC + PRD 文件

### 建立 / 修改檔案

1. `00_doc/rfc_03-chatroom-and-chat.md`
   - players schema 表格：移除 `nickname_approved BOOLEAN DEFAULT true`，新增三欄（`nickname_review_status`、`nickname_reviewed_by`、`nickname_reviewed_at`）
   - seed 描述（line 388~389）：`nickname_approved = true/false` → `nickname_review_status IS NULL / = 'pending'`

2. `00_doc/rfc_05-nickname-and-report.md`
   - §3.1 DB Schema 表格：改為 status 三欄，說明 `nickname_apply_at` 審核後保留
   - §5.3 篩選邏輯：`WHERE nickname_approved = false` → `WHERE nickname_review_status = status`；Response 範例新增三欄
   - §5.4 approve 行為：update 欄位改為 status/reviewed_by/reviewed_at，移除 `nickname_apply_at = null` 說明
   - §5.5 reject 行為：同上
   - §5.10 service 方法說明：更新 approve/reject 簽名與邏輯
   - §5.12 seed 表格：移除 `nickname_approved` 欄，加 `nickname_review_status` 欄
   - §5.16 shared types 程式碼：更新為新型別定義
   - §6.2 integration test scenarios：`nickname_approved=false/true` → `nickname_review_status`
   - §8 完成標準：更新 nickname_approved 相關條目

3. `00_doc/prd_00-chat_management_backstage.md`
   - §7 seed 資料說明（line 218）：`5 筆 nickname_approved=false` → `5 筆 nickname_review_status='pending'`

### 步驟

- [ ] 更新 `rfc_03-chatroom-and-chat.md`
- [ ] 更新 `rfc_05-nickname-and-report.md`
- [ ] 更新 `prd_00-chat_management_backstage.md`
- [ ] `git commit -m "docs: 更新 rfc_03/rfc_05/prd_00 對齊 nickname_review_status 設計"`

---

## Task 5C.8: Prettier Format

### 步驟

- [ ] 執行 prettier 格式化所有本次修改的程式碼檔案：
  ```bash
  npx prettier --write \
    server/db/migrations/20260318000010_nickname_review_status.ts \
    server/db/seeds/04_players.ts \
    shared/types/nicknameReview.ts \
    shared/schemas/nicknameReview.ts \
    server/src/module/nicknameReview/service.ts \
    server/src/module/nicknameReview/controller.ts \
    server/src/__tests__/helpers/testDb.ts \
    server/src/__tests__/integration/nicknameReview.test.ts \
    server/src/__tests__/integration/report.test.ts \
    client/src/pages/NicknameReviewPage.tsx \
    "client/src/__tests__/pages/NicknameReviewPage.test.tsx"
  ```
- [ ] `git commit -m "style: prettier format Phase 5C 變更"`

---

## Phase 5C 完成檢查清單

### DB & Seed

- [x] migration 20260318000010 執行後 players 含 `nickname_review_status`、`nickname_reviewed_by`、`nickname_reviewed_at`，且無 `nickname_approved`
- [x] Seed 執行後 player016~020 的 `nickname_review_status = 'pending'`，`nickname_apply_at` 保留

### 後端 API

- [x] `GET /api/players/nickname/reviews` 預設回傳 `nickname_review_status=pending` 列表
- [x] `GET /api/players/nickname/reviews?status=approved` 回傳 approved 列表
- [x] approve 後：`nickname_review_status='approved'`、`nickname_reviewed_by` 有值、`nickname_apply_at` **不為 null**
- [x] reject 後：`nickname_review_status='rejected'`、`nickname=username`、`nickname_apply_at` **不為 null**
- [x] 重複操作非 pending 玩家 → 409 `PLAYER_NICKNAME_NOT_PENDING`

### 前端

- [x] NicknameReviewPage 有 status Select 篩選（預設「待審核」）
- [x] 列表有 status Tag 欄與審核者欄
- [x] 非 pending 的操作按鈕 disabled

### 測試

- [x] server 175/175、client 75/75 全部通過

### 文件

- [x] rfc_03 players schema 更新
- [x] rfc_05 相關章節更新
- [x] prd_00 seed 說明更新
