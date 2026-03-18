# Phase 1: Auth + Response/Error 基礎設施

## 背景

Phase 0 完成專案骨架後，需建立三項基礎設施才能開始開發功能模組：統一回應/錯誤處理、前後端共用驗證、JWT 認證與 RBAC 權限控制。所有技術設計詳見 [rfc_01-auth-and-response.md](rfc_01-auth-and-response.md)，驗收規格見 [authentication.feature](authentication.feature)。

## 前置條件

- Phase 0 完成（`npm run dev` 可一鍵啟動、`GET /api/health` 回傳 200）
- `admins` 表尚未建立（本 phase 建立）
- Node.js >= 18 LTS

---

## Task 1.1: Response/Error 基礎設施

建立統一的 API 回應格式（Envelope 模式）與結構化錯誤處理機制。

**建立檔案：**

1. `server/src/utils/errorCodes.ts`
   - `ErrorCode` enum：定義所有錯誤碼（`VALIDATION_ERROR`、`AUTH_*`、`FORBIDDEN_*` 等）
   - `ERROR_MESSAGES` config：每個 error code 對應 `{ statusCode, message }`
   - 參照 [rfc_01 §5.2](rfc_01-auth-and-response.md)

2. `server/src/utils/appError.ts`
   - `AppError` class 繼承 `Error`
   - 屬性：`code`（ErrorCode）、`statusCode`（HTTP status）
   - Constructor 從 `ERROR_MESSAGES` 查詢預設 message，支援 `customMessage` 覆蓋

3. `server/src/utils/responseHelper.ts`
   - `ResponseHelper.success(res, data, statusCode?)` — 回傳 `{ success: true, data }`
   - `ResponseHelper.paginated(res, data, pagination)` — 回傳含分頁資訊的成功回應
   - `ResponseHelper.error(res, appError)` — 回傳 `{ success: false, error: { code, message } }`

**修改檔案：**

4. `server/src/app.ts`
   - 改造 global error handler：捕獲 `AppError` 回傳結構化 envelope；未知錯誤包裝為 `INTERNAL_SERVER_ERROR`
   - 更新 health check 使用 `ResponseHelper.success()`

### 驗證方式

- `GET /api/health` 回傳 `{ success: true, data: { status: 'ok' } }`
- 存取不存在的路由回傳 `{ success: false, error: { code: '...', message: '...' } }`
- TypeScript 編譯無錯誤

---

## Task 1.2: shared/ 共用層設置

建立前後端共用的 Zod schema 與 TypeScript 型別定義層。

**建立檔案：**

1. `shared/schemas/auth.ts`
   - `loginSchema`：username（必填）、password（必填）
   - `changePasswordSchema`：oldPassword（必填）、newPassword（必填，min 6）
   - 參照 [rfc_01 §5.3](rfc_01-auth-and-response.md)

2. `shared/types/api.ts`
   - `TApiResponse<T>` — `{ success: true, data: T }`
   - `TApiError` — `{ success: false, error: { code: string, message: string } }`

3. `shared/types/auth.ts`
   - `TLoginPayload`、`TChangePasswordPayload`（從 Zod schema infer）
   - `TLoginResponse`、`TPermissionsResponse`

4. `shared/index.ts` — re-export 所有 schemas 和 types

**修改配置檔：**

5. `tsconfig.json`（根層，新建）
   - 定義 `@shared/*` path alias 基準

6. `client/tsconfig.app.json`
   - 新增 `paths: { "@shared/*": ["../shared/*"] }`

7. `server/tsconfig.json`
   - 新增 `baseUrl` 與 `paths: { "@shared/*": ["../shared/*"] }`

8. `client/vite.config.ts`
   - 新增 `resolve.alias: { '@shared': path.resolve(__dirname, '../shared') }`

**安裝依賴：**

9. 在 `server/` 和 `client/` 各安裝 `zod`

**建立前端工具：**

10. `client/src/utils/zodToAntdRules.ts`
    - 將 Zod schema 欄位轉換為 Antd Form 的 `rules` 格式
    - 支援 required、min、max 等常用規則

### 驗證方式

- `server/` 中可 `import { loginSchema } from '@shared/schemas/auth'` 且 TypeScript 無錯誤
- `client/` 中可 `import { loginSchema } from '@shared/schemas/auth'` 且 Vite 編譯無錯誤
- `npm run dev` 前後端皆正常啟動
- Zod schema 的 `parse()` 和 `safeParse()` 可正常執行

---

## Task 1.3: Validation Middleware

建立後端 payload 驗證中間件。

**建立檔案：**

1. `server/src/middleware/validate.ts`
   - `validate(schema: ZodSchema)` — 驗證 `req.body`
   - 驗證失敗 → 拋出 `AppError(ErrorCode.VALIDATION_ERROR)`，附帶第一個欄位的錯誤訊息
   - 驗證成功 → `req.body = result.data`（strip unknown fields）→ 呼叫 `next()`
   - 參照 [rfc_01 §5.4](rfc_01-auth-and-response.md)

### 驗證方式

- 建立臨時測試路由，送出不符格式的 body → 回傳 `{ success: false, error: { code: 'VALIDATION_ERROR', message: '...' } }`
- 送出符合格式的 body → 正常進入 controller

---

## Task 1.4: 測試基礎設施

建立 Vitest 測試環境與共用 test helpers。

**安裝依賴：**

1. 根層或各層安裝：`vitest`
2. `server/`：`supertest`、`@types/supertest`
3. `client/`：`@testing-library/react`、`@testing-library/jest-dom`、`@testing-library/user-event`、`jsdom`

**建立檔案：**

