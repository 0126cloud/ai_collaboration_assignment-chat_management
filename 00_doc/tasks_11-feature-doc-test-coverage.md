# Tasks 11 — Feature 文件對齊 + 測試覆蓋補齊

## Background

依 assignment 需求確認、rfc_09 testing guidelines 規範，對所有 feature 文件進行系統性調整，並補齊缺失的測試。

### rfc_09 Tag 系統

每個 scenario 對應恰好一個測試層 tag：

- `@integration` — Vitest server integration（API、DB、權限）
- `@component` — Vitest + Testing Library（單一 UI component）
- `@e2e` — Playwright（跨頁面完整流程）
- `@unit` — Vitest 純邏輯

### Feature 文件命名（rfc_09 Chapter 7）

| 目前                          | 應為                                                  |
| ----------------------------- | ----------------------------------------------------- |
| `chatroom-management.feature` | `chatroom.feature`                                    |
| `broadcast-message.feature`   | `broadcast.feature`                                   |
| `operation-logs.feature`      | `operation-log.feature`                               |
| `nickname-and-report.feature` | → `nickname-review.feature` + `report-review.feature` |
| （不存在）                    | `manager.feature`                                     |

---

## Phase 1：Feature 文件更名

### Task 1.1：更名三個 feature 文件

- [x] `git mv 00_doc/chatroom-management.feature 00_doc/chatroom.feature`
- [x] `git mv 00_doc/broadcast-message.feature 00_doc/broadcast.feature`
- [x] `git mv 00_doc/operation-logs.feature 00_doc/operation-log.feature`
- [x] Commit: `docs: 更名 feature 文件以符合 rfc_09 命名規範`

---

## Phase 2：Feature 文件內容修正

### Task 2.1：修正 blacklist.feature

**Files:** `00_doc/blacklist.feature`

**修正項目：**

1. Line 22：`chatroom_id="*"` → `chatroom_id="all"`（對齊 commit b15a4e5）
2. 補測試層 tag（在現有 descriptive tag 前加，保留原 tag）：

| 現有 tag                                      | 對應測試層                    |
| --------------------------------------------- | ----------------------------- |
| `@happy_path`（API）                          | → `@integration @happy_path`  |
| `@soft_delete`                                | → `@integration @soft_delete` |
| `@validation`                                 | → `@integration @validation`  |
| `@permissions`                                | → `@integration @permissions` |
| `@ui_only`（Modal type switch）               | → `@component @ui_only`       |
| `@ui_only`（ChatMonitoringPage block button） | → `@e2e @ui_only`             |
| `@ui_only`（open modal with prefilled data）  | → `@e2e @ui_only`             |

- [x] 修改 `chatroom_id="*"` → `chatroom_id="all"`
- [x] 為每個 scenario 加測試層 tag
- [x] Commit: `docs(blacklist): 修正全域封鎖識別符並補測試層 tag`

---

### Task 2.2：修正 chat-monitoring.feature

**Files:** `00_doc/chat-monitoring.feature`

**修正項目：**

1. Lines 183-187：替換 disabled 重設暱稱 scenario（已實作，文件過時）
2. 補測試層 tag

**新 scenarios（替換 lines 183-187）：**

```gherkin
  # ─── 重設暱稱 ───

  @e2e @happy_path
  Scenario: 從聊天監控頁面重設玩家暱稱
    Given 管理員 "admin01" 已登入
    And 玩家 "player123" 的暱稱為 "LuckyBoy"
    When 前端在訊息列點擊「重設暱稱」按鈕並確認對話框
    Then 系統呼叫 PUT /api/players/player123/nickname/reset
    And 玩家 "player123" 的暱稱重設為 "player123"
    And 頁面顯示操作成功提示

  @integration @happy_path
  Scenario: 重設暱稱 API 成功
    Given 管理員 "admin01" 已登入
    And 玩家 "player123" 的暱稱為 "LuckyBoy"
    When 管理員呼叫 PUT /api/players/player123/nickname/reset
    Then 系統回傳 200 狀態碼
    And 玩家 "player123" 的 nickname 變為 "player123"
    And 玩家 "player123" 的 nickname_review_status 變為 null
    And 操作紀錄包含 operationType 為 "RESET_NICKNAME" 的紀錄

  @integration @permissions
  Scenario: 一般管理員可重設暱稱
    Given 管理員 "admin02"（general_manager）已登入
    When 管理員呼叫 PUT /api/players/player123/nickname/reset
    Then 系統回傳 200 狀態碼

  @integration @permissions
  Scenario: 未登入無法重設暱稱
    When 未帶 Token 呼叫 PUT /api/players/player123/nickname/reset
    Then 系統回傳 401 狀態碼
    And 錯誤碼為 "AUTH_MISSING_TOKEN"

  @integration @validation
  Scenario: 重設不存在的玩家暱稱
    Given 管理員 "admin01" 已登入
    When 管理員呼叫 PUT /api/players/nonexistent/nickname/reset
    Then 系統回傳 404 狀態碼
    And 錯誤碼為 "PLAYER_NOT_FOUND"

  @component @ui_only
  Scenario: 重設暱稱按鈕為可點擊狀態
    Given 管理員 "admin01" 已登入
    When 前端渲染聊天監控頁面
    Then 每筆訊息的操作欄有「重設暱稱」按鈕
    And 「重設暱稱」按鈕為 enabled 狀態
```

