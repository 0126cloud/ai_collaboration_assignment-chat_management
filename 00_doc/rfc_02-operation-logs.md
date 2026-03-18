# RFC: 操作紀錄模組

## 1. 背景

Phase 1（[rfc_01](rfc_01-auth-and-response.md)）已建立 `operation_logs` 資料表與 `writeOperationLog()` 工具函式，目前僅在建立管理員帳號（`admin:create`）時寫入紀錄。

然而，Phase 1 的 schema 設計（`action`/`operator_id`/`operator_username`/`target`/`detail`）與產品需求有差異 — 需記錄完整的請求資訊（URL、Method、Payload），以便稽核追蹤。此外，尚未建立查詢 API 與前端頁面。

本 RFC 重新設計 operation_logs 的 DB schema 與寫入機制，並建立查詢 API + 前端操作紀錄頁面。

**範圍界定**：本 RFC 涵蓋 operation_logs schema 重構、寫入機制（afterware）、GET API、前端 OperationLogPage、時區處理策略。

---

## 2. 目標

- 重新設計 `operation_logs` DB schema，改用 `request` JSON 欄位記錄完整請求資訊
- 建立 `operationLogger` afterware middleware，統一操作紀錄寫入機制
- 建立 `GET /api/operation-logs` API（分頁 + 篩選）
- 建立前端 `OperationLogPage`（Antd Table + 篩選條件 + 分頁）
- 定義跨模組適用的時區處理策略（DB UTC+0 → 前端 UTC+8）

---

## 3. 提案

### 3.1 DB Schema 重新設計

取代 Phase 1 的 `20260317000001_create_operation_logs.ts` migration，改用以下 schema：

| 欄位           | 型別                               | 說明                                          |
| -------------- | ---------------------------------- | --------------------------------------------- |
| id             | INTEGER PRIMARY KEY AUTOINCREMENT  |                                               |
| operation_type | VARCHAR(50) NOT NULL               | 操作類型，如 `DELETE_MESSAGE`、`BLOCK_PLAYER` |
| operator_id    | INTEGER NOT NULL                   | 操作者 ID（關聯 admins.id）                   |
| operator       | VARCHAR(50) NOT NULL               | 操作者帳號（冗餘欄位，方便查詢顯示）          |
| request        | TEXT NOT NULL                      | JSON 格式：`{ url, method, payload }`         |
| created_at     | DATETIME DEFAULT CURRENT_TIMESTAMP | UTC+0 時間                                    |

**與 Phase 1 schema 的差異：**

| Phase 1 欄位         | Phase 2 欄位      | 變更說明                       |
| -------------------- | ----------------- | ------------------------------ |
| `action` VARCHAR(50) | `operation_type`  | 重新命名，語意更明確           |
| `operator_id` INT    | `operator_id`     | 保留                           |
| `operator_username`  | `operator`        | 縮短欄位名稱                   |
| `target` VARCHAR     | —（移入 request） | 合併至 request JSON 的 payload |
| `detail` TEXT        | —（移入 request） | 合併至 request JSON 的 payload |
| —                    | `request` TEXT    | 新增，記錄完整 HTTP 請求資訊   |

**`request` JSON 格式範例：**

```json
{
  "url": "/api/admins",
  "method": "POST",
  "payload": {
    "username": "admin04",
    "role": "general_manager"
  }
}
```

> 注意：`payload` 中不應包含敏感資訊（如密碼），寫入前需過濾。

### 3.2 操作紀錄寫入機制（res.locals + afterware）

取代 Phase 1 直接在 service 層呼叫 `writeOperationLog()` 的方式，改用 afterware 模式：

**流程：**

```
1. Controller 處理完業務邏輯
2. Controller 設定 res.locals.operationLog = { operationType, ... }
3. Controller 呼叫 ResponseHelper 回傳成功回應
4. operationLogger middleware（掛載在 app 層）監聽 res.on('finish')
5. 若回應狀態碼為 2xx 且 res.locals.operationLog 存在 → 寫入 DB
6. 寫入失敗不影響已送出的回應（靜默 log error）
```

**好處：**

