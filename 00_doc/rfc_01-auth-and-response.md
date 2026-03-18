# RFC: Auth + Response/Error 基礎設施

## 1. 背景

Phase 0 已完成專案骨架（見 [rfc_00](rfc_00-project_tech_stack.md)），目前後端僅有 health check 端點與基礎 error handler。在開發各功能模組之前，需先建立三項基礎設施：

1. **統一回應與錯誤處理** — 目前 `app.ts` 的 error handler 僅回傳 `{ error, message }`，缺乏結構化 response envelope 與 error code 機制
2. **Payload 驗證** — 目前無輸入驗證機制，需建立前後端共用的驗證架構
3. **認證與授權** — JWT 登入驗證 + Config-Based RBAC 權限控制

**範圍界定**：本 RFC 涵蓋 Response/Error 架構、Zod 驗證共用層、Auth/RBAC 技術設計。

---

## 2. 目標

- 建立統一的 API Response Envelope 格式（成功/失敗）
- 建立結構化 Error 處理機制（AppError + error code config）
- 建立 `shared/` 共用層，前後端共用 Zod schema 驗證
- 實作 JWT 登入驗證與 Config-Based RBAC 權限控制
- 建立測試基礎設施（Vitest + supertest + testing-library）

---

## 3. 提案

### 3.1 Response 格式設計（Envelope 模式）

所有 API 回應採用統一 envelope 結構：

**成功回應：**

```json
{
  "success": true,
  "data": { ... }
}
```

**失敗回應：**

```json
{
  "success": false,
  "error": {
    "code": "AUTH_INVALID_CREDENTIALS",
    "message": "帳號或密碼錯誤"
  }
}
```

**分頁回應：**

