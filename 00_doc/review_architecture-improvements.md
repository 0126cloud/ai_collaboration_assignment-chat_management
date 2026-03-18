# 架構審查：改善方向與行動方案

## 總覽

| 項目       | 說明                                          |
| ---------- | --------------------------------------------- |
| 審查日期   | 2026-03-19                                    |
| 整體評分   | **85 / 100**（扣分項即為以下改善方向）        |
| 優先級分類 | P0 安全 → P1 架構 → P2 工程實務 → P3 可選優化 |

> 每個改善項目包含：**現況**（目前的問題）、**方案**（具體做法）、**影響範圍**（需修改的檔案或模組）。

---

## P0 — 安全加固（-5 分）

安全問題應優先處理，即使是內部工具也不應忽略基本防護。

### 1. 缺少 Rate Limiting

**現況**：登入 API (`POST /api/auth/login`) 無任何頻率限制，攻擊者可無限次嘗試暴力破解密碼。

**方案**：

- 安裝 `express-rate-limit`
- 針對 `/api/auth/login` 設定限制（建議 5 次/分鐘/IP）
- 超過限制回傳 `429 Too Many Requests`
- 其他 API 可設較寬鬆的全域限制（例如 100 次/分鐘）

**影響範圍**：

- `server/src/app.ts`（全域 middleware 註冊）
- `server/src/module/auth/route.ts`（登入路由加裝更嚴格的 limiter）

---

### 2. 缺少 CSRF 防護

**現況**：使用 HttpOnly Cookie 傳遞 JWT，能防 XSS 竊取 token，但無法防止 CSRF 攻擊。惡意網站可利用使用者已登入的 cookie 發送偽造請求。

**方案**（二擇一）：

- **方案 A — Double Submit Cookie**（推薦）：Server 在登入時設定一個額外的 non-HttpOnly CSRF token cookie，client 在每個寫入請求的 header 中帶上這個 token，server 驗證 header 與 cookie 中的 token 是否一致
- **方案 B — SameSite Cookie 屬性**：將 JWT cookie 設為 `SameSite=Strict`，瀏覽器會阻止跨站請求帶上 cookie。最簡單但可能影響某些跨域場景

**影響範圍**：

- `server/src/module/auth/controller.ts`（cookie 設定加入 SameSite 或 CSRF token）
- `client/src/api/axios.ts`（如果用方案 A，interceptor 需帶 CSRF header）

---

### 3. 缺少帳號鎖定機制

**現況**：連續登入失敗無限制，無任何帳號鎖定或延遲機制。

**方案**：

- `admins` 表新增 `failed_attempts INTEGER DEFAULT 0` 和 `locked_until DATETIME` 欄位
- 每次登入失敗 `failed_attempts += 1`
- 達到閾值（例如 5 次）後設定 `locked_until = NOW + 15 分鐘`
- 登入成功時重置 `failed_attempts = 0`
- 鎖定期間回傳 `403 AUTH_ACCOUNT_LOCKED`

**影響範圍**：

- 新增 DB migration（`admins` 表加欄位）
- `server/src/module/auth/service.ts`（登入邏輯加入鎖定檢查）
- `shared/schemas/auth.ts`（新增 error code）
- `server/src/utils/errorCodes.ts`（新增 `AUTH_ACCOUNT_LOCKED`）

---

## P1 — 架構補強（-5 分）

這些改善能提升系統的完整性，但不影響目前功能的正確運作。

### 4. 缺少即時通訊機制

**現況**：聊天監控頁面只能透過 REST API 手動刷新查看最新訊息。Feature file 中有 `online_user_count` 欄位暗示需要某種即時性，但目前是靜態值。

**方案**：

- 加入 SSE（Server-Sent Events）推送機制
- 建立 `GET /api/chat_messages/stream` endpoint
- Client 使用 `EventSource` API 監聽新訊息
- SSE 比 WebSocket 輕量，適合這種「server → client 單向推送」場景
- 不需要額外的 WebSocket server 或 library

**影響範圍**：

- `server/src/module/chatMessage/route.ts`（新增 SSE endpoint）
- `server/src/module/chatMessage/service.ts`（新增推送邏輯）
- `client/src/pages/ChatMonitoringPage.tsx`（訂閱 SSE stream）
- `client/src/hooks/useChatStream.ts`（新增 custom hook）

---

### 5. 缺少 Cache 層

**現況**：每次 API 請求都直接查詢 SQLite，包括高頻讀取的黑名單查詢和權限驗證。雖然 SQLite 讀取效能不錯，但在多人同時操作時仍可能成為瓶頸。

**方案**：

- 使用 Node.js in-memory cache（`node-cache` 或簡單的 `Map`）
- 快取對象：
  - RBAC 權限設定（幾乎不變，可設較長 TTL）
  - 黑名單查詢結果（TTL 30 秒~1 分鐘）
- 寫入操作時主動清除相關快取（cache invalidation）
- **不建議**引入 Redis —— 對這個規模的專案是 over-engineering

**影響範圍**：

- `server/src/middleware/permission.ts`（權限查詢加快取）
- `server/src/module/blacklist/service.ts`（黑名單查詢加快取）
- 新增 `server/src/utils/cache.ts`（快取工具）

---

### 6. 前端 Error Boundary 策略不完整

**現況**：後端有完整的 `AppError` + global error handler，但前端缺乏系統性的錯誤處理。React render error 可能導致白屏，網路錯誤的使用者體驗不一致。

