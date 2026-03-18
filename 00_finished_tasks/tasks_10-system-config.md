# Phase 10：系統環境變數配置管理

## 背景

- RFC：[rfc_10-system-config.md](rfc_10-system-config.md)
- PRD 相關需求：[prd_00](prd_00-chat_management_backstage.md) NFR — 系統配置項目

`server/.env` 中的 `ENCODING` 與 `MAX_CHATTING_RECORD_NUM` 目前只存在設定檔，但程式碼從未實際讀取或套用。本 Phase 補齊這兩個配置的實作，並建立 `.env.example` 作為環境變數的說明文件。

## 前置條件

- Phase 9 已完成（✅）
- `server/.env` 存在且包含：`SERVER_ADDRESS`, `SERVER_PORT`, `ENCODING`, `MAX_CHATTING_RECORD_NUM`, `JWT_SECRET`

---

## Task 10.1：建立 `.env.example`

**目標**：讓接手人員能一眼看到系統所有環境變數需求。

**變動檔案**：

- 新增 `server/.env.example`
- 修改 `server/.env`（補上 `CORS_ORIGIN`）

**說明**：

1. 新增 `server/.env.example`，包含所有 7 個環境變數的說明與範例值（格式見 RFC 4.4）
2. `server/.env` 補上目前缺少的 `CORS_ORIGIN=http://localhost:5173`

### 驗證方式

```bash
# .env.example 的 key 應與程式碼中所有 process.env.* 對應
grep -r 'process\.env\.' server/src --include='*.ts' | grep -oP '(?<=process\.env\.)\w+' | sort -u
```

對照 `.env.example` 的 key，確認無遺漏。

---

## Task 10.2：實作 ENCODING — HTTP response charset

**目標**：HTTP JSON response 的 `Content-Type` header 帶有 `charset` 設定。

**變動檔案**：

- `server/src/app.ts`

**說明**：

在 `express.json()` middleware 之後加入 encoding middleware（RFC 4.2 設計）。覆寫 `res.json` 確保只有 JSON response 套用 charset。

```ts
// 加入位置：express.json() 之後、CORS 之後、路由掛載之前
const encoding = process.env.ENCODING ?? 'utf-8';
app.use((_req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    res.setHeader('Content-Type', `application/json; charset=${encoding}`);
    return originalJson(body);
  };
  next();
});
```

### 驗證方式

```bash
# 啟動 server 後執行（需 server 運行中）
curl -I http://localhost:3000/api/health
# 預期：Content-Type: application/json; charset=utf-8
```

---

## Task 10.3：實作 MAX_CHATTING_RECORD_NUM — pageSize 驗證與查詢上限

**目標**：

1. `pageSize` 超過 `MAX_CHATTING_RECORD_NUM` 時，API 回傳 `400`
2. Service 層加入防禦性上限，避免大量資料洩漏

**變動檔案**：

- `server/src/module/chatMessage/controller.ts`
- `server/src/module/chatMessage/service.ts`

**說明**：

**controller.ts**：在 Zod 解析後、呼叫 service 前加入驗證：

```ts
const maxPageSize = Number(process.env.MAX_CHATTING_RECORD_NUM ?? 200);
if (parsed.pageSize > maxPageSize) {
  return res.status(400).json({
    error: `pageSize cannot exceed ${maxPageSize}`,
  });
}
```

**service.ts** 的 `list()` 方法：

```ts
const maxRecords = Number(process.env.MAX_CHATTING_RECORD_NUM ?? 200);
const effectivePageSize = Math.min(query.pageSize, maxRecords);
// 後續 .limit() 改用 effectivePageSize
```

### 驗證方式

```bash
# 1. pageSize 超過上限應回傳 400
curl "http://localhost:3000/api/chat_messages?page=1&pageSize=999" \
  -H "Authorization: Bearer <token>"
# 預期：400 { "error": "pageSize cannot exceed 200" }

# 2. 設小上限後查詢，回傳筆數應 ≤ 上限
# 修改 .env: MAX_CHATTING_RECORD_NUM=5，重啟 server
curl "http://localhost:3000/api/chat_messages?page=1&pageSize=50" \
  -H "Authorization: Bearer <token>"
# 預期：data 陣列長度 ≤ 5
```

---

## Task 10.4：更新文件 + prettier format

**目標**：文件路由更新，改動檔案符合 Prettier 格式。

**變動檔案**：

- `CLAUDE.md`（Document Routing 新增 rfc_10 指向）
- prettier format：`server/src/app.ts`、`server/src/module/chatMessage/controller.ts`、`server/src/module/chatMessage/service.ts`

**說明**：

1. 更新 `CLAUDE.md` 的 Document Routing 表格：

   ```
   | 環境變數配置設計 | `00_doc/rfc_10-system-config.md` |
   ```

2. 對所有改動檔案執行 prettier format：

   ```bash
   npx prettier --write \
     server/src/app.ts \
     server/src/module/chatMessage/controller.ts \
     server/src/module/chatMessage/service.ts \
     server/.env.example
   ```

### 驗證方式

```bash
npm test   # 全部測試通過
npm run lint  # 無 lint 錯誤
```

---

## 執行順序

```
10.1 (env.example) → 10.2 (ENCODING) → 10.3 (MAX_CHATTING_RECORD_NUM) → 10.4 (文件 + format)
```

每個 Task 完成後各自 commit，commit message 以繁體中文撰寫。

---

## 完成檢查清單

- [ ] `server/.env.example` 已建立，key 集合與程式碼 `process.env.*` 完全對應
- [ ] `server/.env` 補上 `CORS_ORIGIN`
- [ ] `curl -I http://localhost:3000/api/health` → `Content-Type: application/json; charset=utf-8`
- [ ] `GET /api/chat_messages?pageSize=999` → `400 { error: 'pageSize cannot exceed 200' }`
- [ ] 設 `MAX_CHATTING_RECORD_NUM=5` 後，API 回傳筆數 ≤ 5
- [ ] `npm test` 全部通過
- [ ] `CLAUDE.md` Document Routing 已更新
- [ ] 所有改動檔案已 prettier format