- 寫入邏輯集中在一處，不散落在各 service 中
- 不會遺漏寫入（只要 controller 設定 `res.locals.operationLog`）
- 寫入失敗不影響 API 回應（回應已送出）

**Controller 端使用方式：**

```ts
async createAdmin(req: Request, res: Response) {
  const result = await adminService.createAdmin(req.body, req.user);

  res.locals.operationLog = {
    operationType: 'CREATE_ADMIN',
  };

  ResponseHelper.success(res, result, 201);
}
```

> `operationLogger` 自動從 `req` 取得 `operator_id`、`operator`（來自 auth middleware 的 `req.user`）和 `request`（來自 `req.method`、`req.originalUrl`、`req.body`）。Controller 只需設定 `operationType`。

### 3.3 時區處理策略（跨模組適用）

| 層級   | 時區  | 說明                                              |
| ------ | ----- | ------------------------------------------------- |
| 資料庫 | UTC+0 | SQLite `CURRENT_TIMESTAMP` 預設為 UTC             |
| API    | UTC+0 | 回傳原始 UTC 時間字串                             |
| 前端   | UTC+8 | 使用 dayjs 轉換為 `YYYY-MM-DD HH:mm:ss`（+8）顯示 |

**前端轉換方式：**

```ts
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

// 使用
dayjs.utc(record.created_at).tz('Asia/Taipei').format('YYYY-MM-DD HH:mm:ss');
```

此策略適用於所有模組的時間欄位，不僅限於 operation_logs。

---

## 4. 高層設計

### 4.1 新增/修改檔案結構

```
chat-management/
├── server/
│   ├── db/
│   │   ├── migrations/
│   │   │   └── 20260317000001_create_operation_logs.ts   # [修改] 替換為新 schema
│   │   └── seeds/
│   │       └── 02_operation_logs.ts                      # [新增] 20 筆 mock data
│   └── src/
│       ├── middleware/
│       │   └── operationLogger.ts                        # [新增] afterware middleware
│       ├── utils/
│       │   └── operationLogModule.ts                     # [移除] 被 operationLogger 取代
│       └── module/
│           ├── admin/
│           │   ├── controller.ts                         # [修改] 改用 res.locals.operationLog
│           │   └── service.ts                            # [修改] 移除 writeOperationLog 呼叫
│           └── operationLog/
│               ├── controller.ts                         # [新增] list
│               ├── service.ts                            # [新增] 查詢邏輯
│               └── route.ts                              # [新增] GET /api/operation-logs
├── client/
│   └── src/
│       ├── api/
│       │   └── operationLog.ts                           # [新增] API 封裝
│       └── pages/
│           └── OperationLogPage.tsx                      # [新增] 操作紀錄頁面
└── shared/
    ├── schemas/
    │   └── operationLog.ts                               # [新增] query params schema
    └── types/
        └── operationLog.ts                               # [新增] 型別定義
```

---

## 5. 詳細設計

### 5.1 DB Schema — Migration

**Migration**（`server/db/migrations/20260317000001_create_operation_logs.ts`）：

替換現有 migration，新 schema：

```ts
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('operation_logs', (table) => {
    table.increments('id').primary();
    table.string('operation_type', 50).notNullable();
    table.integer('operator_id').notNullable();
    table.string('operator', 50).notNullable();
    table.text('request').notNullable(); // JSON string
    table.timestamp('created_at').defaultTo(knex.fn.now());

    // 索引
    table.index('operation_type');
    table.index('operator_id');
    table.index('created_at');
  });
}
```

### 5.2 operationLogger afterware middleware

**檔案**：`server/src/middleware/operationLogger.ts`

