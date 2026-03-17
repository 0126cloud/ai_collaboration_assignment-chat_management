# Phase 2: 操作紀錄模組

## 背景

Phase 1 完成認證與基礎設施後，需建立操作紀錄的完整功能 — 包含 schema 重構、統一寫入機制、查詢 API 與前端頁面。所有技術設計詳見 [rfc_02-operation-logs.md](rfc_02-operation-logs.md)，驗收規格見 [operation-logs.feature](operation-logs.feature)。

## 前置條件

- Phase 1 全部完成（Task 1.1~1.11t）
- `npm run dev` 前後端正常啟動
- `npm test` 全部通過

---

## Task 2.1: DB Migration 重建 + Seed

重新設計 `operation_logs` 表 schema，改用 `request` JSON 欄位記錄完整請求資訊。

**修改檔案：**

1. `server/db/migrations/20260317000001_create_operation_logs.ts`
   - 替換為新 schema：`id`、`operation_type`(VARCHAR50)、`operator_id`(INT)、`operator`(VARCHAR50)、`request`(TEXT/JSON)、`created_at`(DATETIME)
   - 建立索引：`operation_type`、`operator_id`、`created_at`
   - 參照 [rfc_02 §5.1](rfc_02-operation-logs.md)

**建立檔案：**

2. `server/db/seeds/02_operation_logs.ts`
   - 20 筆 mock data，涵蓋 14 種操作類型
   - 操作者分佈 admin01 / admin02，時間分佈近 30 天
   - 每筆含完整 `request` JSON（url、method、payload）
   - 參照 [rfc_02 §5.5](rfc_02-operation-logs.md)

**修改檔案：**

3. `server/src/__tests__/helpers/testDb.ts`
   - 更新 `operation_logs` 測試 schema 為新結構（operation_type、operator_id、operator、request、created_at）

### 驗證方式

- `npm run db:migrate:rollback` + `npm run db:migrate` 成功
- `npm run db:seed` 成功插入 20 筆操作紀錄
- SQLite 查詢確認欄位正確、`request` 為可 parse 的 JSON 字串
- 現有測試（`npm test`）不因 schema 變更而失敗（需先完成 Task 2.2、2.3）

---

## Task 2.2: operationLogger afterware middleware

建立統一的操作紀錄寫入中間件，取代 Phase 1 直接在 service 層呼叫 `writeOperationLog()` 的方式。

**建立檔案：**

1. `server/src/middleware/operationLogger.ts`
   - 監聽 `res.on('finish')` 事件
   - 條件：`res.locals.operationLog` 存在 且回應狀態碼為 2xx
   - 自動從 `req` 取得：`operator_id`（`req.user.id`）、`operator`（`req.user.username`）
   - 自動組裝 `request` JSON：`{ url: req.originalUrl, method: req.method, payload: sanitizePayload(req.body) }`
   - Controller 只需設定 `res.locals.operationLog = { operationType: 'XXX' }`
   - 敏感欄位過濾：`password`、`newPassword`、`oldPassword`、`password_hash` → `***`
   - 寫入失敗靜默處理（console.error），不影響已送出的回應
   - 參照 [rfc_02 §5.2](rfc_02-operation-logs.md)

**修改檔案：**

2. `server/src/app.ts`
   - 在路由掛載之前掛載 `app.use(operationLogger)`

**移除檔案：**

3. `server/src/utils/operationLogModule.ts`
   - 被 `operationLogger` middleware 取代

### 驗證方式

- 任何設定了 `res.locals.operationLog` 的路由，成功回應後 DB 中出現對應紀錄
- 未設定 `res.locals.operationLog` 的路由不會產生紀錄
- 失敗回應（4xx/5xx）不產生紀錄
- request JSON 中密碼欄位被替換為 `***`

---

## Task 2.3: 重構 Phase 1 — 改用 afterware 模式

將 Phase 1 中直接呼叫 `writeOperationLog()` 的程式碼改為設定 `res.locals.operationLog`。

**修改檔案：**

1. `server/src/module/admin/service.ts`
   - 移除 `writeOperationLog()` 呼叫
   - 移除 `import { writeOperationLog }`

2. `server/src/module/admin/controller.ts`
   - `createAdmin` 方法新增：`res.locals.operationLog = { operationType: 'CREATE_ADMIN' }`

3. `server/src/module/auth/controller.ts`
   - `changePassword` 方法新增：`res.locals.operationLog = { operationType: 'CHANGE_PASSWORD' }`

### 驗證方式