**其他 scenarios 測試層 tag：**

| 現有 tag                         | 對應測試層                    |
| -------------------------------- | ----------------------------- |
| `@happy_path`（API list/filter） | → `@integration @happy_path`  |
| `@soft_delete`                   | → `@integration @soft_delete` |
| `@validation`                    | → `@integration @validation`  |
| `@permissions`                   | → `@integration @permissions` |
| `@ui_only`（封鎖玩家按鈕 UI）    | → `@component @ui_only`       |

- [x] 替換 lines 183-187 為新 scenarios
- [x] 為所有其他 scenarios 加測試層 tag
- [x] Commit: `docs(chat-monitoring): 更新重設暱稱 scenario 並補測試層 tag`

---

### Task 2.3：拆分 nickname-and-report.feature

**Files:**

- Delete: `00_doc/nickname-and-report.feature`
- Create: `00_doc/nickname-review.feature`
- Create: `00_doc/report-review.feature`

**nickname-review.feature：** 從原文件取出 `Feature: 暱稱審核（Nickname Review）` 全部內容，補測試層 tag：

- API scenarios → `@integration @happy_path / @validation / @permissions`
- 新增 E2E scenario：
  ```gherkin
  @e2e @happy_path
  Scenario: 管理員核准暱稱申請完整流程
    Given 管理員 "admin01" 已登入
    And 待審核列表中有玩家 "player016" 申請暱稱 "DragonKing"
    When 管理員點擊核准按鈕並確認
    Then 頁面顯示操作成功提示
    And 該申請從待審核列表消失
  ```

**report-review.feature：** 從原文件取出 `Feature: 玩家檢舉審核（Player Report Review）` 全部內容，補測試層 tag：

- API scenarios → `@integration @happy_path / @auto_block / @already_reviewed / @validation / @permissions`
- 新增 E2E scenario：

  ```gherkin
  @e2e @happy_path
  Scenario: 管理員核准檢舉，被檢舉玩家自動加入黑名單
    Given 管理員 "admin01" 已登入
    And 玩家 "player003" 未在黑名單中
    When 管理員核准 id=1 的檢舉並確認
    Then 頁面顯示操作成功提示
    And 至黑名單頁面查詢，"player003" 出現在列表中
  ```

- [x] 建立 `nickname-review.feature`
- [x] 建立 `report-review.feature`
- [x] 刪除 `nickname-and-report.feature`
- [x] Commit: `docs: 拆分 nickname-and-report.feature 為兩個獨立文件並補測試層 tag`

---

### Task 2.4：補測試層 tags — broadcast.feature、operation-log.feature

**Files:** `00_doc/broadcast.feature`、`00_doc/operation-log.feature`（已在 Task 1.1 更名）

**broadcast.feature：**

- 所有 API scenarios → `@integration @happy_path / @permissions / @validation`
- 新增 E2E scenarios：

  ```gherkin
  @e2e @happy_path
  Scenario: 高級管理員發送廣播至所有聊天室並查看列表
    Given 管理員 "admin01" 已登入並在廣播頁面
    When 建立廣播訊息 "System maintenance" 至所有聊天室
    Then 廣播列表出現該訊息，狀態為 "active"

  @e2e @permissions
  Scenario: 一般管理員的 sidebar 不顯示廣播選項
    Given 管理員 "admin02"（general_manager）已登入
    Then sidebar 中無廣播選單項目
  ```