4. `vitest.workspace.ts`（根層）
   - 定義 server project（node 環境）和 client project（jsdom 環境）

5. `server/vitest.config.ts`
   - 環境：node
   - Path alias：`@shared/*` 對應 `../shared/*`

6. `client/vitest.config.ts`
   - 環境：jsdom
   - Path alias：`@shared/*` 對應 `../shared/*`
   - Setup files：指向 testing-library setup

7. `server/src/__tests__/helpers/testDb.ts`
   - `createTestDb()` — 建立 in-memory SQLite DB、執行 migration、載入 seed
   - 提供 `getTestDb()` 和 `closeTestDb()` 方法

8. `server/src/__tests__/helpers/testApp.ts`
   - `createTestApp(db)` — 建立掛載了測試 DB 的 Express app instance

9. `server/src/__tests__/helpers/testAuth.ts`
   - `generateToken(payload)` — 產生測試用 JWT
   - 預設提供 `seniorToken`、`generalToken`、`expiredToken`

10. `client/src/__tests__/helpers/setup.ts`
    - Import `@testing-library/jest-dom` 擴展

11. 根層 `package.json` scripts 新增：
    - `"test": "vitest run"`
    - `"test:watch": "vitest"`

### 驗證方式

- `npm test` 可執行（目前無測試也不報錯）
- Test helpers 的 TypeScript 型別正確
- in-memory SQLite DB 可成功建立並查詢

---

## Task 1.5: DB Migration — admins 表 + seed

建立管理員資料表與初始 Mock Data。

**建立檔案：**

1. `server/db/migrations/YYYYMMDDHHMMSS_create_admins.ts`
   - 欄位：`id`、`username`（unique）、`password_hash`、`role`、`is_active`、`created_by`、`created_at`、`updated_at`
   - 參照 [rfc_01 §5.8](rfc_01-auth-and-response.md)

2. `server/db/seeds/01_admins.ts`
   - 3 筆管理員帳號（admin01 senior、admin02 general、admin03 general 停用）
   - 密碼使用 bcryptjs 雜湊
   - 參照 [rfc_01 §5.8](rfc_01-auth-and-response.md)

### 驗證方式

- `npm run db:migrate` 成功建立 admins 表
- `npm run db:seed` 成功插入 3 筆資料
- 使用 SQLite CLI 或程式查詢確認資料正確
- `admin03.is_active` 為 false

---

## Task 1.6: 權限設定檔

建立 Config-Based RBAC 權限定義。

**建立檔案：**

1. `server/src/config/permissions.ts`
   - `ROLE_PERMISSIONS`：general_manager 15 個權限、senior_manager 繼承 + 6 個 = 21 個
   - `getPermissionsForRole(role)` — 未知 role 回傳空陣列
   - 參照 [rfc_01 §5.5](rfc_01-auth-and-response.md)

### 驗證方式

```ts
getPermissionsForRole('general_manager').length === 15;
getPermissionsForRole('senior_manager').length === 21;
getPermissionsForRole('unknown'); // []
getPermissionsForRole('senior_manager').includes('broadcast:create'); // true
getPermissionsForRole('general_manager').includes('broadcast:create'); // false
```

### Task 1.6t: Unit Tests — 權限設定檔

**建立** `server/src/__tests__/unit/permissions.test.ts`

**測試案例：**

- general_manager 有 15 個權限
- senior_manager 有 21 個權限
- senior_manager 包含 general_manager 所有權限
- senior_manager 額外擁有 admin:\*、broadcast:\* 權限
- 未知 role 回傳空陣列
- 所有權限格式符合 `resource:action` 慣例

---

## Task 1.7: Auth Middleware + Permission Middleware

建立 JWT 驗證與權限檢查中間件。

**建立檔案：**

1. `server/src/middleware/auth.ts`
   - 檢查 `Authorization: Bearer <token>` header
   - 驗證 JWT → 附加 `req.user = { id, username, role }` 到 request
   - 缺少 header → 拋出 `AppError(AUTH_MISSING_TOKEN)`
   - 無效 token → 拋出 `AppError(AUTH_INVALID_TOKEN)`
   - Token 過期 → 拋出 `AppError(AUTH_TOKEN_EXPIRED)`
   - 參照 [rfc_01 §5.6](rfc_01-auth-and-response.md)

2. `server/src/middleware/permission.ts`
   - `requirePermission(...permissions)` — 高階函式回傳 middleware
   - 檢查 `req.user.role` 的權限是否包含所有 required permissions（AND 邏輯）
   - 不足 → 拋出 `AppError(FORBIDDEN_INSUFFICIENT_PERMISSIONS)`
   - 參照 [rfc_01 §5.7](rfc_01-auth-and-response.md)

### 驗證方式

```bash
# 無 token → 401
curl http://localhost:3000/api/auth/permissions
# 無效 token → 401
curl -H "Authorization: Bearer invalid" http://localhost:3000/api/auth/permissions
```

### Task 1.7t: Unit Tests — auth/permission middleware

**建立** `server/src/__tests__/unit/authMiddleware.test.ts`

**測試案例（auth middleware）：**

- 無 Authorization header → AUTH_MISSING_TOKEN
- Authorization 格式不是 Bearer → AUTH_MISSING_TOKEN
- 無效 token → AUTH_INVALID_TOKEN
- 過期 token → AUTH_TOKEN_EXPIRED
- 有效 token → req.user 正確設定，呼叫 next()

**建立** `server/src/__tests__/unit/permissionMiddleware.test.ts`

**測試案例（permission middleware）：**