- 新增管理員後，`operation_logs` 表有新紀錄，且 `request` JSON 包含 url、method、payload（密碼為 `***`）
- 修改密碼後，`operation_logs` 表有新紀錄
- `npm test` 現有測試仍全部通過（可能需先更新 Task 2.3t）

### Task 2.3t: Integration Tests — operationLogger + 相容性

**修改** `server/src/__tests__/integration/admin.create.test.ts`

**更新測試案例：**

- 原有「operation_logs 有寫入紀錄」案例 → 改為驗證新 schema 欄位（operation_type、operator、request JSON）
- 新增：驗證 request.payload 不包含 password 明文
- 新增：驗證 request.url 為 `/api/admins`、request.method 為 `POST`

**建立** `server/src/__tests__/unit/operationLogger.test.ts`

**測試案例：**

- 有 `res.locals.operationLog` + 2xx 狀態碼 → 寫入 DB
- 無 `res.locals.operationLog` → 不寫入
- 4xx 狀態碼 → 不寫入
- `sanitizePayload` 過濾敏感欄位（password → `***`）
- DB 寫入失敗 → 不拋出錯誤（靜默處理）

對應 Gherkin：`@integration 新增管理員後自動產生操作紀錄`、`@integration 修改密碼後自動產生操作紀錄`

---

## Task 2.4: 後端 operationLog module — GET API

建立操作紀錄查詢 API。

**建立檔案：**

1. `shared/types/operationLog.ts`
   - `TOperationType` — 操作類型枚舉（`CREATE_ADMIN`、`DELETE_MESSAGE`、`BLOCK_PLAYER` 等 14 種）
   - `TOperationLogItem` — 單筆紀錄型別
   - `TOperationLogQuery` — 查詢參數型別（page、pageSize、operationType、operator、startDate、endDate）
   - 參照 [rfc_02 §5.3](rfc_02-operation-logs.md)

2. `shared/schemas/operationLog.ts`
   - `operationLogQuerySchema` — Zod schema 驗證查詢參數（page >= 1、pageSize 1~100）

3. `server/src/module/operationLog/service.ts`
   - `list(query)` — 組裝 Knex 查詢（篩選 + 分頁 + 排序 desc）
   - `operation_type` 精確比對
   - `operator` 模糊搜尋（LIKE）
   - `startDate`/`endDate` 範圍查詢
   - parse `request` JSON 字串為物件後回傳
   - 參照 [rfc_02 §5.4](rfc_02-operation-logs.md)

4. `server/src/module/operationLog/controller.ts`
   - `list(req, res)` — 使用 `ResponseHelper.paginated()` 回傳

5. `server/src/module/operationLog/route.ts`
   - `GET /` — `auth` → `requirePermission('operation_log:read')` → `ctrl.list`

**修改檔案：**

6. `server/src/app.ts`
   - 掛載 `app.use('/api/operation-logs', operationLogRoutes)`

7. `shared/index.ts`
   - re-export operationLog schemas 和 types

**安裝依賴（若尚未安裝）：**

8. `client/`：`dayjs`（用於前端時區轉換）

### 驗證方式

```bash
# 查詢所有紀錄（預設分頁）
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/operation-logs
# 預期：{ success: true, data: [...], pagination: { page: 1, pageSize: 20, total, totalPages } }

# 篩選操作類型
curl -H "Authorization: Bearer $TOKEN" "http://localhost:3000/api/operation-logs?operationType=CREATE_ADMIN"
# 預期：所有紀錄的 operation_type 為 CREATE_ADMIN

# 篩選操作者
curl -H "Authorization: Bearer $TOKEN" "http://localhost:3000/api/operation-logs?operator=admin01"
# 預期：所有紀錄的 operator 包含 admin01

# 時間範圍
curl -H "Authorization: Bearer $TOKEN" "http://localhost:3000/api/operation-logs?startDate=2026-03-01&endDate=2026-03-15"
```

對應 Gherkin：`@happy_path 查看操作紀錄列表`

### Task 2.4t: Integration Tests — GET API

**建立** `server/src/__tests__/integration/operationLog.list.test.ts`

**測試案例：**