**operation-log.feature：**

- 所有 API scenarios → `@integration @happy_path / @validation / @permissions`
- 新增 E2E scenario：

  ```gherkin
  @e2e @happy_path
  Scenario: 管理員查看操作紀錄列表並依類型篩選
    Given 管理員 "admin01" 已登入
    When 在操作紀錄頁面篩選操作類型為 "DELETE_MESSAGE"
    Then 頁面只顯示 operation_type 為 "DELETE_MESSAGE" 的紀錄
  ```

- [x] 更新 `broadcast.feature`：補 tag + 加 @e2e scenarios
- [x] 更新 `operation-log.feature`：補 tag + 加 @e2e scenario
- [x] Commit: `docs: 補 broadcast/operation-log 測試層 tag 與 @e2e scenarios`

---

### Task 2.5：補測試層 tags — chatroom.feature、authentication.feature

**Files:** `00_doc/chatroom.feature`（已更名）、`00_doc/authentication.feature`

**chatroom.feature：**

- API scenarios → `@integration @happy_path / @validation / @permissions`
- 已有 `02-chatroom.spec.ts` 覆蓋的 scenarios → `@e2e @happy_path`

**authentication.feature：**

- Login/logout/password/admin API scenarios → `@integration @happy_path / @validation / @permissions`
- Login UI 完整流程（已有 `01-authentication.spec.ts`）→ `@e2e @happy_path`

- [x] 更新 `chatroom.feature`：補測試層 tag
- [x] 更新 `authentication.feature`：補測試層 tag
- [x] Commit: `docs: 補 chatroom/authentication 測試層 tag`

---

## Phase 3：新增 Feature 文件

### Task 3.1：建立 manager.feature

**Files:** `00_doc/manager.feature`

```gherkin
# 驗收規格來源：prd_00 §3.10 帳號管理

Feature: 管理員帳號管理（Admin Management）

  Background:
    Given 系統已有 senior_manager 帳號 "admin01"
    And 系統已有 general_manager 帳號 "admin02"（is_active=true）

  @e2e @happy_path
  Scenario: 高級管理員建立新管理員帳號
    Given 管理員 "admin01" 已登入
    When 在管理員頁面填入新帳號資訊並送出
    Then 管理員列表中出現新帳號

  @e2e @happy_path
  Scenario: 高級管理員禁用管理員帳號後無法登入
    Given 管理員 "admin01" 已登入
    When 禁用帳號 "admin02"
    And 嘗試以 "admin02" 登入
    Then 登入失敗，顯示帳號停用錯誤訊息

  @integration @happy_path
  Scenario: 查看管理員列表
    Given 管理員 "admin01" 已登入
    When 請求 GET /api/admins
    Then 回應 200，包含所有管理員帳號與角色資訊

  @integration @happy_path
  Scenario: 建立新管理員帳號
    Given 管理員 "admin01" 已登入
    When 送出 POST /api/admins，帶有效帳號資訊
    Then 回應 201
    And 操作紀錄包含 operationType 為 "CREATE_ADMIN"

  @integration @happy_path
  Scenario: 高級管理員啟用/禁用管理員
    Given 管理員 "admin01" 已登入
    When 送出 PATCH /api/admins/admin02/status，帶 is_active=false
    Then 回應 200
    And 操作紀錄包含 operationType 為 "TOGGLE_ADMIN_STATUS"

  @integration @happy_path
  Scenario: 高級管理員修改管理員角色
    Given 管理員 "admin01" 已登入
    When 送出 PATCH /api/admins/admin02/role，帶 role="senior_manager"
    Then 回應 200

  @integration @happy_path
  Scenario: 高級管理員重設他人密碼
    Given 管理員 "admin01" 已登入
    When 送出 PATCH /api/admins/admin02/password，帶 new_password
    Then 回應 200

  @integration @validation
  Scenario: 自我保護：無法禁用自己的帳號
    Given 管理員 "admin01" 已登入
    When 送出 PATCH /api/admins/admin01/status，帶 is_active=false
    Then 回應 409，錯誤碼 "ADMIN_SELF_MODIFICATION_FORBIDDEN"

  @integration @validation
  Scenario: 建立重複帳號名稱
    When 嘗試建立 username="admin01"（已存在）
    Then 回應 409，錯誤碼 "ADMIN_USERNAME_CONFLICT"

  @integration @permissions
  Scenario: 一般管理員無法存取管理員管理 API
    Given 管理員 "admin02" 已登入
    When 送出 POST /api/admins
    Then 回應 403，錯誤碼 "FORBIDDEN_INSUFFICIENT_PERMISSIONS"

  @integration @permissions
  Scenario: 未登入無法存取管理員管理 API
    When 未帶 Token 送出 GET /api/admins
    Then 回應 401，錯誤碼 "AUTH_MISSING_TOKEN"
```