- general_manager 存取 chat:read → 通過
- general_manager 存取 broadcast:create → FORBIDDEN
- senior_manager 存取 broadcast:create → 通過
- 多權限 AND 邏輯檢查
- 未知 role → FORBIDDEN

---

## Task 1.8: Login API + Change Password API

建立認證相關 API 端點。

**建立檔案：**

1. `server/src/module/auth/service.ts`
   - `login(username, password)` — 查詢 DB、驗證密碼、檢查 is_active、產生 JWT
   - `changePassword(userId, oldPassword, newPassword)` — 驗證舊密碼、更新 password_hash

2. `server/src/module/auth/controller.ts`
   - `login(req, res)` — 使用 `ResponseHelper.success()` 回傳
   - `changePassword(req, res)` — 使用 `ResponseHelper.success()` 回傳

3. `server/src/module/auth/route.ts`
   - `POST /login` — `validate(loginSchema)` → `ctrl.login`
   - `PUT /password` — `auth` → `requirePermission('auth:change_own_password')` → `validate(changePasswordSchema)` → `ctrl.changePassword`
   - `GET /permissions` — `auth` → 回傳 `getPermissionsForRole(req.user.role)`

**修改檔案：**

4. `server/src/app.ts`
   - 掛載 `app.use('/api/auth', authRoutes)`

### 驗證方式

```bash
# 登入成功
curl -X POST -H "Content-Type: application/json" \
  -d '{"username":"admin01","password":"123456"}' \
  http://localhost:3000/api/auth/login
# 預期：{ success: true, data: { token: "...", user: { id, username, role } } }

# 帳密錯誤
curl -X POST -H "Content-Type: application/json" \
  -d '{"username":"admin01","password":"wrong"}' \
  http://localhost:3000/api/auth/login
# 預期：{ success: false, error: { code: "AUTH_INVALID_CREDENTIALS", message: "..." } }

# 帳號停用
curl -X POST -H "Content-Type: application/json" \
  -d '{"username":"admin03","password":"123456"}' \
  http://localhost:3000/api/auth/login
# 預期：{ success: false, error: { code: "AUTH_ACCOUNT_DISABLED", message: "..." } }

# 改密碼
curl -X PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"oldPassword":"123456","newPassword":"654321"}' \
  http://localhost:3000/api/auth/password
# 預期：{ success: true, data: { message: "密碼更新成功" } }
```

對應 Gherkin scenarios：`@happy_path 登入成功`、`@error_handling 帳密錯誤`、`@permissions 帳號停用`、`@happy_path 改密碼成功`

### Task 1.8t: Integration Tests — login + password

**建立** `server/src/__tests__/integration/auth.login.test.ts`

**測試案例：**

- 正確帳密 → 200 + token + user info（`@happy_path`）
- 缺少 username → 400 VALIDATION_ERROR（`@validation`）
- 缺少 password → 400 VALIDATION_ERROR（`@validation`）
- 帳號不存在 → 401 AUTH_INVALID_CREDENTIALS（`@error_handling`）
- 密碼錯誤 → 401 AUTH_INVALID_CREDENTIALS（`@error_handling`）
- 帳號停用 → 403 AUTH_ACCOUNT_DISABLED（`@permissions`）
- 回應格式符合 envelope 結構

**建立** `server/src/__tests__/integration/auth.password.test.ts`

**測試案例：**

- 正確舊密碼 + 新密碼 → 200 成功（`@happy_path`）
- 舊密碼錯誤 → 400 AUTH_OLD_PASSWORD_INCORRECT（`@error_handling`）
- 新密碼太短 → 400 VALIDATION_ERROR（`@validation`）
- 缺少欄位 → 400 VALIDATION_ERROR（`@validation`）
- 未帶 token → 401（`@security`）
- 更新後使用新密碼可登入

---

## Task 1.9: Permission API

建立權限查詢端點（已在 Task 1.8 的 route 中定義，此 task 確保獨立可測試）。

**確認：** `GET /api/auth/permissions` 端點已在 `auth/route.ts` 中建立。

### 驗證方式

```bash
# senior_manager
curl -H "Authorization: Bearer $SENIOR_TOKEN" http://localhost:3000/api/auth/permissions
# 預期：{ success: true, data: { role: "senior_manager", permissions: [...21 items] } }

# general_manager
curl -H "Authorization: Bearer $GENERAL_TOKEN" http://localhost:3000/api/auth/permissions
# 預期：{ success: true, data: { role: "general_manager", permissions: [...15 items] } }
```

對應 Gherkin scenarios：`@happy_path 登入後取得權限清單`

### Task 1.9t: Integration Tests — permissions + 跨角色權限驗證

**建立** `server/src/__tests__/integration/auth.permissions.test.ts`

**測試案例：**

- senior_manager → 21 個權限（`@happy_path`）
- general_manager → 15 個權限（`@happy_path`）
- 未帶 token → 401（`@security`）

**建立** `server/src/__tests__/integration/permissionEnforcement.test.ts`

**測試案例：**

- general_manager 存取 broadcast route → 403（`@permissions`）
- general_manager 存取 admin route → 403（`@permissions`）
- senior_manager 存取 broadcast route → 通過（`@permissions`）
- senior_manager 存取 admin route → 通過（`@permissions`）

---

## Task 1.10: Create Admin API

建立新增管理員帳號端點，僅 senior_manager 可執行。

**建立檔案：**

1. `shared/schemas/admin.ts`
   - `createAdminSchema`：username（必填，min 3，max 50）、password（必填，min 6）、role（enum: general_manager / senior_manager）
   - 參照 [rfc_01 §5.3](rfc_01-auth-and-response.md)