- 預設分頁查詢 → 200 + 資料 + pagination（`@happy_path`）
- 自訂 page/pageSize → 正確分頁（`@happy_path`）
- 篩選 operationType → 僅回傳符合類型（`@happy_path`）
- 篩選 operator（模糊搜尋）→ 回傳符合紀錄（`@happy_path`）
- 篩選 startDate + endDate → 回傳範圍內紀錄（`@happy_path`）
- 複合條件篩選 → 同時滿足（`@happy_path`）
- 無符合結果 → 200 + 空陣列 + total 0（`@validation`）
- page 為負數 → 400 VALIDATION_ERROR（`@validation`）
- general_manager → 200（`@permissions`）
- senior_manager → 200（`@permissions`）
- 未帶 token → 401（`@permissions`）
- 紀錄依 created_at 降冪排列
- response 中 request 欄位已 parse 為物件（非 JSON 字串）

---

## Task 2.5: 前端 OperationLogPage

建立操作紀錄頁面。

**建立檔案：**

1. `client/src/api/operationLog.ts`
   - `operationLogApi.list(params)` — GET /api/operation-logs
   - 使用 `@shared/types/operationLog` 型別

2. `client/src/pages/OperationLogPage.tsx`
   - 篩選區域（Antd Card）：
     - `Select` — 操作類型下拉（`TOperationType` 枚舉值）
     - `Input` — 操作者（模糊搜尋）
     - `DatePicker.RangePicker` — 時間範圍
     - `Button` — 查詢 / 重置
   - 資料表格（Antd Table）：
     - Column: 操作類型（operation_type）— 可考慮顯示中文標籤
     - Column: 操作者（operator）
     - Column: 請求資訊（request）— 展開或 tooltip 顯示 url/method/payload
     - Column: 操作時間（created_at）— dayjs UTC+8 格式化
   - 分頁：Antd Table 內建 pagination，對應 API 分頁參數
   - 樣式：使用 `createStyles` 管理，顏色/間距使用 token
   - 參照 [rfc_02 §5.6](rfc_02-operation-logs.md)

**修改檔案：**

3. `client/src/router.tsx`
   - 新增 `/operation-logs` 路由，包裹 `ProtectedRoute` + `permission="operation_log:read"`

### 驗證方式

1. 登入後點擊 Sidebar「操作紀錄」→ 顯示操作紀錄頁面
2. 頁面載入後自動查詢，表格顯示 mock data
3. 選擇操作類型 → 重新查詢 → 表格僅顯示該類型紀錄
4. 輸入操作者名稱 → 查詢 → 表格篩選
5. 選擇時間範圍 → 查詢 → 表格篩選
6. 點擊重置 → 清除所有篩選條件
7. 切換分頁 → 資料正確更新
8. 時間欄位顯示為 UTC+8 格式

對應 Gherkin：`@happy_path` 全系列、`@happy_path 前端時間顯示為 UTC+8 格式`

### Task 2.5t: Component Tests — OperationLogPage

**建立** `client/src/__tests__/pages/OperationLogPage.test.tsx`

**測試案例：**

- 頁面載入後呼叫 API 並渲染表格
- 表格包含操作類型、操作者、請求資訊、操作時間欄位
- 時間顯示為 UTC+8 格式
- 選擇操作類型篩選 → 重新呼叫 API（帶 operationType 參數）
- 點擊重置 → 清除篩選條件
- 分頁元件顯示正確的 total

---

## Task 2.7: 新增 LOGIN / LOGOUT 操作紀錄

新增登入與登出的操作紀錄寫入。LOGIN 路由不經過 auth middleware，需由 controller 手動帶入 operator 資訊。

**修改檔案：**

1. `shared/types/operationLog.ts`
   - `OPERATION_TYPES` 新增 `'LOGIN'`、`'LOGOUT'`
   - `OPERATION_TYPE_LABELS` 新增 `LOGIN: '管理員登入'`、`LOGOUT: '管理員登出'`

2. `server/src/middleware/operationLogger.ts`
   - operator 來源改為：`logData.operatorId ?? req.user?.id`
   - operator 帳號改為：`logData.operator ?? req.user?.username`
   - 允許 controller 透過 `res.locals.operationLog` 覆寫 operator 資訊
   - 參照 [rfc_02 §5.2 更新](rfc_02-operation-logs.md)

3. `server/src/module/auth/controller.ts`
   - `login` 成功後設定：
     `res.locals.operationLog = { operationType: 'LOGIN', operatorId: result.user.id, operator: result.user.username }`
     （因 login 不經過 auth middleware，需手動帶入 operator）
   - `logout` 成功前設定：
     `res.locals.operationLog = { operationType: 'LOGOUT' }`
     （logout 經過 auth middleware，`req.user` 有值，不需額外處理）

### 驗證方式

