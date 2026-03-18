# 架構審查：優點與亮點

## 總覽

| 項目     | 說明                                             |
| -------- | ------------------------------------------------ |
| 審查日期 | 2026-03-19                                       |
| 整體評分 | **85 / 100**                                     |
| 審查範圍 | 10 份 RFC + 9 份 Feature File + PRD + 實際程式碼 |
| 專案定位 | 聊天管理後台（內部工具，< 50 人使用）            |
| 評分基準 | 同類中小型管理後台專案，非大規模分散式系統       |

---

## 1. 文件治理（9/10）

這是整個專案最突出的特質。多數同類專案不會有這種文件紀律。

### RFC ↔ Feature File ↔ 實作程式碼 一致性極高

- 10 份 RFC 文件涵蓋所有主要架構決策，每份都包含**設計選項比較**和**選擇理由**
- 9 份 Gherkin Feature File 定義驗收條件，scenario tag（`@integration`、`@e2e`、`@component`）直接對應測試層級
- 實際程式碼幾乎 1:1 對應 RFC 設計：RFC 裡寫的 pattern，code 裡就是那樣實作

### 文件可追溯性

- `prd_00` → 產品需求 → `rfc_XX` → 技術設計 → `*.feature` → 驗收條件 → `*.spec.ts` / `*.test.ts` → 測試實作
- `schema_reference.md` 完整記錄所有 table 的欄位、型別、約束、設計理由
- `CLAUDE.md` 的 Document Routing 表讓任何人都能快速找到對應文件

---

## 2. 架構一致性（9/10）

9 個後端模組全部遵循相同的分層模式，沒有例外。

### Route → Controller → Service 三層分離

```
server/src/module/{moduleName}/
├── route.ts        # 路由定義 + middleware 串接
├── controller.ts   # Request 處理、參數提取
└── service.ts      # 業務邏輯、DB 查詢
```

所有模組（auth、admin、chatroom、chatMessage、blacklist、player、report、broadcast、operationLog）一致遵循此結構。

### 工廠注入模式

```typescript
// 每個模組統一使用 createXxxRoutes(db: Knex) 工廠函式
export function createAuthRoutes(db: Knex): Router { ... }
```

- 顯式傳遞 DB 依賴，不使用全域單例
- Integration test 可直接傳入 `:memory:` SQLite 實例
- 未來若需替換 DB，只需改注入點

### Afterware Operation Logger

- 使用 `res.on('finish')` 監聽 response 完成事件，在 response 已送出後才寫入 log
- Controller 只需設定 `res.locals.operationLog = { operationType: 'X' }`
- **優勢**：log 失敗不影響 client response；集中在一個 middleware 管理，不分散在各 service

### Unified Response Envelope

所有 API 回應遵循統一格式：

```json
{ "success": true, "data": {...}, "pagination": {...} }
{ "success": false, "error": { "code": "ERROR_CODE", "message": "..." } }
```

搭配 `AppError` class + `ErrorCode` enum + `ERROR_MESSAGES` config，錯誤處理完全標準化。

---

## 3. Shared Layer 設計

前後端共享驗證邏輯，是這個專案避免 contract drift 的關鍵設計。

### Zod Schema 一處定義、三處使用

1. **後端 API 驗證**：`validate(schema)` middleware 驗證 `req.body`
2. **前端 Form 驗證**：`zodToAntdRules(schema)` 將 Zod schema 轉為 Antd Form rules
3. **TypeScript 型別推導**：`z.infer<typeof schema>` 自動產生型別，不需手動維護 interface

### 統一引用路徑

- `@shared/*` path alias 在 client（Vite）和 server（tsc）兩端設定
- 9 份 shared schema 對應 9 個 API 模組，命名一致

---

## 4. 資料庫設計決策

每個設計決策都有明確的業務理由，不是無腦套用同一模式。

### 三種刪除策略

| 策略                       | 使用場景                                      | 理由                                           |
| -------------------------- | --------------------------------------------- | ---------------------------------------------- |
| `deleted_at` (Soft Delete) | chatrooms, players, chat_messages, broadcasts | 需保留歷史紀錄，但 UI 不顯示                   |
| `is_blocked` Boolean       | blacklist                                     | 封鎖紀錄本身有稽核意義，解封後仍應保留完整紀錄 |
| 不可刪除                   | reports, operation_logs                       | 不可變稽核紀錄，任何情況下都不應被修改或刪除   |

### Magic Value `'all'` 解決 SQLite UNIQUE + NULL 問題

