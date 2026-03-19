# RFC 09 — Testing Guidelines

## Chapter 1：測試分層架構

### 三層分工

| 層級      | 工具                     | 環境       | 負責範疇                       |
| --------- | ------------------------ | ---------- | ------------------------------ |
| Unit      | Vitest                   | node       | 純邏輯函式、middleware、helper |
| Component | Vitest + Testing Library | jsdom      | 單一 component 的互動與狀態    |
| E2E       | Playwright               | 真實瀏覽器 | 跨頁面完整使用者流程           |

**原則：不重複測同一件事。**
登入 API 邏輯在 unit/integration 測，E2E 只驗「登入後能看到 sidebar」，不驗 API 細節。

### 測試環境資源

| 資源     | Server Vitest               | Client Vitest | E2E (Playwright)                       |
| -------- | --------------------------- | ------------- | -------------------------------------- |
| Database | `:memory:` in-memory SQLite | 無（jsdom）   | `server/db/dev.sqlite`（透過 resetDb） |
| HTTP     | supertest（不佔 port）      | 無            | dev server（port 3000 + 5173）         |
| 隔離性   | 完全隔離                    | 完全隔離      | 與 dev 環境共用 DB 及 port             |

**已知限制：** E2E 目前與 dev 環境共用 `dev.sqlite` 及 port（3000/5173）。若同時執行 `npm run dev` 與 `npm run test:e2e`，`resetDb()` 會重置開發中的資料。未來可透過新增 `.env.test`（獨立 `test.sqlite`）解決。

### Vitest 設定重點

**Client (`client/vitest.config.ts`)**

- `globals: true` 已開啟，但規定用**明確 import**（見 Chapter 4）
- `environment: 'jsdom'`
- `setupFiles` 已處理 Antd polyfill（`matchMedia`、`ResizeObserver`），新測試不需自行處理
- `include: 'src/__tests__/**/*.test.{ts,tsx}'`，新測試**必須**放在此路徑下

**Server (`server/vitest.config.ts`)**

- `environment: 'node'`
- 無 `setupFiles`，各 integration test 自行初始化 DB
- `include: 'src/__tests__/**/*.test.ts'`

### Playwright 設定重點

- `workers: 1`、`fullyParallel: false`：E2E **不可平行**，有 DB 狀態依賴
- `retries: 0`：不自動重試，setup 不得有 side effect
- `baseURL: http://localhost:5173`
- 每個測試前用 `resetDb()` 確保資料乾淨

---

## Chapter 2：Selector 優先順序

### Component Tests（Testing Library）

優先順序由高到低：

1. `getByRole` — 語義明確的元素（`button`、`heading`、`dialog`）
2. `getByLabelText` — form 欄位有 label 的情況
3. `getByPlaceholder` — input 有 placeholder
4. `getByText` — 靜態文字內容
5. `getByTestId` — 以上都不適用時才加 `data-testid`

**禁止：**

```ts
// ❌ 禁止
container.querySelector('.ant-form-item-explain-error');
container.firstChild;
```

### E2E Tests（Playwright）

優先順序由高到低：

1. `getByRole` — `menuitem`、`button`、`dialog`
2. `getByPlaceholder` — form input
3. `getByTestId` — 無語義容器、動態列表 row、複雜互動元件
4. `locator('css')` — 只允許自訂 CSS class，**禁用 `.ant-xxx`**

**禁止出現在 spec 檔裡：**

```ts
// ❌ 禁止直接寫在 spec 檔
page.locator('.ant-table-tbody tr');
page.locator('.ant-spin-spinning');
page.locator('.ant-layout-sider');
```

`.ant-xxx` 只允許封裝在 `e2e/helpers/` 內部，spec 檔不得直接引用（見 Chapter 6）。

### 何時一定要加 `data-testid`

| 情境                                 | 範例                                                |
| ------------------------------------ | --------------------------------------------------- |
| 動態列表每一 row / 操作按鈕          | `blacklist__row--{id}`, `manager__toggle-btn--{id}` |
| 無語義容器區塊                       | `sidebar__container`, `chat-monitor__panel`         |
| Modal 裡的確認按鈕（同名按鈕易衝突） | `blacklist__modal__confirm-btn`                     |
| E2E helper 封裝用錨點                | `login__submit-btn`                                 |

---

## Chapter 3：`data-testid` 命名規範

### 格式

```
{feature}__{element}[--{modifier}]
```

| 部分         | 說明                             | 格式       |
| ------------ | -------------------------------- | ---------- |
| `feature`    | 頁面或功能區塊                   | kebab-case |
| `element`    | 元件類型或角色                   | kebab-case |
| `--modifier` | 動態識別符（可選），用 `--` 分隔 | kebab-case |

### 元素後綴慣例