```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

### 3.2 Error 處理架構

三層設計：

| 層級   | 元件                                       | 職責                                                  |
| ------ | ------------------------------------------ | ----------------------------------------------------- |
| 定義層 | `ErrorCode` enum + `ERROR_MESSAGES` config | 集中管理 error code 與對應 message                    |
| 拋出層 | `AppError` class                           | 擴展 `Error`，附帶 `code`、`statusCode`、`message`    |
| 捕獲層 | Global error handler（改造 `app.ts`）      | 捕獲 `AppError` 回傳結構化 envelope；未知錯誤回傳 500 |

### 3.3 shared/ 共用層 + Zod 驗證架構

建立 `shared/` 目錄作為前後端共用的 Zod schema 與 TypeScript 型別定義層。

**跨專案引用方式：** TypeScript path alias (`@shared/*`)

**需修改的配置檔：**

| 檔案                          | 變更                                                                      |
| ----------------------------- | ------------------------------------------------------------------------- |
| `tsconfig.json`（根層，新建） | 定義 `@shared/*` path alias 基準                                          |
| `client/tsconfig.app.json`    | 新增 `paths: { "@shared/*": ["../shared/*"] }`                            |
| `server/tsconfig.json`        | 新增 `paths: { "@shared/*": ["../shared/*"] }`                            |
| `client/vite.config.ts`       | 新增 `resolve.alias: { '@shared': path.resolve(__dirname, '../shared') }` |

**Module system 處理：**

- client 用 ESM（Vite bundler）、server 用 CommonJS（tsc）
- `shared/` 僅存放 TypeScript source，不需獨立 build pipeline
- 各自由自己的 build tool（Vite / tsc）編譯 shared/ 中的 `.ts` 檔案

**驗證架構：**

- 後端：`validate(schema)` middleware — 用 Zod schema 驗證 `req.body`，失敗回傳統一 error envelope
- 前端：`zodToAntdRules(schema)` 工具 — 將 Zod schema 轉換為 Antd Form 的 `rules` 格式

### 3.4 Config-Based RBAC

採用 Config-Based RBAC（Approach A），權限定義在 JS config 中：

- `admins` 表的 `role` 欄位：`general_manager` / `senior_manager`
- 權限命名慣例：`resource:action`（如 `chat:read`、`broadcast:create`）
- `requirePermission()` middleware 取代 `requireRole()`
- 無需新增 DB 表，未來可平滑升級至 Full RBAC（DB-backed）

---

## 4. 高層設計

### 4.1 新增檔案與目錄結構

```
chat-management/
├── tsconfig.json                       # [新增] 根層 — @shared/* path alias
├── shared/                             # [新增] 前後端共用層
│   ├── schemas/
│   │   ├── auth.ts                     # loginSchema, changePasswordSchema, createAdminSchema
│   │   └── admin.ts                    # adminListQuerySchema, updateAdminRoleSchema
│   ├── types/
│   │   ├── api.ts                      # TApiResponse, TApiError
│   │   ├── auth.ts                     # TLoginPayload, TLoginResponse, TCreateAdminPayload
│   │   └── admin.ts                    # TAdminItem, TAdminListQuery, TUpdateAdminRolePayload
│   └── index.ts
├── client/
│   ├── tsconfig.app.json               # [修改] 新增 @shared/* paths
│   ├── vite.config.ts                  # [修改] 新增 resolve.alias
│   └── src/
│       ├── api/
│       │   ├── client.ts               # [新增] Axios 實例 + interceptor
│       │   └── auth.ts                 # [新增] login, changePassword, getPermissions
│       ├── utils/
│       │   └── zodToAntdRules.ts       # [新增] Zod → Antd Form rules 轉換
│       ├── context/
│       │   └── AuthContext.tsx          # [新增] token + permissions 狀態管理
│       ├── components/
│       │   └── ProtectedRoute.tsx       # [新增] 權限守衛
│       ├── pages/
│       │   ├── LoginPage.tsx            # [新增] 登入頁面（已登入自動跳轉主頁）
│       │   └── NotFoundPage.tsx         # [新增] 404 頁面（在 AdminLayout 內顯示）
│       └── layouts/
│           └── AdminLayout.tsx          # [修改] Sidebar 權限控制
└── server/
    ├── tsconfig.json                    # [修改] 新增 @shared/* paths
    └── src/
        ├── app.ts                       # [修改] 掛載 auth routes、改造 error handler
        ├── utils/
        │   ├── appError.ts              # [新增] AppError class
        │   ├── errorCodes.ts            # [新增] error code enum + message config
        │   └── responseHelper.ts        # [新增] success/error envelope helper
        ├── middleware/
        │   ├── auth.ts                  # [新增] JWT 驗證
        │   ├── permission.ts            # [新增] requirePermission()
        │   └── validate.ts              # [新增] Zod validation middleware
        ├── config/
        │   └── permissions.ts           # [新增] RBAC 權限設定
        └── module/
            ├── auth/
            │   ├── controller.ts        # [新增] login, changePassword
            │   ├── service.ts           # [新增] 認證邏輯
            │   └── route.ts             # [新增] /api/auth/* routes
            └── admin/
                ├── controller.ts        # [新增] createAdmin
                ├── service.ts           # [新增] 管理員建立邏輯
                └── route.ts             # [新增] /api/admins/* routes
```

---

## 5. 詳細設計

### 5.1 Response 格式規格

**ResponseHelper**（`server/src/utils/responseHelper.ts`）：

```ts
class ResponseHelper {
  static success<T>(res: Response, data: T, statusCode = 200): void;
  static paginated<T>(res: Response, data: T[], pagination: TPagination): void;
  static error(res: Response, error: AppError): void;
}
```

所有 controller 統一使用 `ResponseHelper` 回傳：

```ts
// 成功
ResponseHelper.success(res, { token, user });

// 失敗（由 AppError 觸發，global handler 捕獲）
throw new AppError(ErrorCode.AUTH_INVALID_CREDENTIALS);
```

### 5.2 Error Code 定義與 Message Config

**ErrorCode enum**（`server/src/utils/errorCodes.ts`）：

```ts
export enum ErrorCode {
  // 通用
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',

  // 認證
  AUTH_MISSING_TOKEN = 'AUTH_MISSING_TOKEN',
  AUTH_INVALID_TOKEN = 'AUTH_INVALID_TOKEN',
  AUTH_TOKEN_EXPIRED = 'AUTH_TOKEN_EXPIRED',
  AUTH_INVALID_CREDENTIALS = 'AUTH_INVALID_CREDENTIALS',
  AUTH_ACCOUNT_DISABLED = 'AUTH_ACCOUNT_DISABLED',
  AUTH_OLD_PASSWORD_INCORRECT = 'AUTH_OLD_PASSWORD_INCORRECT',

  // 授權
  FORBIDDEN_INSUFFICIENT_PERMISSIONS = 'FORBIDDEN_INSUFFICIENT_PERMISSIONS',

  // 管理員管理
  ADMIN_USERNAME_DUPLICATE = 'ADMIN_USERNAME_DUPLICATE',
  ADMIN_NOT_FOUND = 'ADMIN_NOT_FOUND',
  ADMIN_CANNOT_SELF_MODIFY = 'ADMIN_CANNOT_SELF_MODIFY',
}
```

**ERROR_MESSAGES config**：

```ts
export const ERROR_MESSAGES: Record<ErrorCode, { statusCode: number; message: string }> = {
  [ErrorCode.VALIDATION_ERROR]: { statusCode: 400, message: '輸入資料驗證失敗' },
  [ErrorCode.INTERNAL_SERVER_ERROR]: { statusCode: 500, message: '伺服器內部錯誤' },
  [ErrorCode.AUTH_MISSING_TOKEN]: { statusCode: 401, message: '未提供認證 Token' },
  [ErrorCode.AUTH_INVALID_TOKEN]: { statusCode: 401, message: '無效的認證 Token' },
  [ErrorCode.AUTH_TOKEN_EXPIRED]: { statusCode: 401, message: '認證 Token 已過期' },
  [ErrorCode.AUTH_INVALID_CREDENTIALS]: { statusCode: 401, message: '帳號或密碼錯誤' },
  [ErrorCode.AUTH_ACCOUNT_DISABLED]: { statusCode: 403, message: '帳號已被停用' },
  [ErrorCode.AUTH_OLD_PASSWORD_INCORRECT]: { statusCode: 400, message: '舊密碼不正確' },
  [ErrorCode.FORBIDDEN_INSUFFICIENT_PERMISSIONS]: { statusCode: 403, message: '權限不足' },
  [ErrorCode.ADMIN_USERNAME_DUPLICATE]: { statusCode: 409, message: '帳號已存在' },
  [ErrorCode.ADMIN_NOT_FOUND]: { statusCode: 404, message: '管理員帳號不存在' },
  [ErrorCode.ADMIN_CANNOT_SELF_MODIFY]: { statusCode: 403, message: '無法對自己的帳號執行此操作' },
};
```

**AppError class**（`server/src/utils/appError.ts`）：

```ts
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;

  constructor(code: ErrorCode, customMessage?: string) {
    const config = ERROR_MESSAGES[code];
    super(customMessage || config.message);
    this.code = code;
    this.statusCode = config.statusCode;
  }
}
```

**Global Error Handler 改造**（`server/src/app.ts`）：

```ts
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof AppError) {
    return ResponseHelper.error(res, err);
  }
  // 未知錯誤
  const unknownError = new AppError(ErrorCode.INTERNAL_SERVER_ERROR);
  return ResponseHelper.error(res, unknownError);
});
```

### 5.3 shared/ 目錄結構 + Zod Schema 設計

**Auth Zod Schemas**（`shared/schemas/auth.ts`）：

```ts
import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().min(1, '請輸入帳號'),
  password: z.string().min(1, '請輸入密碼'),
});

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, '請輸入舊密碼'),
  newPassword: z.string().min(6, '新密碼至少 6 個字元'),
});

export const createAdminSchema = z.object({
  username: z.string().min(3, '帳號至少 3 個字元').max(50, '帳號最多 50 個字元'),
  password: z.string().min(6, '密碼至少 6 個字元'),
  role: z.enum(['general_manager', 'senior_manager']),
});
```

**共用型別**（`shared/types/auth.ts`）：

```ts
import type { z } from 'zod';
import type { loginSchema, changePasswordSchema, createAdminSchema } from '../schemas/auth';

export type TLoginPayload = z.infer<typeof loginSchema>;
export type TChangePasswordPayload = z.infer<typeof changePasswordSchema>;
export type TCreateAdminPayload = z.infer<typeof createAdminSchema>;

export type TLoginResponse = {
  token: string;
  user: {
    id: number;
    username: string;
    role: string;
  };
};

export type TMeResponse = {
  user: {
    id: number;
    username: string;
    role: string;
  };
  permissions: string[];
};

export type TPermissionsResponse = {
  role: string;
  permissions: string[];
};

export type TCreateAdminResponse = {
  id: number;
  username: string;
  role: string;
  is_active: boolean;
  created_at: string;
};
```

### 5.4 Validation Middleware + Zod → Antd Rules 工具

**後端 Validation Middleware**（`server/src/middleware/validate.ts`）：

```ts
import { ZodSchema } from 'zod';

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = result.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      throw new AppError(ErrorCode.VALIDATION_ERROR, details[0]?.message);
    }
    req.body = result.data; // 使用 parsed data（已 strip unknown fields）
    next();
  };
}
```

**使用方式：**

```ts
import { loginSchema } from '@shared/schemas/auth';

router.post('/login', validate(loginSchema), ctrl.login);
```

**前端 Zod → Antd Form Rules**（`client/src/utils/zodToAntdRules.ts`）：

```ts
import type { ZodObject, ZodRawShape } from 'zod';
import type { Rule } from 'antd/es/form';

export function zodToAntdRules<T extends ZodRawShape>(
  schema: ZodObject<T>,
): Record<keyof T, Rule[]>;
```

此工具將 Zod schema 的各欄位驗證規則轉換為 Antd Form 的 `rules` 格式，供 `Form.Item` 使用。

### 5.5 權限矩陣（22 權限 × 2 角色）

| Category      | Permission Code            | 說明            | General Mgr | Senior Mgr |
| ------------- | -------------------------- | --------------- | :---------: | :--------: |
| auth          | `auth:change_own_password` | 修改自己密碼    |      v      |     v      |
| chat          | `chat:read`                | 查看聊天訊息    |      v      |     v      |
| chat          | `chat:delete`              | 刪除聊天訊息    |      v      |     v      |
| blacklist     | `blacklist:read`           | 查看黑名單      |      v      |     v      |
| blacklist     | `blacklist:create`         | 封鎖玩家        |      v      |     v      |
| blacklist     | `blacklist:delete`         | 解封玩家        |      v      |     v      |
| ip_block      | `ip_block:read`            | 查看 IP 封鎖    |      v      |     v      |
| ip_block      | `ip_block:create`          | 建立 IP 封鎖    |      v      |     v      |
| ip_block      | `ip_block:delete`          | 移除 IP 封鎖    |      v      |     v      |
| chatroom      | `chatroom:read`            | 查看聊天室列表  |      v      |     v      |
| operation_log | `operation_log:read`       | 查看操作紀錄    |      v      |     v      |
| report        | `report:read`              | 查看玩家檢舉    |      v      |     v      |
| report        | `report:review`            | 審核檢舉        |      v      |     v      |
| nickname      | `nickname:read`            | 查看暱稱申請    |      v      |     v      |
| nickname      | `nickname:review`          | 審核暱稱        |      v      |     v      |
| player        | `player:reset_nickname`    | 重設玩家暱稱    |      v      |     v      |
| admin         | `admin:read`               | 查看管理員列表  |             |     v      |
| admin         | `admin:create`             | 建立管理員帳號  |             |     v      |
| admin         | `admin:toggle`             | 啟用/禁用管理員 |             |     v      |
| admin         | `admin:reset_password`     | 重設管理員密碼  |             |     v      |
| broadcast     | `broadcast:read`           | 查看廣播紀錄    |             |     v      |
| broadcast     | `broadcast:create`         | 發送廣播訊息    |             |     v      |
| broadcast     | `broadcast:delete`         | 下架廣播訊息    |             |     v      |

**權限設定檔**（`server/src/config/permissions.ts`）：

```ts
export const ROLE_PERMISSIONS = {
  general_manager: [
    'auth:change_own_password',
    'chat:read',
    'chat:delete',
    'blacklist:read',
    'blacklist:create',
    'blacklist:delete',
    'ip_block:read',
    'ip_block:create',
    'ip_block:delete',
    'chatroom:read',
    'operation_log:read',
    'report:read',
    'report:review',
    'nickname:read',
    'nickname:review',
    'player:reset_nickname',
  ],
  senior_manager: [] as string[], // 下方以 superset 定義
};

// senior_manager 繼承 general_manager 所有權限 + 額外權限
ROLE_PERMISSIONS.senior_manager = [
  ...ROLE_PERMISSIONS.general_manager,
  'admin:read',
  'admin:create',
  'admin:toggle',
  'admin:reset_password',
  'broadcast:read',
  'broadcast:create',
  'broadcast:delete',
];

export function getPermissionsForRole(role: string): string[] {
  return ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS] || [];
}
```

### 5.6 Auth Middleware

**JWT 驗證**（`server/src/middleware/auth.ts`）：

- **Token 來源（優先順序）**：
  1. 先讀取 `req.cookies.token`（HttpOnly Cookie，前端自動帶）
  2. 若無 cookie，fallback 到 `Authorization: Bearer <token>` header（供 Postman 等工具使用）
- 驗證 token 簽章與過期時間
- 成功 → 附加 `req.user = { id, username, role }` 到 request
- 失敗 → 拋出 `AppError`（`AUTH_MISSING_TOKEN` / `AUTH_INVALID_TOKEN` / `AUTH_TOKEN_EXPIRED`）

**依賴：** 需安裝 `cookie-parser` middleware，在 `app.ts` 中掛載。

**JWT Payload 格式：**

```ts
{
  id: number;
  username: string;
  role: string;
}
```

- 過期時間：4 小時
- Secret：從 `process.env.JWT_SECRET` 讀取

### 5.7 Permission Middleware

**requirePermission()**（`server/src/middleware/permission.ts`）：

```ts
export function requirePermission(...requiredPermissions: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userPerms = getPermissionsForRole(req.user.role);
    const hasAll = requiredPermissions.every((p) => userPerms.includes(p));
    if (!hasAll) {
      throw new AppError(ErrorCode.FORBIDDEN_INSUFFICIENT_PERMISSIONS);
    }
    next();
  };
}
```

**使用方式：**

```ts
// 單一權限
router.get('/api/chat_messages', auth, requirePermission('chat:read'), ctrl.list);

// 多個權限（OR 邏輯）
router.put(
  '/api/admins/:id/password',
  auth,
  requirePermission('admin:reset_password'),
  ctrl.resetPassword,
);
```

### 5.8 DB Schema — admins 表

**Migration**（`server/db/migrations/YYYYMMDDHHMMSS_create_admins.ts`）：

| 欄位          | 型別                               | 說明                                     |
| ------------- | ---------------------------------- | ---------------------------------------- |
| id            | INTEGER PRIMARY KEY AUTOINCREMENT  |                                          |
| username      | VARCHAR(50) UNIQUE NOT NULL        | 登入帳號                                 |
| password_hash | VARCHAR(255) NOT NULL              | bcrypt 雜湊                              |
| role          | VARCHAR(20) NOT NULL               | `general_manager` / `senior_manager`     |
| is_active     | BOOLEAN DEFAULT true               | 帳號啟用狀態                             |
| created_by    | INTEGER                            | 建立者 ID（nullable，初始 seed 為 null） |
| created_at    | DATETIME DEFAULT CURRENT_TIMESTAMP |                                          |
| updated_at    | DATETIME DEFAULT CURRENT_TIMESTAMP |                                          |

**Seed 資料**（`server/db/seeds/01_admins.ts`）：

| username | password（明文） | password_hash | role            | is_active |
| -------- | ---------------- | ------------- | --------------- | --------- |
| admin01  | 123456           | bcrypt hash   | senior_manager  | true      |
| admin02  | 123456           | bcrypt hash   | general_manager | true      |
| admin03  | 123456           | bcrypt hash   | general_manager | false     |

> `admin03` 設為停用狀態，用於測試帳號停用場景。

### 5.9 API 設計

#### POST `/api/auth/login`

- **不需認證**
- **Validation**：`loginSchema`（Zod）
- **Request Body**：`{ username: string, password: string }`
- **Response 200**：`{ success: true, data: { token, user: { id, username, role } } }`
  - **Set-Cookie**：`token=<jwt>; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=14400`
  - Response body 仍包含 `token`，供 Postman 等工具使用 Bearer 認證
  - 前端不使用 body 中的 token，而是依賴瀏覽器自動帶 cookie
- **Error 400**：`VALIDATION_ERROR`（缺少欄位）
- **Error 401**：`AUTH_INVALID_CREDENTIALS`（帳密錯誤）
- **Error 403**：`AUTH_ACCOUNT_DISABLED`（帳號停用）

#### GET `/api/auth/me`

- **需認證**：`auth` middleware（Cookie 或 Bearer token）
- **Response 200**：`{ success: true, data: { user: { id, username, role }, permissions: string[] } }`
- 用途：前端頁面載入時呼叫，恢復登入狀態（取代 localStorage 讀取）

#### POST `/api/auth/logout`

- **需認證**：`auth` middleware
- **Response 200**：`{ success: true, data: { message: '登出成功' } }`
  - **Set-Cookie**：`token=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`（清除 cookie）

#### PUT `/api/auth/password`

- **需認證**：`auth` middleware
- **需權限**：`auth:change_own_password`
- **Validation**：`changePasswordSchema`（Zod）
- **Request Body**：`{ oldPassword: string, newPassword: string }`
- **Response 200**：`{ success: true, data: { message: '密碼更新成功' } }`
- **Error 400**：`AUTH_OLD_PASSWORD_INCORRECT`（舊密碼錯誤）
- **Error 400**：`VALIDATION_ERROR`（新密碼不符格式）

#### GET `/api/auth/permissions`

- **需認證**：`auth` middleware（不需額外權限）
- **Response 200**：`{ success: true, data: { role, permissions: string[] } }`
- **注意**：此端點保留，但前端改用 `/api/auth/me`（一次取得 user + permissions）

#### POST `/api/admins`

- **需認證**：`auth` middleware
- **需權限**：`admin:create`
- **Validation**：`createAdminSchema`（Zod）
- **Request Body**：`{ username: string, password: string, role: 'general_manager' | 'senior_manager' }`
- **Response 201**：`{ success: true, data: { id, username, role, is_active, created_at } }`
- **Error 400**：`VALIDATION_ERROR`（缺少欄位 / 帳號長度不足 / 密碼長度不足 / role 無效）
- **Error 409**：`ADMIN_USERNAME_DUPLICATE`（帳號已存在）
- **Error 403**：`FORBIDDEN_INSUFFICIENT_PERMISSIONS`（非 senior_manager）
- **操作紀錄**：寫入 operation_logs（action: `admin:create`，target: 新帳號 username）

> ⚠️ operation_logs 的 DB schema 與寫入機制已在 [rfc_02-operation-logs.md](rfc_02-operation-logs.md) 中重新設計（改用 `request` JSON 欄位 + `res.locals` afterware 模式），此處描述僅為 Phase 1 初始實作參考。

#### GET `/api/admins`

- **需認證**：`auth` middleware
- **需權限**：`admin:read`
- **Query Parameters**（使用 `adminListQuerySchema`）：
  - `page?`: number（預設 1）
  - `pageSize?`: number（預設 20，最大 100）
  - `username?`: string（模糊搜尋）
  - `role?`: `general_manager` | `senior_manager`
  - `isActive?`: boolean
- **Response 200**：`{ success: true, data: TAdminItem[], pagination: TPagination }`
  - TAdminItem: `{ id, username, role, is_active, created_by, created_at, updated_at }`
  - 不包含 `password_hash`
- **Error 403**：`FORBIDDEN_INSUFFICIENT_PERMISSIONS`（非 senior_manager）
- **操作紀錄**：不記錄（唯讀操作）

#### PUT `/api/admins/:id/toggle`

- **需認證**：`auth` middleware
- **需權限**：`admin:toggle`
- **Path Parameter**：`id` — 管理員 ID
- **Response 200**：`{ success: true, data: { id, username, role, is_active, updated_at } }`
- **Error 403**：`ADMIN_CANNOT_SELF_MODIFY`（嘗試操作自己）
- **Error 404**：`ADMIN_NOT_FOUND`（ID 不存在）
- **Error 403**：`FORBIDDEN_INSUFFICIENT_PERMISSIONS`（非 senior_manager）
- **操作紀錄**：寫入 operation_logs（type: `TOGGLE_ADMIN`）

#### PATCH `/api/admins/:id/role`

- **需認證**：`auth` middleware
- **需權限**：`admin:toggle`
- **Path Parameter**：`id` — 管理員 ID
- **Validation**：`updateAdminRoleSchema`（Zod）
- **Request Body**：`{ role: 'general_manager' | 'senior_manager' }`
- **Response 200**：`{ success: true, data: { id, username, role, is_active, updated_at } }`
- **Error 400**：`VALIDATION_ERROR`（role 值無效）
- **Error 403**：`ADMIN_CANNOT_SELF_MODIFY`（嘗試操作自己）
- **Error 404**：`ADMIN_NOT_FOUND`（ID 不存在）
- **Error 403**：`FORBIDDEN_INSUFFICIENT_PERMISSIONS`（非 senior_manager）
- **操作紀錄**：寫入 operation_logs（type: `UPDATE_ADMIN_ROLE`）

#### PUT `/api/admins/:id/password`

- **需認證**：`auth` middleware
- **需權限**：`admin:reset_password`（senior_manager 限定）
- **Path Parameter**：`id` — 管理員 ID
- **Validation**：`resetAdminPasswordSchema`（Zod）：`{ newPassword: string }` min 6 字元
- **Response 200**：`{ success: true, data: { message: '密碼已重設' } }`
- **Error 400**：`VALIDATION_ERROR`（newPassword 不符格式）
- **Error 403**：`ADMIN_CANNOT_SELF_MODIFY`（嘗試重設自己密碼）
- **Error 404**：`ADMIN_NOT_FOUND`（ID 不存在）
- **Error 403**：`FORBIDDEN_INSUFFICIENT_PERMISSIONS`（非 senior_manager）
- **操作紀錄**：寫入 operation_logs（type: `RESET_PASSWORD`）

#### Route 權限對照表（完整，含未來模組）

| Method | Path                                      | Permission                 | 備註      |
| ------ | ----------------------------------------- | -------------------------- | --------- |
| POST   | `/api/auth/login`                         | —                          | 不需驗證  |
| GET    | `/api/auth/me`                            | —                          | 僅需 auth |
| POST   | `/api/auth/logout`                        | —                          | 僅需 auth |
| PUT    | `/api/auth/password`                      | `auth:change_own_password` |           |
| GET    | `/api/auth/permissions`                   | —                          | 僅需 auth |
| GET    | `/api/chat_messages`                      | `chat:read`                | Phase 3   |
| DELETE | `/api/chat_messages/:id`                  | `chat:delete`              | Phase 3   |
| GET    | `/api/blacklist/player`                   | `blacklist:read`           | Phase 4   |
| POST   | `/api/blacklist/player`                   | `blacklist:create`         | Phase 4   |
| DELETE | `/api/blacklist/player/:id`               | `blacklist:delete`         | Phase 4   |
| GET    | `/api/blacklist/ip`                       | `ip_block:read`            | Phase 4   |
| POST   | `/api/blacklist/ip`                       | `ip_block:create`          | Phase 4   |
| DELETE | `/api/blacklist/ip/:id`                   | `ip_block:delete`          | Phase 4   |
| GET    | `/api/chatrooms`                          | `chatroom:read`            | Phase 2+  |
| GET    | `/api/broadcasts`                         | `broadcast:read`           | Phase 6   |
| POST   | `/api/broadcasts`                         | `broadcast:create`         | Phase 6   |
| DELETE | `/api/broadcasts/:id`                     | `broadcast:delete`         | Phase 6   |
| GET    | `/api/operation-logs`                     | `operation_log:read`       | Phase 2+  |
| GET    | `/api/reports`                            | `report:read`              | Phase 5   |
| POST   | `/api/reports/:id/approve`                | `report:review`            | Phase 5   |
| POST   | `/api/reports/:id/reject`                 | `report:review`            | Phase 5   |
| GET    | `/api/nickname_reviews`                   | `nickname:read`            | Phase 5   |
| POST   | `/api/nickname_reviews/:username/approve` | `nickname:review`          | Phase 5   |
| POST   | `/api/nickname_reviews/:username/reject`  | `nickname:review`          | Phase 5   |
| GET    | `/api/admins`                             | `admin:read`               | Phase 1D  |
| POST   | `/api/admins`                             | `admin:create`             |           |
| PUT    | `/api/admins/:id/toggle`                  | `admin:toggle`             | Phase 1D  |
| PATCH  | `/api/admins/:id/role`                    | `admin:toggle`             | Phase 1D  |
| PUT    | `/api/admins/:id/password`                | `admin:reset_password`     | Phase 9   |
| PUT    | `/api/players/:username/nickname/reset`   | `player:reset_nickname`    | Phase 9   |

### 5.10 前端 Auth

#### Axios 實例（`client/src/api/client.ts`）

- 設定 `baseURL`（透過 Vite proxy，不需設定）
- 設定 `withCredentials: true`（讓瀏覽器自動帶 HttpOnly cookie）
- **不需** request interceptor（cookie 自動帶，不再手動加 Authorization header）
- Response interceptor：401 時導向 /login（不再操作 localStorage）

#### API 封裝（`client/src/api/auth.ts`）

```ts
export const authApi = {
  login: (data: TLoginPayload) =>
    client.post<TApiResponse<TLoginResponse>>('/api/auth/login', data),
  getMe: () => client.get<TApiResponse<TMeResponse>>('/api/auth/me'),
  logout: () => client.post<TApiResponse<{ message: string }>>('/api/auth/logout'),
  changePassword: (data: TChangePasswordPayload) =>
    client.put<TApiResponse<{ message: string }>>('/api/auth/password', data),
};
```

#### AuthContext（`client/src/context/AuthContext.tsx`）

**狀態：**

- `user: { id, username, role } | null`
- `permissions: string[]`
- `isAuthenticated: boolean`
- `loading: boolean`（初始化時為 true，避免頁面閃爍）

**方法：**

- `login(username, password)` → 呼叫 login API（server 設定 cookie）→ 呼叫 getMe → 設定 user + permissions
- `logout()` → 呼叫 /api/auth/logout（server 清除 cookie）→ 清除狀態
- `hasPermission(code: string)` → `permissions.includes(code)`

**初始化：** 呼叫 `/api/auth/me`，若 cookie 有效則恢復 user + permissions；若 401 則保持未登入狀態。**不使用 localStorage**。

#### ProtectedRoute（`client/src/components/ProtectedRoute.tsx`）

```tsx
<ProtectedRoute permission="broadcast:create">
  <BroadcastPage />
</ProtectedRoute>
```

- `loading` 中 → 顯示 Spin（避免閃爍跳轉）
- 未登入 → 導向 `/login`
- 無權限 → 導向首頁

#### LoginPage（`client/src/pages/LoginPage.tsx`）

- Antd `Form` + `Input` + `Button`
- 使用 `zodToAntdRules(loginSchema)` 設定欄位驗證規則
- 送出 → 呼叫 `AuthContext.login()` → 成功導向首頁 / 失敗顯示 `message.error`
- **已登入時自動導向首頁 `/`**（避免重複登入）
- 使用 `createStyles` 管理樣式

#### NotFoundPage（`client/src/pages/NotFoundPage.tsx`）

- 使用 Antd `Result` 元件顯示 404 提示
- 在 AdminLayout 內渲染（Sidebar + Header 仍正常顯示）
- 使用 `createStyles` 管理樣式

#### Router（`client/src/router.tsx`）

- AdminLayout children 新增 catch-all `{ path: '*', element: <NotFoundPage /> }` 路由

#### Sidebar 權限控制（`client/src/layouts/AdminLayout.tsx`）

```tsx
const menuItems = [
  { key: '/chat', label: '聊天監控', icon: <MessageOutlined />, permission: 'chat:read' },
  { key: '/blacklist', label: '黑名單管理', icon: <StopOutlined />, permission: 'blacklist:read' },
  { key: '/chatrooms', label: '聊天室', icon: <TeamOutlined />, permission: 'chatroom:read' },
  { key: '/broadcasts', label: '系統廣播', icon: <SoundOutlined />, permission: 'broadcast:read' },
  {
    key: '/operation-logs',
    label: '操作紀錄',
    icon: <FileTextOutlined />,
    permission: 'operation_log:read',
  },
  { key: '/reports', label: '玩家檢舉', icon: <WarningOutlined />, permission: 'report:read' },
  {
    key: '/nickname-requests',
    label: '暱稱審核',
    icon: <UserOutlined />,
    permission: 'nickname:read',
  },
  { key: '/admins', label: '帳號管理', icon: <SettingOutlined />, permission: 'admin:read' },
].filter((item) => hasPermission(item.permission));
```

- `general_manager` 看到 6 個選單項目（不含廣播、帳號管理）
- `senior_manager` 看到全部 8 個選單項目

---

## 6. 測試計畫

專案層級的測試策略（tech stack、分層策略、Gherkin-first 流程、檔案結構慣例、coverage 目標）詳見 [rfc_00 §6](rfc_00-project_tech_stack.md)。

以下為本模組特定的測試範圍：

### 6.1 Auth 模組測試檔案

| 層級        | 測試檔案                        | 測試目標                               |
| ----------- | ------------------------------- | -------------------------------------- |
| Unit        | `permissions.test.ts`           | 權限 config 結構、角色繼承、防禦性查詢 |
| Unit        | `authMiddleware.test.ts`        | JWT 驗證邏輯（缺少/無效/過期 token）   |
| Unit        | `permissionMiddleware.test.ts`  | 權限檢查（AND 邏輯、未知 role）        |
| Integration | `auth.login.test.ts`            | 登入 API 完整 pipeline                 |
| Integration | `auth.password.test.ts`         | 改密碼 API 完整 pipeline               |
| Integration | `auth.permissions.test.ts`      | 權限查詢 API                           |
| Integration | `admin.create.test.ts`          | 新增管理員 API 完整 pipeline           |
| Integration | `permissionEnforcement.test.ts` | 跨角色權限驗證                         |
| Component   | `AuthContext.test.tsx`          | login/logout/hasPermission 狀態管理    |
| Component   | `ProtectedRoute.test.tsx`       | 導向邏輯                               |
| Component   | `LoginPage.test.tsx`            | 表單送出/驗證/錯誤提示                 |
| Component   | `AdminLayout.sidebar.test.tsx`  | 選單權限過濾                           |

### 6.2 Gherkin Scenario 映射

測試案例與 [authentication.feature](authentication.feature) 的 scenario tags 對應：

| Gherkin Tag       | 對應測試檔案                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------- |
| `@happy_path`     | `auth.login.test.ts`、`auth.password.test.ts`、`auth.permissions.test.ts`、`admin.create.test.ts` |
| `@validation`     | `auth.login.test.ts`、`auth.password.test.ts`、`admin.create.test.ts`                             |
| `@error_handling` | `auth.login.test.ts`、`auth.password.test.ts`、`admin.create.test.ts`                             |
| `@permissions`    | `permissionEnforcement.test.ts`、`admin.create.test.ts`、`AdminLayout.sidebar.test.tsx`           |
| `@security`       | `authMiddleware.test.ts`、`auth.password.test.ts`、`admin.create.test.ts`                         |

---

## 7. 風險與緩解

| 風險                                                | 影響                        | 緩解方式                                                                                   |
| --------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------ |
| shared/ path alias 在 tsc 編譯時不解析為實際路徑    | server build 後 import 失敗 | 使用 `tsconfig-paths` 或 `tsc-alias` 處理；Dev 環境用 ts-node 直接解析                     |
| Zod → Antd rules 轉換不完整                         | 部分 Zod 驗證規則無法映射   | 僅支援常用規則（required, min, max, email 等），複雜規則 fallback 到 Antd custom validator |
| HttpOnly Cookie 認證                                | CSRF 風險                   | `SameSite=Strict` 防護；內部管理後台無第三方頁面嵌入需求，風險極低                         |
| better-sqlite3 in-memory DB 與真實 file DB 行為差異 | 測試通過但 prod 失敗        | 差異極小（same engine），且 integration test 涵蓋關鍵路徑                                  |

---

## 8. 完成標準

- [ ] 所有 API 回傳統一 envelope 格式（`{ success, data }` / `{ success, error: { code, message } }`）
- [ ] AppError + error code config 運作正常
- [ ] `shared/` 目錄可從 client 和 server 正常 import
- [ ] `POST /api/auth/login` — 回傳 JWT + user info
- [ ] `PUT /api/auth/password` — 修改自己密碼
- [ ] `GET /api/auth/permissions` — 回傳當前使用者權限清單
- [ ] `POST /api/admins` — 新增管理員帳號（僅 senior_manager）
- [ ] 帳號停用 → login 回 403
- [ ] general_manager 存取 broadcast/admin 路由 → 403
- [ ] senior_manager 存取所有路由 → 200
- [ ] 前端 LoginPage 登入/錯誤提示
- [ ] 前端 AuthContext 管理 token + permissions
- [ ] 前端 Sidebar 依權限顯示選單
- [ ] 前端 ProtectedRoute 阻擋無權限頁面
- [ ] 前端不使用 localStorage 儲存任何認證資訊
- [ ] `/api/auth/me` 可恢復登入狀態
- [ ] 已登入進入 /login 自動跳轉主頁
- [ ] 不存在路由在 AdminLayout 內顯示 NotFoundPage
- [ ] Vitest 測試全部通過