2. `shared/types/admin.ts`
   - `TCreateAdminPayload`（從 Zod schema infer）
   - `TCreateAdminResponse`：`{ id, username, role, is_active, created_at }`

3. `server/src/module/admin/service.ts`
   - `createAdmin(payload, createdBy)` — 檢查 username 是否重複 → bcrypt 雜湊密碼 → 寫入 DB → 回傳新帳號資訊（不含 password_hash）
   - 重複 username → 拋出 `AppError(ADMIN_USERNAME_DUPLICATE)`
   - 寫入 operation_logs（action: `admin:create`，operator_id: createdBy，target: username）

4. `server/src/module/admin/controller.ts`
   - `createAdmin(req, res)` — 使用 `ResponseHelper.success(res, data, 201)` 回傳

5. `server/src/module/admin/route.ts`
   - `POST /` — `auth` → `requirePermission('admin:create')` → `validate(createAdminSchema)` → `ctrl.createAdmin`

**修改檔案：**

6. `server/src/app.ts`
   - 掛載 `app.use('/api/admins', adminRoutes)`

7. `shared/index.ts`
   - re-export admin schemas 和 types

### 驗證方式

```bash
# 新增成功（senior_manager）
curl -X POST -H "Authorization: Bearer $SENIOR_TOKEN" -H "Content-Type: application/json" \
  -d '{"username":"admin04","password":"123456","role":"general_manager"}' \
  http://localhost:3000/api/admins
# 預期：201, { success: true, data: { id, username, role, is_active: true, created_at } }

# 帳號重複
curl -X POST -H "Authorization: Bearer $SENIOR_TOKEN" -H "Content-Type: application/json" \
  -d '{"username":"admin01","password":"123456","role":"general_manager"}' \
  http://localhost:3000/api/admins
# 預期：409, { success: false, error: { code: "ADMIN_USERNAME_DUPLICATE" } }

# 權限不足（general_manager）
curl -X POST -H "Authorization: Bearer $GENERAL_TOKEN" -H "Content-Type: application/json" \
  -d '{"username":"admin04","password":"123456","role":"general_manager"}' \
  http://localhost:3000/api/admins
# 預期：403, { success: false, error: { code: "FORBIDDEN_INSUFFICIENT_PERMISSIONS" } }
```

對應 Gherkin scenarios：`@happy_path 高級管理員成功新增管理員帳號`、`@error_handling 帳號已存在`、`@permissions 一般管理員無法新增`

### Task 1.10t: Integration Tests — create admin

**建立** `server/src/__tests__/integration/admin.create.test.ts`

**測試案例：**

- senior_manager 新增帳號 → 201 + 新帳號資訊（`@happy_path`）
- 回應不包含 password_hash（`@security`）
- username 長度不足 → 400 VALIDATION_ERROR（`@validation`）
- password 長度不足 → 400 VALIDATION_ERROR（`@validation`）
- role 無效 → 400 VALIDATION_ERROR（`@validation`）
- username 重複 → 409 ADMIN_USERNAME_DUPLICATE（`@error_handling`）
- general_manager 新增帳號 → 403 FORBIDDEN（`@permissions`）
- 新增後使用新帳號可登入（`@happy_path`）
- operation_logs 有寫入紀錄

---

## Task 1.11: 前端 Auth

建立前端認證流程：API 封裝、狀態管理、路由守衛、登入頁面、Sidebar 權限控制。

**建立檔案：**

1. `client/src/api/client.ts`
   - Axios 實例
   - Request interceptor：自動附加 `Authorization: Bearer <token>`
   - Response interceptor：token 過期（401）時自動登出

2. `client/src/api/auth.ts`
   - `authApi.login(data)` / `authApi.changePassword(data)` / `authApi.getPermissions()`
   - 使用 `@shared/types` 的型別定義

3. `client/src/context/AuthContext.tsx`
   - 狀態：`user`、`token`、`permissions`、`isAuthenticated`
   - 方法：`login()`、`logout()`、`hasPermission(code)`
   - 初始化從 localStorage 恢復登入狀態
   - 參照 [rfc_01 §5.10](rfc_01-auth-and-response.md)

4. `client/src/components/ProtectedRoute.tsx`
   - Props：`permission?`（需要的權限碼）
   - 未登入 → 導向 `/login`
   - 無權限 → 導向首頁

5. `client/src/pages/LoginPage.tsx`
   - Antd Form + Input + Button
   - 使用 `zodToAntdRules(loginSchema)` 設定驗證規則
   - 送出 → `AuthContext.login()` → 成功導向首頁 / 失敗 `message.error`
   - 使用 `createStyles` 管理樣式

**修改檔案：**

6. `client/src/layouts/AdminLayout.tsx`
   - Sidebar 選單依 `hasPermission()` 過濾
   - general_manager → 6 項 / senior_manager → 8 項
   - 參照 [rfc_01 §5.10](rfc_01-auth-and-response.md)

7. `client/src/App.tsx`
   - 包裹 `AuthProvider`
   - 路由配置加入 LoginPage、ProtectedRoute

### 驗證方式

1. 開啟 `/login`，輸入 admin01/123456 → 登入成功，導向首頁
2. Sidebar 顯示全部 8 個選單（senior_manager）
3. 登出，用 admin02/123456 登入 → Sidebar 不顯示「系統廣播」和「帳號管理」
4. 手動輸入 `/broadcasts` URL → 導向首頁
5. 登入表單空白送出 → 顯示欄位驗證錯誤提示

對應 Gherkin scenarios：`@permissions Sidebar 依角色顯示選單`、`@permissions 未授權頁面導向`

### Task 1.11t: 前端 Component Tests

**建立** `client/src/__tests__/context/AuthContext.test.tsx`