```ts
import { Request, Response, NextFunction } from 'express';
import { getDb } from '../app'; // 或透過 DI 取得 db instance

// 敏感欄位過濾
const SENSITIVE_FIELDS = ['password', 'newPassword', 'oldPassword', 'password_hash'];

function sanitizePayload(body: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...body };
  for (const field of SENSITIVE_FIELDS) {
    if (field in sanitized) {
      sanitized[field] = '***';
    }
  }
  return sanitized;
}

export function operationLogger(req: Request, res: Response, next: NextFunction): void {
  res.on('finish', async () => {
    const logData = res.locals.operationLog;

    // 僅在有設定 operationLog 且回應成功時寫入
    if (!logData || res.statusCode < 200 || res.statusCode >= 300) {
      return;
    }

    try {
      const db = getDb();
      await db('operation_logs').insert({
        operation_type: logData.operationType,
        // operator 來源優先順序：res.locals.operationLog > req.user
        // LOGIN 路由不經 auth middleware，需由 controller 手動帶入
        operator_id: logData.operatorId ?? req.user?.id,
        operator: logData.operator ?? req.user?.username,
        request: JSON.stringify({
          url: req.originalUrl,
          method: req.method,
          payload: sanitizePayload(req.body || {}),
        }),
      });
    } catch (error) {
      // 靜默處理，不影響已送出的回應
      console.error('[operationLogger] 寫入失敗:', error);
    }
  });

  next();
}
```

**掛載位置**（`server/src/app.ts`）：

```ts
// 在路由掛載之前
app.use(operationLogger);
```

### 5.3 API 設計 — GET `/api/operation-logs`

- **需認證**：`auth` middleware
- **需權限**：`operation_log:read`
- **Query Parameters**：

| 參數          | 型別   | 必填 | 說明                              | 預設值 |
| ------------- | ------ | ---- | --------------------------------- | ------ |
| page          | number | 否   | 頁碼                              | 1      |
| pageSize      | number | 否   | 每頁筆數                          | 20     |
| operationType | string | 否   | 篩選操作類型（如 `CREATE_ADMIN`） | —      |
| operator      | string | 否   | 篩選操作者帳號（模糊搜尋）        | —      |
| startDate     | string | 否   | 起始日期（UTC，ISO 8601 格式）    | —      |
| endDate       | string | 否   | 結束日期（UTC，ISO 8601 格式）    | —      |

- **Response 200**：

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "operation_type": "CREATE_ADMIN",
      "operator_id": 1,
      "operator": "admin01",
      "request": {
        "url": "/api/admins",
        "method": "POST",
        "payload": { "username": "admin04", "role": "general_manager" }
      },
      "created_at": "2026-01-15 08:30:00"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

> 注意：`request` 欄位在 DB 中為 JSON 字串，API 回傳時 parse 為物件。

- **Error 400**：`VALIDATION_ERROR`（page / pageSize 非正整數）
- **Error 401**：`AUTH_MISSING_TOKEN`
- **Error 403**：`FORBIDDEN_INSUFFICIENT_PERMISSIONS`

**操作類型枚舉**（用於篩選下拉選單）：

| operation_type      | 說明            | 對應模組  |
| ------------------- | --------------- | --------- |
| `CREATE_ADMIN`      | 新增管理員帳號  | admin     |
| `TOGGLE_ADMIN`      | 啟用/禁用管理員 | admin     |
| `RESET_PASSWORD`    | 重設管理員密碼  | admin     |
| `DELETE_MESSAGE`    | 刪除聊天訊息    | chat      |
| `BLOCK_PLAYER`      | 封鎖玩家        | blacklist |
| `UNBLOCK_PLAYER`    | 解封玩家        | blacklist |
| `BLOCK_IP`          | 封鎖 IP         | ip_block  |
| `UNBLOCK_IP`        | 解封 IP         | ip_block  |
| `CREATE_BROADCAST`  | 發送廣播訊息    | broadcast |
| `APPROVE_REPORT`    | 核准玩家檢舉    | report    |
| `REJECT_REPORT`     | 駁回玩家檢舉    | report    |
| `APPROVE_NICKNAME`  | 核准暱稱變更    | nickname  |
| `REJECT_NICKNAME`   | 駁回暱稱變更    | nickname  |
| `CHANGE_PASSWORD`   | 修改自己密碼    | auth      |
| `LOGIN`             | 管理員登入      | auth      |
| `LOGOUT`            | 管理員登出      | auth      |
| `UPDATE_ADMIN_ROLE` | 更新管理員角色  | admin     |
| `RESET_NICKNAME`    | 重設玩家暱稱    | player    |
| `DELETE_BROADCAST`  | 下架廣播訊息    | broadcast |