- [x] 建立 `00_doc/manager.feature`
- [x] Commit: `docs: 新增 manager.feature 管理員帳號管理文件`

---

## Phase 4：Server Integration Tests 補齊

### Task 4.1：確認並補齊 resetNickname 測試

> nicknameReview 已在 commit bcb4e61 合併至 player module。

**Files:** `server/src/__tests__/` 下的 player module nickname 相關測試檔（先確認實際檔名）

- [x] 確認 player module 測試目錄下是否有對 `PUT /api/players/:username/nickname/reset` 的測試
- [x] 若缺少，在對應 test 檔補充：
  - Scenario: 重設暱稱 API 成功（對應 00_doc/chat-monitoring.feature）
    - 成功重設 → nickname = username, nickname_review_status = null
    - 操作紀錄包含 "RESET_NICKNAME"
  - Scenario: 重設不存在的玩家暱稱（對應 00_doc/chat-monitoring.feature）
    - 404 `PLAYER_NOT_FOUND`
  - Scenario: 未登入無法重設暱稱（對應 00_doc/chat-monitoring.feature）
    - 401
  - Scenario: 缺少 `player:reset_nickname` 權限 → 403
- [x] `npm run test --workspace=server` → PASS
- [x] Commit: `test(server): 補充 resetNickname 整合測試`

---

## Phase 5：Client Component Tests 補齊

### Task 5.1：更新 ChatMonitoringPage.test.tsx

**Files:** `client/src/__tests__/pages/ChatMonitoringPage.test.tsx`

需對應以下 `@component` scenarios：

- Scenario: 重設暱稱按鈕為可點擊狀態（對應 00_doc/chat-monitoring.feature）
  - 驗證 `data-testid="chat-monitor__reset-nickname-btn--{id}"` 為 enabled

- [x] 確認上述 scenario 已有 test；若缺少補充
- [x] `npm run test --workspace=client` → PASS
- [x] Commit: `test(client): 確認 ChatMonitoringPage 重設暱稱按鈕測試`

---

## Phase 6：E2E Tests 補齊（依 @e2e scenarios）

參考現有 `e2e/tests/03-chat-monitoring.spec.ts` 的結構與 helpers。

### Task 6.1：05-operation-log.spec.ts

**Files:** `e2e/tests/05-operation-log.spec.ts`

涵蓋 `00_doc/operation-log.feature` 的 `@e2e` scenarios：

```ts
// Scenario: 管理員查看操作紀錄列表並依類型篩選 (00_doc/operation-log.feature)
test.describe('操作紀錄模組', () => {
  test.beforeAll(resetDb);

  test('查看操作紀錄列表 → 每筆包含 operation_type、operator', async ({ page }) => {
    await loginAs(page, 'admin01');
    // navigate & waitForTable
  });

  test('依 DELETE_MESSAGE 篩選 → 只顯示對應紀錄', async ({ page }) => {
    // 先產生 log，再篩選驗證
  });
});
```

- [x] 建立 spec 檔
- [x] `npm run test:e2e` → PASS
- [x] Commit: `test(e2e): 新增操作紀錄 E2E 測試`

---

### Task 6.2：06-broadcast.spec.ts

**Files:** `e2e/tests/06-broadcast.spec.ts`

涵蓋 `00_doc/broadcast.feature` 的 `@e2e` scenarios：