**測試案例：**

- login 成功 → user、token、permissions 正確設定
- login 失敗 → 拋出錯誤
- logout → 清除所有狀態
- hasPermission → 正確檢查權限
- 初始化 → 從 localStorage 恢復狀態

**建立** `client/src/__tests__/components/ProtectedRoute.test.tsx`

**測試案例：**

- 未登入 → 導向 /login
- 已登入但無權限 → 導向首頁
- 已登入且有權限 → 渲染子元件

**建立** `client/src/__tests__/pages/LoginPage.test.tsx`

**測試案例：**

- 渲染登入表單（username、password、submit button）
- 空白送出 → 顯示驗證錯誤
- 填入帳密送出 → 呼叫 login API
- API 失敗 → 顯示錯誤訊息

**建立** `client/src/__tests__/layouts/AdminLayout.sidebar.test.tsx`

**測試案例：**

- senior_manager → 顯示 8 個選單項目
- general_manager → 顯示 6 個選單項目（不含 broadcast、admin）

---

## Task 1.12: Server — HttpOnly Cookie 認證 + /me + /logout

將 JWT token 改為同時透過 HttpOnly Cookie 傳遞，新增 `/api/auth/me`（恢復登入狀態）與 `/api/auth/logout`（清除 cookie）端點。Auth middleware 優先讀 cookie，fallback 到 Authorization header（保持 Postman 可用性）。

**安裝依賴：**

1. `server/` 安裝 `cookie-parser` + `@types/cookie-parser`

**修改檔案：**

2. `server/src/app.ts`
   - 新增 `import cookieParser from 'cookie-parser'`
   - 掛載 `app.use(cookieParser())`
   - CORS 設定加 `credentials: true` 與明確 `origin`

3. `server/src/middleware/auth.ts`
   - Token 來源改為：先讀 `req.cookies.token`，若無則 fallback 到 `Authorization: Bearer` header
   - 其餘驗證邏輯不變

4. `server/src/module/auth/controller.ts`
   - `login`：呼叫 service 後，除了回傳 `{ token, user }` 也設定 HttpOnly cookie（`res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: 4 * 60 * 60 * 1000 })`）
   - 新增 `me` handler：從 `req.user` 取得 user info + `getPermissionsForRole(role)` 回傳 `{ user, permissions }`
   - 新增 `logout` handler：`res.clearCookie('token', { httpOnly: true, sameSite: 'strict', path: '/' })` 回傳成功訊息

5. `server/src/module/auth/route.ts`
   - 新增 `GET /me` — `auth` → `ctrl.me`
   - 新增 `POST /logout` — `auth` → `ctrl.logout`

6. `shared/types/auth.ts`
   - 新增 `TMeResponse = { user: { id, username, role }, permissions: string[] }`

7. `shared/index.ts`
   - re-export `TMeResponse`

### 驗證方式

```bash
# 登入 → 回傳 token + Set-Cookie header
curl -v -X POST -H "Content-Type: application/json" \
  -d '{"username":"admin01","password":"123456"}' \
  http://localhost:3000/api/auth/login
# 預期：Response body 有 token + user；Response header 有 Set-Cookie: token=...; HttpOnly; ...

# 使用 cookie 呼叫 /me
curl -b "token=<jwt>" http://localhost:3000/api/auth/me
# 預期：{ success: true, data: { user: { id, username, role }, permissions: [...] } }

# 使用 Bearer token 呼叫 /me（fallback）
curl -H "Authorization: Bearer <jwt>" http://localhost:3000/api/auth/me
# 預期：同上

# 登出
curl -b "token=<jwt>" -X POST http://localhost:3000/api/auth/logout
# 預期：{ success: true, data: { message: '登出成功' } } + Set-Cookie: token=; Max-Age=0
```

對應 Gherkin scenarios：`@happy_path 登入成功（HttpOnly Cookie）`、`@happy_path 透過 /api/auth/me 取得資訊`、`@happy_path 登出清除 Cookie`、`@security Cookie 過期`

### Task 1.12t: Integration Tests — cookie auth + /me + /logout

**修改** `server/src/__tests__/integration/auth.login.test.ts`

**新增測試案例：**

- 登入成功 → response header 包含 `Set-Cookie`，cookie 屬性含 `HttpOnly`
- 登入成功 → response body 仍包含 `token`（向後相容）

**建立** `server/src/__tests__/integration/auth.me.test.ts`

**測試案例：**

- 帶 cookie 請求 /me → 200 + user + permissions（`@happy_path`）
- 帶 Bearer token 請求 /me → 200（fallback 驗證）
- senior_manager → 回傳 21 個 permissions
- general_manager → 回傳 15 個 permissions
- 無 cookie 也無 token → 401 AUTH_MISSING_TOKEN（`@security`）
- 過期 cookie → 401 AUTH_TOKEN_EXPIRED（`@security`）

**建立** `server/src/__tests__/integration/auth.logout.test.ts`

**測試案例：**

- 登出 → 200 + 清除 cookie（Set-Cookie Max-Age=0）
- 登出後再請求 /me → 401
- 未認證請求 /logout → 401

---

## Task 1.13: Client — 移除 localStorage + NotFoundPage + Login 跳轉

前端認證改用 HttpOnly Cookie，移除所有 localStorage 操作。新增 NotFoundPage、LoginPage 已登入跳轉邏輯。

**修改檔案：**

1. `client/src/api/client.ts`
   - Axios 實例新增 `withCredentials: true`
   - **移除** request interceptor（不再手動加 Authorization header，cookie 由瀏覽器自動帶）
   - Response interceptor 401 處理：移除 `localStorage.removeItem` 操作，僅導向 `/login`