> 此枚舉定義在 `shared/types/operationLog.ts`，前後端共用。目前僅 `CREATE_ADMIN` 與 `CHANGE_PASSWORD` 有實際寫入，其餘在各模組開發時逐步啟用。
>
> **注意**：`LOGIN` 路由不經過 `auth` middleware，`req.user` 不存在。`operationLogger` 需支援從 `res.locals.operationLog` 讀取 `operatorId` 和 `operator` 作為覆寫來源。`LOGOUT` 路由經過 `auth` middleware，無此問題。

### 5.4 後端 Module — operationLog

**service.ts**（`server/src/module/operationLog/service.ts`）：

```ts
class OperationLogService {
  async list(query: {
    page: number;
    pageSize: number;
    operationType?: string;
    operator?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{ data: IOperationLog[]; pagination: TPagination }> {
    let qb = this.db('operation_logs');

    if (query.operationType) {
      qb = qb.where('operation_type', query.operationType);
    }
    if (query.operator) {
      qb = qb.where('operator', 'like', `%${query.operator}%`);
    }
    if (query.startDate) {
      qb = qb.where('created_at', '>=', query.startDate);
    }
    if (query.endDate) {
      qb = qb.where('created_at', '<=', query.endDate);
    }

    // 計算 total
    const [{ count }] = await qb.clone().count('* as count');

    // 查詢分頁資料（最新的在前）
    const data = await qb
      .orderBy('created_at', 'desc')
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);

    // parse request JSON
    const parsed = data.map((row) => ({
      ...row,
      request: JSON.parse(row.request),
    }));

    return {
      data: parsed,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total: Number(count),
        totalPages: Math.ceil(Number(count) / query.pageSize),
      },
    };
  }
}
```

**controller.ts**（`server/src/module/operationLog/controller.ts`）：

```ts
class OperationLogController {
  async list(req: Request, res: Response): Promise<void> {
    const result = await operationLogService.list({
      page: Number(req.query.page) || 1,
      pageSize: Number(req.query.pageSize) || 20,
      operationType: req.query.operationType as string,
      operator: req.query.operator as string,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
    });

    ResponseHelper.paginated(res, result.data, result.pagination);
  }
}
```

**route.ts**（`server/src/module/operationLog/route.ts`）：

```ts
const router = Router();

router.get('/', auth, requirePermission('operation_log:read'), ctrl.list);

export default router;
```

**掛載**（`server/src/app.ts`）：

```ts
app.use('/api/operation-logs', operationLogRoutes);
```

### 5.5 Seed 資料

**檔案**：`server/db/seeds/02_operation_logs.ts`

產生 20 筆 mock data，涵蓋以下操作類型：

- `CREATE_ADMIN` × 3
- `DELETE_MESSAGE` × 3
- `BLOCK_PLAYER` × 3
- `UNBLOCK_PLAYER` × 2
- `BLOCK_IP` × 2
- `UNBLOCK_IP` × 1
- `CREATE_BROADCAST` × 2
- `APPROVE_REPORT` × 1
- `REJECT_REPORT` × 1
- `APPROVE_NICKNAME` × 1
- `REJECT_NICKNAME` × 1

操作者分佈在 admin01 和 admin02，時間分佈在近 30 天內。

### 5.6 前端 OperationLogPage

**檔案**：`client/src/pages/OperationLogPage.tsx`

**頁面結構：**

```
OperationLogPage
├── 篩選區域（Card）
│   ├── Select — 操作類型（OPERATION_TYPE 枚舉下拉）
│   ├── Input — 操作者（模糊搜尋）
│   ├── DatePicker.RangePicker — 時間範圍
│   └── Button — 查詢 / 重置
└── 資料表格（Table）
    ├── Column: 操作類型（operation_type）
    ├── Column: 操作者（operator）
    ├── Column: 請求資訊（request — 展開顯示 url/method/payload）
    ├── Column: 操作時間（created_at — UTC+8 格式化）
    └── Pagination（對應 API 分頁）
```

**樣式**：使用 `createStyles` 管理，顏色/間距使用 Antd design token。

**API 封裝**（`client/src/api/operationLog.ts`）：

```ts
export const operationLogApi = {
  list: (params: TOperationLogQuery) =>
    client.get<TApiResponse<TOperationLogItem[]>>('/api/operation-logs', { params }),
};
```