```ts
// Scenario: 高級管理員發送廣播至所有聊天室並查看列表 (00_doc/broadcast.feature)
// Scenario: 一般管理員的 sidebar 不顯示廣播選項 (00_doc/broadcast.feature)
test.describe('廣播訊息模組', () => {
  test.beforeAll(resetDb);

  test('senior_manager 發送廣播 → 列表顯示 active 狀態', async ({ page }) => {
    await loginAs(page, 'admin01');
    // open broadcast modal, fill, submit, verify table
  });

  test('general_manager sidebar 無廣播選項', async ({ page }) => {
    await loginAs(page, 'admin02');
    // getByRole('menuitem', { name: /廣播/ }) → not visible
  });
});
```

> 注意：`@permissions` scenario 驗證 sidebar UI，使用 `getByRole('menuitem')` 而非直接打 API。

- [x] 建立 spec 檔
- [x] `npm run test:e2e` → PASS
- [x] Commit: `test(e2e): 新增廣播訊息 E2E 測試`

---

### Task 6.3：07-nickname-review.spec.ts

**Files:** `e2e/tests/07-nickname-review.spec.ts`

涵蓋 `00_doc/nickname-review.feature` 與 `00_doc/chat-monitoring.feature` 的 `@e2e` scenarios：

```ts
// Scenario: 管理員核准暱稱申請完整流程 (00_doc/nickname-review.feature)
// Scenario: 從聊天監控頁面重設玩家暱稱 (00_doc/chat-monitoring.feature)
test.describe('暱稱審核模組', () => {
  test.beforeAll(resetDb);

  test('查看待審核暱稱列表', async ({ page }) => { ... });
  test('核准暱稱申請 → 列表消失', async ({ page }) => { ... });
  test('駁回暱稱申請 → 暱稱重設為帳號名稱', async ({ page }) => { ... });
  test('從聊天監控頁重設暱稱 → 成功 toast', async ({ page }) => { ... });
});
```

- [x] 建立 spec 檔
- [x] `npm run test:e2e` → PASS
- [x] Commit: `test(e2e): 新增暱稱審核 E2E 測試`

---

### Task 6.4：08-report-review.spec.ts

**Files:** `e2e/tests/08-report-review.spec.ts`

涵蓋 `00_doc/report-review.feature` 的 `@e2e` scenarios：

```ts
// Scenario: 管理員核准檢舉，被檢舉玩家自動加入黑名單 (00_doc/report-review.feature)
test.describe('玩家檢舉審核模組', () => {
  test.beforeAll(resetDb);

  test('查看待審核檢舉列表', async ({ page }) => { ... });
  test('核准檢舉 → 被檢舉玩家出現在黑名單', async ({ page }) => { ... });
  test('駁回檢舉 → status 顯示 rejected', async ({ page }) => { ... });
});
```

- [x] 建立 spec 檔
- [x] `npm run test:e2e` → PASS
- [x] Commit: `test(e2e): 新增玩家檢舉審核 E2E 測試`

---

### Task 6.5：09-manager.spec.ts

**Files:** `e2e/tests/09-manager.spec.ts`

涵蓋 `00_doc/manager.feature` 的 `@e2e` scenarios：

```ts
// Scenario: 高級管理員建立新管理員帳號 (00_doc/manager.feature)
// Scenario: 高級管理員禁用管理員帳號後無法登入 (00_doc/manager.feature)
test.describe('管理員帳號管理模組', () => {
  test.beforeAll(resetDb);

  test('建立新管理員帳號 → 列表出現', async ({ page }) => { ... });
  test('禁用管理員 → 無法登入', async ({ page }) => { ... });
});
```

- [x] 建立 spec 檔
- [x] `npm run test:e2e` → PASS
- [x] Commit: `test(e2e): 新增管理員帳號管理 E2E 測試`

---

## Verification

```bash
npm run test --workspace=server    # server integration 全數通過
npm run test --workspace=client    # client component 全數通過
npm run test:e2e                   # E2E 全數通過（含 05~09）
npm run format                     # prettier format
```

**驗收條件：**

1. Feature 文件命名符合 rfc_09（chatroom / broadcast / operation-log / nickname-review / report-review / manager）
2. 所有 feature 文件每個 scenario 有測試層 tag（`@integration` / `@component` / `@e2e`）
3. `blacklist.feature` 無 `chatroom_id="*"`
4. `chat-monitoring.feature` 的重設暱稱 scenarios 為 enabled
5. Server integration tests 覆蓋 `PUT /api/players/:username/nickname/reset`
6. E2E spec 05~09 存在且通過