2. `client/src/api/auth.ts`
   - 新增 `getMe: () => client.get<TApiResponse<TMeResponse>>('/api/auth/me')`
   - 新增 `logout: () => client.post<TApiResponse<{ message: string }>>('/api/auth/logout')`
   - import `TMeResponse` 型別

3. `client/src/context/AuthContext.tsx`
   - **移除** 所有 `localStorage.getItem / setItem / removeItem` 操作
   - **移除** `token` 狀態（token 存在 cookie，前端不需存取）
   - **新增** `loading: boolean` 狀態（初始為 true）
   - `isAuthenticated`：改為 `!!user`（不再依賴 token）
   - **初始化**：`useEffect` 中呼叫 `/api/auth/me`，成功 → 設定 user + permissions + `loading = false`；失敗（401）→ `loading = false`，保持未登入
   - `login()`：呼叫 login API（server 設定 cookie）→ 呼叫 `getMe()` 取得 permissions → 設定 user + permissions
   - `logout()`：呼叫 `/api/auth/logout`（server 清除 cookie）→ 清除 user + permissions 狀態

4. `client/src/components/ProtectedRoute.tsx`
   - 從 AuthContext 取得 `loading` 狀態
   - `loading` 時回傳 Antd `Spin`（全頁 spinner），避免閃爍跳轉到 /login

5. `client/src/pages/LoginPage.tsx`
   - 新增已登入跳轉：若 `isAuthenticated` 為 true，回傳 `<Navigate to="/" replace />`

6. `client/src/pages/NotFoundPage.tsx`（新增）
   - 使用 Antd `Result` 元件，`status="404"`，title 與 subTitle 提示頁面不存在
   - 提供「返回首頁」按鈕
   - 使用 `createStyles` 管理樣式

7. `client/src/router.tsx`
   - AdminLayout `children` 新增 catch-all 路由：`{ path: '*', element: <NotFoundPage /> }`
   - import NotFoundPage

### 驗證方式

1. 開啟 `/login`，輸入 admin01/123456 → 登入成功，導向首頁
2. 重新整理頁面 → 自動恢復登入狀態（不需重新登入）
3. 開啟 DevTools → Application → localStorage → 無任何認證資訊
4. 已登入狀態手動輸入 `/login` → 自動跳轉到 `/`
5. 已登入狀態輸入 `/nonexistent` → 在 AdminLayout 內顯示 NotFoundPage（Sidebar + Header 仍在）
6. 點擊登出 → 重新整理頁面 → 導向 /login

對應 Gherkin scenarios：`@happy_path 頁面重新載入恢復登入狀態`、`@happy_path 已登入進入登入頁跳轉主頁`、`@happy_path 登入後存取不存在頁面顯示 404`

### Task 1.13t: Component Tests — 更新前端測試

**修改** `client/src/__tests__/context/AuthContext.test.tsx`

**更新/新增測試案例：**

- 初始化 → 呼叫 /api/auth/me → 成功恢復 user + permissions
- 初始化 → /api/auth/me 回傳 401 → 保持未登入，loading = false
- login 成功 → user + permissions 正確設定（無 localStorage 操作）
- logout → 呼叫 /api/auth/logout → 清除 user + permissions
- hasPermission → 正確檢查權限
- loading 狀態：初始化期間為 true，完成後為 false

**修改** `client/src/__tests__/components/ProtectedRoute.test.tsx`

**更新/新增測試案例：**

- loading 中 → 顯示 Spin（不跳轉）
- loading 完成 + 未登入 → 導向 /login
- loading 完成 + 已登入有權限 → 渲染子元件

**修改** `client/src/__tests__/pages/LoginPage.test.tsx`

**更新/新增測試案例：**

- 已登入 → 自動導向 /（不顯示表單）

**建立** `client/src/__tests__/pages/NotFoundPage.test.tsx`

**測試案例：**

- 渲染 404 提示文字
- 「返回首頁」按鈕存在

**修改** `client/src/__tests__/layouts/AdminLayout.sidebar.test.tsx`

- 配合新 AuthContext 初始化方式調整 mock

---

## 執行順序

```
Task 1.1（Response/Error 基礎設施）
  ↓
Task 1.2（shared/ 共用層 + Zod）
  ↓
Task 1.3（Validation Middleware）
  ↓
Task 1.4（測試基礎設施）
  ↓
Task 1.5（DB Migration + Seed）
  ↓
Task 1.6 → 1.6t（權限設定 → 測試）
  ↓
Task 1.7 → 1.7t（Auth/Permission Middleware → 測試）
  ↓
Task 1.8 → 1.8t（Login/Password API → 測試）
  ↓
Task 1.9 → 1.9t（Permission API → 測試）
  ↓
Task 1.10 → 1.10t（Create Admin API → 測試）
  ↓
Task 1.11 → 1.11t（前端 Auth → 測試）
  ↓
Task 1.12 → 1.12t（Server HttpOnly Cookie + /me + /logout → 測試）
  ↓
Task 1.13 → 1.13t（Client 移除 localStorage + NotFoundPage + Login 跳轉 → 測試）
  ↓
Task 1.14 → 1.14t（Shared 層擴充 → 編譯驗證）
  ↓
Task 1.15t（Server integration tests — failing first）
  ↓
Task 1.15（errorCodes → service → controller → route）
  ↓
Task 1.16t（ManagerPage.test.tsx — failing first）
  ↓
Task 1.16（admin.ts → ManagerPage.tsx → router.tsx）
  ↓
Task 1.17（prd_00 / rfc_01 / authentication.feature 文件更新）
```