| 後綴          | 用於             |
| ------------- | ---------------- |
| `__btn`       | 按鈕             |
| `__input`     | 文字輸入框       |
| `__select`    | 下拉選單         |
| `__table`     | 表格             |
| `__row--{id}` | 動態列           |
| `__modal`     | 對話框容器       |
| `__form`      | 表單容器         |
| `__container` | 無語義的區塊容器 |

### 正確與錯誤範例

```tsx
// ✅ 正確
data-testid="login__submit-btn"
data-testid="blacklist__table"
data-testid="blacklist__row--{record.id}"
data-testid="manager__toggle-btn--{record.id}"
data-testid="broadcast__send-modal"
data-testid="broadcast__send-modal__confirm-btn"
data-testid="sidebar__container"

// ❌ 錯誤
data-testid="submitBtn"           // 禁用 camelCase
data-testid="btn-submit-login"    // 順序混亂，無層級
data-testid="table1"              // 無意義編號
data-testid="blacklistModalOk"    // camelCase + 無層級
```

### Feature Prefix 對照表

| 頁面 / 區塊         | feature prefix    |
| ------------------- | ----------------- |
| LoginPage           | `login`           |
| ChatroomPage        | `chatroom`        |
| ChatMonitoringPage  | `chat-monitor`    |
| BlacklistPage       | `blacklist`       |
| ManagerPage         | `manager`         |
| BroadcastPage       | `broadcast`       |
| NicknameReviewPage  | `nickname-review` |
| ReportReviewPage    | `report-review`   |
| OperationLogPage    | `operation-log`   |
| AdminLayout sidebar | `sidebar`         |

---

## Chapter 4：測試組織與命名

### 檔案結構

```
client/src/__tests__/
├── components/          ← 可複用 component
├── context/             ← Context provider
├── layouts/             ← Layout component
├── pages/               ← 每個頁面一個測試檔
└── helpers/
    └── setup.ts         ← Antd polyfill，勿修改

e2e/tests/
└── {序號}-{feature}.spec.ts   ← 序號反映操作流程依賴順序

00_doc/
└── {module}.feature     ← Gherkin scenario 文件（見 Chapter 7）
```

### 命名規則

**Component 測試檔**：與來源檔同名，加 `.test.tsx`

```
LoginPage.tsx      → __tests__/pages/LoginPage.test.tsx
AdminLayout.tsx    → __tests__/layouts/AdminLayout.sidebar.test.tsx
                                        ↑ 拆分測試面向時用 . 分隔
```

**E2E 測試檔**：`{序號}-{feature}.spec.ts`，序號代表依賴順序

```
01-authentication.spec.ts   ← 其他頁面依賴登入，排最前
02-chatroom.spec.ts
```

### describe / it 格式

```ts
// ✅ Component test — 明確 import，不依賴 globals
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Scenario: 登入成功後導向首頁 (00_doc/authentication.feature)
describe('LoginPage', () => {
  it('渲染登入表單', () => {}); // 正向流程
  it('空白送出 → 顯示驗證錯誤', () => {}); // 邊界條件，箭頭表達因果
  it('API 失敗 → 顯示錯誤訊息', () => {}); // 錯誤流程
});

// ✅ E2E
test.describe('認證模組', () => {
  test('使用正確帳密登入成功', async ({ page }) => {});
  test('錯誤帳密 → 顯示錯誤訊息', async ({ page }) => {});
});
```

**規則：**

- `describe` 用 component 名稱（英文）或功能模組名稱（中文）
- `it` / `test` 描述一律用**中文**
- 有條件時格式：`{情境} → {預期結果}`
- 純正向流程不需箭頭：`'渲染登入表單'`
- vitest utilities 必須**明確 import**（不依賴 `globals: true`）

---

## Chapter 5：Mock 策略

### 原則：Mock 邊界，不 Mock 實作

```
✅ Mock：外部依賴（API context、router、外部服務）
❌ Mock：被測元件的內部邏輯或第三方元件行為
```

### Component Tests

| 項目                | 做法                                                      |
| ------------------- | --------------------------------------------------------- |
| API 呼叫            | `vi.mock` context hook（如 `useAuth`），不直接 mock axios |
| React Router        | 用 `MemoryRouter` 包裝，不 mock                           |
| Antd ConfigProvider | 用真實 `<ConfigProvider>` 包裝                            |
| 其他 context        | `vi.mock` + `mockReturnValue`                             |

```ts
// ✅ mock context hook
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

// ❌ 不直接 mock axios
vi.mock('axios');
```

### Server Integration Tests

| 項目     | 做法                                  |
| -------- | ------------------------------------- |
| 資料庫   | 用真實 SQLite（test db），**不 mock** |
| HTTP     | supertest，不啟動真實 server port     |
| 外部服務 | 若有則 mock                           |

### E2E Tests