**時區轉換**：所有 `created_at` 顯示時使用 `dayjs.utc().tz('Asia/Taipei')` 轉換為 UTC+8。

### 5.7 Phase 1 相容性處理

需修改以下 Phase 1 檔案：

1. **`server/src/module/admin/controller.ts`** — 新增 `res.locals.operationLog = { operationType: 'CREATE_ADMIN' }`
2. **`server/src/module/admin/service.ts`** — 移除 `writeOperationLog()` 呼叫
3. **`server/src/module/auth/controller.ts`** — changePassword 新增 `res.locals.operationLog = { operationType: 'CHANGE_PASSWORD' }`
4. **`server/src/utils/operationLogModule.ts`** — 移除（被 `operationLogger` middleware 取代）
5. **`server/src/app.ts`** — 掛載 `operationLogger` middleware + `operationLog` routes
6. **`server/src/__tests__/integration/admin.create.test.ts`** — 更新 operation_logs 驗證（欄位名稱變更）
7. **`server/src/__tests__/helpers/testDb.ts`** — 更新測試 schema 為新結構

---

## 6. 測試計畫

測試策略沿用 [rfc_00 §6](rfc_00-project_tech_stack.md)。

### 6.1 測試檔案

| 層級        | 測試檔案                       | 測試目標                                    |
| ----------- | ------------------------------ | ------------------------------------------- |
| Unit        | `operationLogger.test.ts`      | afterware middleware 寫入邏輯、敏感欄位過濾 |
| Integration | `operationLog.list.test.ts`    | GET /api/operation-logs 完整 pipeline       |
| Integration | `admin.create.test.ts`（更新） | 驗證 afterware 模式下 operation_logs 寫入   |
| Component   | `OperationLogPage.test.tsx`    | 頁面渲染、篩選互動、分頁、時區顯示          |

### 6.2 Gherkin Scenario 映射

| Gherkin Tag    | 對應測試檔案                                             |
| -------------- | -------------------------------------------------------- |
| `@happy_path`  | `operationLog.list.test.ts`、`OperationLogPage.test.tsx` |
| `@permissions` | `operationLog.list.test.ts`                              |
| `@validation`  | `operationLog.list.test.ts`                              |
| `@integration` | `admin.create.test.ts`                                   |

---

## 7. 風險與緩解

| 風險                                     | 影響                     | 緩解方式                                                       |
| ---------------------------------------- | ------------------------ | -------------------------------------------------------------- |
| afterware 在 res.on('finish') 後寫入失敗 | 操作紀錄遺漏             | 靜默 log error，不影響 API 回應；可加入 retry 或 queue 機制    |
| request JSON 包含敏感資料                | 密碼等資訊洩漏           | `sanitizePayload()` 過濾敏感欄位；定義 SENSITIVE_FIELDS 清單   |
| Phase 1 migration 替換                   | 需重新建立 DB            | 開發環境可 `npm run db:migrate:rollback` 後重新 migrate + seed |
| SQLite JSON 查詢效能                     | request 欄位無法高效搜尋 | 不在 request JSON 內搜尋；篩選僅用 indexed 欄位                |

---

## 8. 完成標準

- [ ] `operation_logs` 表使用新 schema（operation_type + operator_id + operator + request JSON）
- [ ] `operationLogger` afterware middleware 正常運作
- [ ] 新增管理員帳號後，operation_logs 自動寫入（afterware 模式）
- [ ] 修改密碼後，operation_logs 自動寫入
- [ ] 登入後，operation_logs 自動寫入（LOGIN），operator 正確，password 為 `***`
- [ ] 登出後，operation_logs 自動寫入（LOGOUT）
- [ ] 登入失敗（401）不產生紀錄
- [ ] `GET /api/operation-logs` 回傳分頁資料
- [ ] 篩選條件正常運作（operationType / operator / startDate / endDate）
- [ ] request JSON 中密碼欄位已過濾為 `***`
- [ ] 前端 OperationLogPage 正確顯示操作紀錄
- [ ] 前端時間顯示為 UTC+8 格式
- [ ] Seed data 20 筆正常載入
- [ ] Vitest 測試全部通過