> Task 1.1~1.5 為基礎設施，必須依序執行。Task 1.6 起為功能開發，每個功能 task 後緊接對應的測試 task。Task 1.12~1.13 為安全性改進，Server 先改完再改 Client。Task 1.14~1.17 為帳號管理功能，採 TDD 模式開發。

## Progress

| Task       | 狀態 | 完成日期   | 備註                                                                 |
| ---------- | ---- | ---------- | -------------------------------------------------------------------- |
| Task 1.1   | ✅   | 2026-03-17 | errorCodes, appError, responseHelper, app.ts 改造                    |
| Task 1.2   | ✅   | 2026-03-17 | shared/ 目錄、Zod schemas、types、tsconfig paths、zodToAntdRules     |
| Task 1.3   | ✅   | 2026-03-17 | validate middleware                                                  |
| Task 1.4   | ✅   | 2026-03-17 | Vitest workspace、test helpers、npm test script                      |
| Task 1.5   | ✅   | 2026-03-17 | admins migration + seed（3 筆資料）                                  |
| Task 1.6   | ✅   | 2026-03-17 | RBAC 權限設定檔（15 + 21 權限）                                      |
| Task 1.6t  | ✅   | 2026-03-17 | 7 tests passed                                                       |
| Task 1.7   | ✅   | 2026-03-17 | auth middleware + permission middleware                              |
| Task 1.7t  | ✅   | 2026-03-17 | 11 tests passed（auth 5 + permission 6）                             |
| Task 1.8   | ✅   | 2026-03-17 | auth service + controller + route, DB 初始化                         |
| Task 1.8t  | ✅   | 2026-03-17 | 13 tests passed（login 7 + password 6）                              |
| Task 1.9   | ✅   | 2026-03-17 | GET /api/auth/permissions 端點（已含在 1.8）                         |
| Task 1.9t  | ✅   | 2026-03-17 | 7 tests passed（permissions 3 + enforcement 4）                      |
| Task 1.10  | ✅   | 2026-03-17 | admin module + operation_logs + shared schemas                       |
| Task 1.10t | ✅   | 2026-03-17 | 9 tests passed                                                       |
| Task 1.11  | ✅   | 2026-03-17 | API client, AuthContext, ProtectedRoute, LoginPage, Sidebar          |
| Task 1.11t | ✅   | 2026-03-17 | 14 tests passed（context 5 + route 3 + login 4 + sidebar 2）         |
| Task 1.12  | ✅   | 2026-03-17 | cookie-parser, auth cookie 優先, /me + /logout 端點                  |
| Task 1.12t | ✅   | 2026-03-17 | 11 tests passed（login cookie 2 + me 6 + logout 3）                  |
| Task 1.13  | ✅   | 2026-03-17 | 移除 localStorage, withCredentials, NotFoundPage, Login 跳轉         |
| Task 1.13t | ✅   | 2026-03-17 | 19 tests passed（context 6 + route 4 + login 5 + 404 2 + sidebar 2） |
| Task 1.14  | ✅   | 2026-03-18 | shared schemas/types + operationLog 擴充（UPDATE_ADMIN_ROLE 補充）    |
| Task 1.14t | ✅   | 2026-03-18 | TypeScript 編譯驗證                                                  |
| Task 1.15t | ✅   | 2026-03-18 | server integration tests（20 cases：list 6 + toggle 7 + role 7）     |
| Task 1.15  | ✅   | 2026-03-18 | errorCodes + admin service/controller/route                          |
| Task 1.16t | ✅   | 2026-03-18 | ManagerPage component tests（9 cases）                               |
| Task 1.16  | ✅   | 2026-03-18 | client adminApi + ManagerPage + router                               |
| Task 1.17  | ✅   | 2026-03-18 | prd_00 / rfc_01 / authentication.feature 文件更新                    |

## 完成檢查清單

- [x] 所有 API 回傳統一 envelope 格式
- [x] AppError + error code config 正常運作
- [x] `shared/` 可從 client 和 server 正常 import
- [x] Zod validation middleware 可驗證 request body
- [x] `npm run db:migrate` + `npm run db:seed` 成功
- [x] `POST /api/auth/login` — 回傳 JWT + user info
- [x] `PUT /api/auth/password` — 修改自己密碼
- [x] `GET /api/auth/permissions` — 回傳權限清單
- [x] `POST /api/admins` — 新增管理員帳號（僅 senior_manager）
- [x] 帳號停用 → 403
- [x] general_manager 存取 broadcast/admin → 403
- [x] senior_manager 存取所有路由 → 200
- [x] 前端 LoginPage 登入/驗證/錯誤提示
- [x] 前端 Sidebar 依權限顯示選單
- [x] 前端 ProtectedRoute 阻擋無權限頁面
- [x] 登入設定 HttpOnly Cookie + response body 包含 token
- [x] `/api/auth/me` 可恢復登入狀態
- [x] `/api/auth/logout` 清除 cookie
- [x] Auth middleware 支援 cookie 優先 + Bearer token fallback
- [x] 前端不使用 localStorage 儲存任何認證資訊
- [x] 已登入進入 /login 自動跳轉主頁
- [x] 不存在路由在 AdminLayout 內顯示 NotFoundPage
- [x] `npm test` 全部測試通過（server 58 + client 19 = 77）

### Phase 1D — 帳號管理功能