不做任何 mock，全端跑真實流程。每個 `test.describe` 的 `beforeAll` 呼叫 `resetDb()` 確保資料乾淨。

### 何時不需要寫測試

- 純 UI 結構（只有靜態文字、layout）
- 已被 integration test 完整覆蓋的邏輯，不在 component 層重複
- Antd 元件本身的行為（不測第三方）

---

## Chapter 6：E2E 遷移清單

### 高風險 Selector 替換對照

| 現有用法                       | 所在位置                            | 替換方向                                  |
| ------------------------------ | ----------------------------------- | ----------------------------------------- |
| `.ant-layout-sider`            | `helpers/shared.ts` (loginAs)       | `getByTestId('sidebar__container')`       |
| `.ant-table-tbody tr`          | `helpers/shared.ts` (waitForTable)  | `getByRole('row')`                        |
| `.ant-spin-spinning`           | `helpers/shared.ts` (waitForTable)  | 移除或改用 `[aria-busy="true"]`           |
| `.ant-menu-item`               | `01-authentication.spec.ts`         | `getByRole('menuitem')`                   |
| `.ant-message-notice`          | `helpers/shared.ts` (expectMessage) | `getByRole('alert')` 或 `[role="status"]` |
| `.ant-form-item-explain-error` | `01-authentication.spec.ts`         | `getByRole('alert')`                      |
| `button[type="submit"]`        | `helpers/shared.ts` (loginAs)       | `getByTestId('login__submit-btn')`        |

### 遷移優先順序

**P0（最高風險，應優先替換）**

- `shared.ts` loginAs：`button[type="submit"]` → `getByTestId('login__submit-btn')`
- `shared.ts` waitForTable：`.ant-table-tbody tr` → `getByRole('row')`
- `shared.ts` loginAs：`.ant-layout-sider` → `getByTestId('sidebar__container')`

**P1（下次碰到該頁面時替換）**

- spec 檔內的 `.ant-menu-item` → `getByRole('menuitem')`
- `expectMessage` helper：`.ant-message-notice` → `getByRole('alert')`

**P2（暫時可接受）**

- `getByRole('dialog')` — 已是語義 selector，不需改
- `getByRole('menuitem', { name })` — 已是語義 selector，不需改

### 原則：shared helper 是隔離層

`.ant-xxx` **只允許存在於 `e2e/helpers/` 內部**，spec 檔禁止直接引用。
未來 Antd 升版只需改 helper，spec 檔不動。

---

## Chapter 7：Gherkin Scenario 作為活文件

### 定位

`00_doc/{module}.feature` 是測試的**需求來源文件**，不執行、不與工具整合。
每個 scenario 標注測試層級 tag，決定由哪層測試覆蓋。

### 檔案命名

```
00_doc/authentication.feature
00_doc/blacklist.feature
00_doc/chatroom.feature
00_doc/chat-monitoring.feature
00_doc/manager.feature
00_doc/broadcast.feature
00_doc/nickname-review.feature
00_doc/report-review.feature
00_doc/operation-log.feature
```

### Feature 檔格式

```gherkin
Feature: 黑名單管理

  @e2e
  Scenario: 成功新增玩家黑名單
    Given 管理員已登入
    When 填入有效玩家 ID 並送出
    Then 黑名單列表出現該玩家

  @component
  Scenario: 玩家 ID 格式錯誤
    Given 黑名單新增表單已開啟
    When 輸入非法格式的玩家 ID
    Then 顯示欄位驗證錯誤

  @integration
  Scenario: 重複新增已存在的黑名單
    Given 玩家 A 已在黑名單中
    When 再次新增玩家 A
    Then API 回傳 409 錯誤
```

### Tag 與測試層級對應

| Tag            | 對應測試層                | 何時使用                     |
| -------------- | ------------------------- | ---------------------------- |
| `@e2e`         | Playwright spec           | 跨頁面流程、完整 happy path  |
| `@component`   | Vitest + Testing Library  | UI 互動、表單驗證、錯誤狀態  |
| `@unit`        | Vitest（純邏輯）          | helper、middleware、工具函式 |
| `@integration` | Vitest server integration | API 邏輯、DB 操作、權限      |

### 測試檔對應方式

在測試的 `describe` 或 `it` 前加 comment 指向 scenario：

```ts
// Scenario: 玩家 ID 格式錯誤 (00_doc/blacklist.feature)
it('玩家 ID 格式錯誤 → 顯示驗證錯誤', () => {
  // ...
});
```

### 工作流程

新增功能或測試前：

1. 確認 `00_doc/{module}.feature` 是否有對應 scenario
2. 若無，先補寫 scenario（Given / When / Then）並標注 `@tag`
3. 依 `@tag` 決定在哪層寫測試
4. 測試 `describe` / `it` 前加 comment 指向 scenario

**原則：scenario 先行，實作與測試跟隨 scenario 定義。**