- 登入後 `operation_logs` 有 `LOGIN` 紀錄，operator 正確，password 為 `***`
- 登出後 `operation_logs` 有 `LOGOUT` 紀錄
- 登入失敗（401）不產生紀錄
- 未登入直接登出（401）不產生紀錄
- 現有測試（`npm test`）仍全部通過

### Task 2.7t: Integration Tests — LOGIN / LOGOUT 操作紀錄

**建立** `server/src/__tests__/integration/auth.operationLog.test.ts`

**測試案例：**

- 登入成功 → operation_logs 有 LOGIN 紀錄，operator 為登入者（`@integration`）
- 登入成功 → request.payload 中 password 為 `***`（`@integration`）
- 登入失敗（密碼錯誤）→ 不產生紀錄（`@integration`）
- 登出成功 → operation_logs 有 LOGOUT 紀錄（`@integration`）
- 未登入直接登出（401）→ 不產生紀錄（`@integration`）

對應 Gherkin：`@integration 登入後自動產生操作紀錄`、`@integration 登入失敗不產生操作紀錄`、`@integration 登出後自動產生操作紀錄`、`@integration 未登入直接登出不產生操作紀錄`

---

## Task 2.6: CLAUDE.md 更新

**修改** `CLAUDE.md`

- Document Routing table 新增操作紀錄相關文件
- Current progress 更新

### 驗證方式

- CLAUDE.md 中 Document Routing 包含 rfc_02、operation-logs.feature、tasks_02 的指引
- 連結路徑正確

---

## 執行順序

```
Task 2.1（DB Migration + Seed）
  ↓
Task 2.2（operationLogger afterware middleware）
  ↓
Task 2.3 → 2.3t（重構 Phase 1 + 測試）
  ↓
Task 2.4 → 2.4t（GET API + 測試）
  ↓
Task 2.5 → 2.5t（前端頁面 + 測試）
  ↓
Task 2.6（CLAUDE.md 更新）
  ↓
Task 2.7 → 2.7t（LOGIN / LOGOUT 操作紀錄 + 測試）
```

> Task 2.1~2.3 為重構現有程式碼，必須依序執行。Task 2.4 起為新功能開發，每個功能 task 後緊接對應的測試 task。Task 2.7 需在 2.2 完成後才可執行（依賴 operationLogger middleware）。

## Progress

| Task      | 狀態 | 完成日期   | 備註                                     |
| --------- | ---- | ---------- | ---------------------------------------- |
| Task 2.1  | ✅   | 2026-03-17 | Migration 新 schema + 20 筆 seed data   |
| Task 2.2  | ✅   | 2026-03-17 | operationLogger afterware middleware     |
| Task 2.3  | ✅   | 2026-03-17 | admin/auth controller 改用 res.locals    |
| Task 2.3t | ✅   | 2026-03-17 | unit + integration tests                 |
| Task 2.4  | ✅   | 2026-03-17 | GET /api/operation-logs + shared types   |
| Task 2.4t | ✅   | 2026-03-17 | 13 個 integration tests                  |
| Task 2.5  | ✅   | 2026-03-17 | OperationLogPage + 路由 + API 封裝       |
| Task 2.5t | ✅   | 2026-03-17 | 6 個 component tests                     |
| Task 2.6  | ✅   | 2026-03-17 | CLAUDE.md + tasks 狀態更新               |
| Task 2.7  | ✅   | 2026-03-17 | LOGIN/LOGOUT + operationLogger 覆寫支援  |
| Task 2.7t | ✅   | 2026-03-17 | 6 個 integration tests                   |

## 完成檢查清單

- [ ] `operation_logs` 表使用新 schema（operation_type + operator_id + operator + request JSON）
- [ ] `operationLogger` afterware middleware 正常運作
- [ ] 新增管理員帳號後 operation_logs 自動寫入（afterware 模式）
- [ ] 修改密碼後 operation_logs 自動寫入
- [ ] 登入後 operation_logs 自動寫入（LOGIN），operator 正確，password 為 `***`
- [ ] 登出後 operation_logs 自動寫入（LOGOUT）
- [ ] 登入失敗（401）不產生紀錄
- [ ] `GET /api/operation-logs` 回傳分頁資料
- [ ] 篩選條件正常運作（operationType / operator / startDate / endDate）
- [ ] request JSON 中密碼欄位已過濾為 `***`
- [ ] 前端 OperationLogPage 正確顯示操作紀錄
- [ ] 前端時間顯示為 UTC+8 格式
- [ ] Seed data 20 筆正常載入
- [ ] `npm test` 全部通過
