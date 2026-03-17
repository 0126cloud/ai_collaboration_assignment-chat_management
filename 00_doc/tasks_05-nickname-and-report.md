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

5. `server/src/app.ts` — 掛載路由：`app.use('/api/nickname_reviews', createNicknameReviewRoutes(db))`

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
- `curl -H "Authorization: Bearer <token>" http://localhost:3000/api/nickname_reviews` 回傳 200 + 待審核列表

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
   — `getNicknameReviews(params: TNicknameReviewQuery)` → `GET /api/nickname_reviews`
   — `approveNickname(username: string)` → `POST /api/nickname_reviews/:username/approve`
   — `rejectNickname(username: string)` → `POST /api/nickname_reviews/:username/reject`

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

- [ ] migration 20260317000008 執行後 players 表含 `nickname_apply_at` 欄位
- [ ] migration 20260317000009 執行後 reports 表結構正確（無 deleted_at）
- [ ] Seed 執行後有 5 筆 `nickname_approved=false` 玩家（含 nickname_apply_at）
- [ ] Seed 執行後有 5 筆 reports（pending / approved / rejected 三種狀態皆有）

### 後端 API

- [ ] `GET /api/nickname_reviews` 回傳待審核列表（含分頁與篩選）
- [ ] `POST /api/nickname_reviews/:username/approve` 核准後 `nickname_approved=true`, `nickname_apply_at=null`
- [ ] `POST /api/nickname_reviews/:username/reject` 駁回後 `nickname=username`
- [ ] 重複操作已核准玩家 → 409 `PLAYER_NICKNAME_NOT_PENDING`
- [ ] `GET /api/reports` 預設回傳 status=pending 列表（含分頁與篩選）
- [ ] `POST /api/reports/:id/approve` 核准後 `status=approved` + 目標玩家被封鎖
- [ ] `POST /api/reports/:id/approve` 目標玩家已封鎖時不報錯
- [ ] `POST /api/reports/:id/reject` 駁回後 `status=rejected`
- [ ] 重複操作已審核 report → 409 `REPORT_ALREADY_REVIEWED`
- [ ] 所有操作寫入 operation_logs（APPROVE_NICKNAME, REJECT_NICKNAME, APPROVE_REPORT, REJECT_REPORT）
- [ ] 未攜帶 JWT → 401；缺少對應 permission → 403

### 前端

- [ ] NicknameReviewPage 正確顯示待審核列表
- [ ] 核准 / 駁回流程含確認 Modal 與 per-row loading state
- [ ] ReportReviewPage 正確顯示待審核列表（預設 status=pending）
- [ ] 核准 Modal 有「自動封鎖」提示
- [ ] 非 pending 紀錄的操作按鈕 disabled
- [ ] Sidebar `/nickname-reviews` key 修正，選單高亮正確

### 測試

- [ ] `npm test` 全部通過
- [ ] Integration: nicknameReview.test.ts 全綠
- [ ] Integration: report.test.ts 全綠（含 approve → block 場景）
- [ ] Component: NicknameReviewPage.test.tsx 全綠
- [ ] Component: ReportReviewPage.test.tsx 全綠

### 文件

- [ ] rfc_01 §5.9 Route 權限對照表已更新（新增 Phase 5 路由）