- `blacklist.chatroom_id` 和 `broadcasts.chatroom_id` 用字串 `'all'` 代表「所有聊天室」
- 原因：SQLite 的 UNIQUE constraint 對 NULL 不生效（每個 NULL 都被視為不同值），用 `'all'` 確保 UNIQUE 約束正常運作

### Snapshot vs JOIN 的正確使用

| 欄位              | 策略     | 理由                                           |
| ----------------- | -------- | ---------------------------------------------- |
| `operator`        | Snapshot | 操作紀錄凍結當時的操作者名稱，不隨後續改名變動 |
| `chat_message`    | Snapshot | 檢舉紀錄凍結當時的訊息內容，原始訊息可能被刪除 |
| `player_nickname` | JOIN     | 聊天訊息列表應顯示即時暱稱，不是歷史快照       |

### 時間處理

- **DB 儲存**：UTC+0（`CURRENT_TIMESTAMP`）
- **API 回應**：原始 UTC 字串（ISO 8601）
- **前端顯示**：`dayjs.utc().tz('Asia/Taipei')` 轉為 UTC+8
- 職責分明，不會在任何一層做重複轉換

---

## 5. 安全設計（8/10）

### HttpOnly Cookie

- JWT token 存放在 HttpOnly Cookie，JavaScript 無法存取，有效防禦 XSS token 竊取
- 同時保留 `Authorization: Bearer` header fallback（供 Postman 等工具使用）
- Axios 設定 `withCredentials: true` 自動帶送 cookie

### 敏感資料保護

- 密碼欄位（`password`、`newPassword`、`oldPassword`、`password_hash`）在 operation log 中一律遮罩為 `***`
- 密碼使用 bcryptjs hash 儲存，不存明文

### Config-based RBAC

- 22 項權限分 6 大類（auth / chat / blacklist / admin / broadcast / nickname）
- 兩種角色：general_manager（16 項）、senior_manager（22 項全部）
- `requirePermission()` middleware 在 route 層級強制執行

### Self-modification Prevention

- 管理員不能停用自己的帳號
- 管理員不能修改自己的角色
- 管理員不能重設自己的密碼（透過管理員重設功能）
- 避免系統管理員意外鎖死自己

---

## 6. 測試策略（8/10）

### 三層測試架構

| 層級        | 工具       | 環境          | 覆蓋範圍                   |
| ----------- | ---------- | ------------- | -------------------------- |
| Unit        | Vitest     | Node          | Middleware、helper、純邏輯 |
| Integration | Vitest     | Node + SQLite | API 路由、DB 操作、權限    |
| E2E         | Playwright | 真實瀏覽器    | 跨頁面使用者流程           |

### `:memory:` SQLite 與 production 同引擎

- Integration test 使用 SQLite `:memory:` 模式
- 與 production 使用相同的 SQLite 引擎，不會出現 mock DB 與實際 DB 行為不一致的問題
- 每個測試檔案獨立建立 DB 實例，狀態完全隔離

### Demo Video 自動生成

- E2E 測試開啟 Playwright video recording
- 測試完成後自動將 `.webm` 轉為 MP4 + SRT 字幕（測試名稱作為字幕）
- `npm run demo` 一鍵合成最終展示影片
- 這在一般專案中非常少見

### 測試可靠性

- `single-worker` 模式避免平行測試的狀態衝突
- `retries: 0` 確保測試失敗就是真的失敗，不會被 retry 掩蓋
- `resetDb()` 在每個 describe block 前重置資料庫狀態

---

## 7. 前端工程規範

### createStyles 統一樣式管理

- 全面禁用 inline style object
- 統一使用 `createStyles` from `antd-style`
- 有 token 時：`createStyles(({ token }) => ({...}))`
- 純佈局時：`createStyles(() => ({...}))`
- 確保所有顏色、間距都來自 Design Token，不出現 hardcoded 值

### iOS-inspired Design Token 體系

- Seed Token：Primary blue `#1A6FD4`，語意色彩對應 iOS 調色盤
- Global Token：圓角 `10px`（大）/ `8px`（小），字重 `fontWeightStrong: 600`
- Component Token：iOS 風格 shadow 套用在 Card / Modal

### Dark Mode 支援

- 三態切換：Light / Dark / System（跟隨系統設定）
- `ThemeContext` + `useTheme` hook 管理主題狀態
- Antd `defaultAlgorithm` / `darkAlgorithm` 切換，minimal dark overrides
- `localStorage` 持久化使用者偏好

### UX 防呆設計

- 所有表單 block Enter key 提交（防止意外送出）
- 所有破壞性操作（新增 / 刪除 / 修改）require Modal 確認
- 搜尋只在按下按鈕時觸發（不自動搜尋）
- Table 搜尋欄 maxWidth: 300px 維持版面整齊