**方案**：

- 頂層加入 React `ErrorBoundary` component，捕獲 render error 顯示 fallback UI
- Axios response interceptor 統一處理：
  - `401` → 清除 auth state，導向登入頁
  - `403` → 顯示權限不足提示
  - `429` → 顯示「操作過於頻繁」提示
  - `500` → 顯示通用錯誤訊息
  - 網路斷線 → 顯示離線提示
- 使用 Antd `message` 或 `notification` 統一顯示錯誤

**影響範圍**：

- 新增 `client/src/components/ErrorBoundary.tsx`
- `client/src/api/axios.ts`（interceptor 增強）
- `client/src/App.tsx`（包裹 ErrorBoundary）

---

## P2 — 工程實務（-4 分）

這些是提升開發效率和程式碼品質的改善。

### 7. 缺少 CI/CD

**現況**：測試策略完整（三層測試 + 144 個 scenario），但沒有自動化執行機制。測試通過完全依賴開發者手動執行。

**方案**：

- 建立 GitHub Actions workflow：
  1. **lint**：`eslint` + `prettier --check`
  2. **test**：`vitest run`（unit + integration）
  3. **build**：`npm run build`（client + server）
  4. E2E test 可作為可選步驟（需要較長時間）
- 觸發條件：push to main / PR 建立時

**影響範圍**：

- 新增 `.github/workflows/ci.yml`
- `package.json`（確認 scripts 對應正確）

---

### 8. Unit Test 覆蓋率偏低

**現況**：只有 4 個 unit test（auth middleware、permission middleware、operation logger、permissions config）。Utility functions、Zod schema 邊界值、date helpers 等純邏輯函式未被覆蓋。

**方案**：

- 優先補齊以下 unit test：
  - `ResponseHelper`：驗證 envelope 格式
  - `AppError`：驗證 error code mapping
  - Zod shared schemas：邊界值測試（最短字串、最大數字、格式驗證）
  - `zodToAntdRules()`：轉換正確性
  - Date utility（UTC 轉換邏輯）
- 目標：middleware ≥ 90%、utility ≥ 85%

**影響範圍**：

- `server/src/__tests__/unit/`（新增測試檔案）
- `client/src/__tests__/`（新增 utility 測試）

---

### 9. 可重用 Component 偏少

**現況**：10 個頁面只有 2 個 reusable component（`ProtectedRoute`、`CreateBlacklistModal`）。多個頁面有相似的 UI pattern（確認 Modal、搜尋表單、狀態標籤）但各自實作。

**方案**：

- 從現有頁面中提取共用元件：
  - `ConfirmActionModal`：統一所有破壞性操作的確認 Modal
  - `SearchFilterForm`：統一 Table 上方的搜尋 / 篩選表單 layout
  - `StatusTag`：統一各種狀態標籤（pending / approved / rejected / active / expired）的顏色映射
- **注意**：只在確認有 3 個以上相同使用場景時才抽取，避免過早抽象

**影響範圍**：

- 新增 `client/src/components/` 下的共用元件
- 重構使用這些 pattern 的頁面

---

### 10. Client README 未更新

**現況**：`client/README.md` 還是 Vite 模板自動生成的原文，對新進開發者沒有參考價值。

**方案**：

- 更新為專案導向內容：
  - 專案簡介 + 技術棧
  - 開發環境啟動指令
  - 目錄結構說明
  - 環境變數配置
  - 相關文件連結（指向 `00_doc/`）

**影響範圍**：

- `client/README.md`

---

## P3 — 可選優化（-1 分）

以下項目對目前系統運作影響不大，可視需求排入未來迭代。

### 11. Broadcast Status Query-Time 計算效能

**現況**：broadcasts 的 status（scheduled / active / expired）每次查詢時根據 `start_at + duration` 計算，不儲存在 DB。RFC 中有承認這個 trade-off。

**方案**（可暫緩）：

- 目前規模下不是問題（broadcast 數量不會太多）
- 若未來資料量增長，可考慮加 `status` column + 定時任務更新
- 或在 Service 層加 in-memory cache（與改善項目 5 結合）

**影響範圍**：`server/src/module/broadcast/service.ts`

---

### 12. SQLite Index 策略

**現況**：除了 UNIQUE constraint 自動建立的 index 外，沒有為高頻查詢欄位額外建立 index。

**方案**（可暫緩）：

- 建議為以下欄位建立 index：
  - `chat_messages.chatroom_id`（聊天監控的主要查詢條件）
  - `chat_messages.created_at`（排序欄位）
  - `blacklist.target`（模糊搜尋欄位）
  - `operation_logs.created_at`（排序 + 日期範圍查詢）
  - `reports.status`（篩選條件）
- 透過 Knex migration 新增

**影響範圍**：新增 DB migration

---

### 13. JWT Refresh Token 機制

**現況**：JWT 設定 4 小時過期，過期後使用者必須重新登入。沒有 refresh token 機制。

**方案**（可暫緩）：

- 對內部管理後台來說，4 小時 session 通常足夠
- 若使用者反映頻繁被登出：
  - 加入 refresh token rotation（refresh token 存 HttpOnly cookie，有效期 7 天）
  - Access token 縮短為 15 分鐘
  - Axios interceptor 在 401 時自動用 refresh token 取得新 access token
- **注意**：這是 auth module 全面改動，影響範圍大

**影響範圍**：auth module 全面（route、controller、service、middleware、client interceptor）