- [x] `GET /api/admins` — 回傳分頁管理員列表（僅 senior_manager）
- [x] `PUT /api/admins/:id/toggle` — 啟用/停用帳號，含自我保護
- [x] `PATCH /api/admins/:id/role` — 更新管理員角色，含自我保護
- [x] operation_logs 有 `TOGGLE_ADMIN`、`UPDATE_ADMIN_ROLE` 紀錄
- [x] 前端 ManagerPage 列表、新增 Modal、角色切換、停用/啟用功能完整
- [x] 前端當前帳號操作按鈕 disabled（前後端雙重自我保護）
- [x] `/admins` 路由掛載 `ProtectedRoute(admin:read)`
- [x] `npm test` 全部測試通過（server 214 + client 94 無 regression）

---

## Phase 1D — 帳號管理功能（ManagerPage）

### Task 1.14: Shared 層擴充

新增 `shared/schemas/admin.ts`（adminListQuerySchema、updateAdminRoleSchema）與
`shared/types/admin.ts`（TAdminItem、TAdminListQuery、TUpdateAdminRolePayload）。
在 `shared/types/operationLog.ts` 補充 `UPDATE_ADMIN_ROLE` 操作類型與標籤。
更新 `shared/index.ts` 匯出新 schemas / types。

**修改檔案：**

- 新增：`shared/schemas/admin.ts`
- 新增：`shared/types/admin.ts`
- 修改：`shared/types/operationLog.ts`
- 修改：`shared/index.ts`

---

### Task 1.14t: Shared 層驗證

TypeScript 編譯驗證：`adminListQuerySchema.parse({})` 回傳 `{ page: 1, pageSize: 20 }`。

---

### Task 1.15t: Server Integration Tests（先寫，確認 fail）

TDD 模式：先建立 failing tests，確認 FAIL 後再實作。

**新增測試檔案：**

- `server/src/__tests__/integration/admin.list.test.ts`（6 cases）
  - senior_manager 取得列表 → 200 @happy_path
  - 回應不包含 password_hash @security
  - username 模糊搜尋 @happy_path
  - role 篩選 @happy_path
  - general_manager → 403 @permissions
  - 未帶 token → 401 @security
- `server/src/__tests__/integration/admin.toggle.test.ts`（7 cases）
  - 停用 active 帳號 → 200 @happy_path
  - 啟用 inactive 帳號 → 200 @happy_path
  - 嘗試 toggle 自己 → 403 ADMIN_CANNOT_SELF_MODIFY @permissions
  - 不存在的 id → 404 ADMIN_NOT_FOUND @error_handling
  - general_manager → 403 @permissions
  - 未帶 token → 401 @security
  - toggle 後 operation_logs 有 TOGGLE_ADMIN 紀錄 @integration
- `server/src/__tests__/integration/admin.role.test.ts`（7 cases）
  - 更新角色 → 200 + 回傳新角色 @happy_path
  - 嘗試更新自己的角色 → 403 ADMIN_CANNOT_SELF_MODIFY @permissions
  - 不存在的 id → 404 ADMIN_NOT_FOUND @error_handling
  - 無效 role 值 → 400 VALIDATION_ERROR @validation
  - general_manager → 403 @permissions
  - 未帶 token → 401 @security
  - 更新後 operation_logs 有 UPDATE_ADMIN_ROLE 紀錄 @integration

---

### Task 1.15: Server — 帳號管理 API

擴充 admin module，新增三個端點。

**修改檔案：**

- `server/src/utils/errorCodes.ts` — 新增 `ADMIN_NOT_FOUND`（404）、`ADMIN_CANNOT_SELF_MODIFY`（403）
- `server/src/module/admin/service.ts` — 新增 `list()`、`toggle()`、`updateRole()`
- `server/src/module/admin/controller.ts` — 新增 `list`、`toggle`、`updateRole` handler
- `server/src/module/admin/route.ts` — 新增三條路由：
  - `GET /`（`admin:read`）
  - `PUT /:id/toggle`（`admin:toggle`）
  - `PATCH /:id/role`（`admin:toggle` + `validate(updateAdminRoleSchema)`）

---

### Task 1.16t: Client Component Tests（先寫，確認 fail）

TDD 模式：先建立 failing tests。

**新增測試檔案：** `client/src/__tests__/pages/ManagerPage.test.tsx`（9 cases）

- 頁面載入後呼叫 list API 並渲染管理員列表 @happy_path
- 顯示「+ 新增管理員」按鈕 @happy_path
- 點擊按鈕後顯示新增 Modal @happy_path
- 角色欄位顯示正確 Tag @happy_path
- is_active=false 的列按鈕顯示「啟用」@happy_path
- is_active=true 的列按鈕顯示「停用」@happy_path
- 點擊「停用」顯示確認 Modal @happy_path
- 確認後呼叫 toggle API 並 refetch @happy_path
- 當前登入帳號操作按鈕為 disabled @permissions

---

### Task 1.16: Client — ManagerPage

建立前端帳號管理頁面。

**新增/修改檔案：**

- 新增：`client/src/api/admin.ts`（adminApi: list / create / toggle / updateRole）
- 新增：`client/src/pages/ManagerPage.tsx`
  - Table：username、角色（Select+Tag 直接切換）、狀態（Tag）、建立時間、操作
  - 新增管理員 Modal（Form + zodToAntdRules(createAdminSchema)）
  - 停用/啟用按鈕帶 `data-testid="toggle-btn-{id}"` + `Modal.confirm` 確認
  - 當前帳號欄位 `disabled={record.id === user?.id}`
- 修改：`client/src/router.tsx` — 新增 `/admins` 路由（`ProtectedRoute(admin:read)`）

---

### Task 1.17: 文件更新

更新 `prd_00`、`rfc_01`、`authentication.feature`，補充帳號管理功能說明與 scenarios。

> **已完成（2026-03-18）**：本次 commit 已涵蓋此任務內容。
