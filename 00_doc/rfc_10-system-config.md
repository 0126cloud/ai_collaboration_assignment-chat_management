# RFC: 系統環境變數配置管理

## 1. 背景

Assignment 第 4 節「System Configuration」要求系統支援 4 個可配置項目：`serverAddress`、`serverPort`、`encoding`、`maxChattingRecordNum`。

目前 `server/.env` 中已定義這 4 個變數，但：

- `ENCODING` — 設定存在，但 Express 未實際套用至 HTTP response `Content-Type` charset
- `MAX_CHATTING_RECORD_NUM` — 設定存在，但查詢筆數沒有使用此值作為上限，API 也未驗證 `pageSize` 不超過此限
- `CORS_ORIGIN` — 程式碼中有讀取（`app.ts`），但未加入 `.env`
- `.env.example` — 不存在，接手人員無法得知系統需要哪些環境變數

---

## 2. 目標

- 使 4 個 Assignment 要求的配置項目全部生效
- 補齊 `CORS_ORIGIN` 至 `.env` 與文件
- 建立 `.env.example` 作為環境變數的標準說明文件

---

## 3. 提案

不另建集中配置模組，沿用現有 `process.env` 直讀模式，在對應位置加入讀取邏輯（符合現有 `server.ts`、`app.ts` 的風格）。

---

## 4. 詳細設計

### 4.1 完整環境變數清單

| 變數名稱                  | 型別   | 預設值                  | 必填 | 說明                                 |
| ------------------------- | ------ | ----------------------- | ---- | ------------------------------------ |
| `SERVER_ADDRESS`          | string | `localhost`             | ✅   | 伺服器監聽位址                       |
| `SERVER_PORT`             | number | `3000`                  | ✅   | 伺服器監聽 Port                      |
| `ENCODING`                | string | `utf-8`                 | ✅   | HTTP response `Content-Type` charset |
| `MAX_CHATTING_RECORD_NUM` | number | `200`                   | ✅   | 聊天記錄 API 單次查詢上限            |
| `JWT_SECRET`              | string | （無預設，必填）        | ✅   | JWT 簽發與驗證金鑰                   |
| `CORS_ORIGIN`             | string | `http://localhost:5173` | ✅   | Express CORS 允許的 origin           |
| `NODE_ENV`                | string | `development`           | —    | 執行環境（影響 Cookie secure flag）  |
| `DB_FILENAME`             | string | `./db/dev.sqlite`       | —    | SQLite 資料庫檔案路徑（詳見 RFC 11） |

### 4.2 ENCODING — HTTP response charset

在 `server/src/app.ts` 於 `express.json()` 之後加入全域 middleware，為所有回應覆寫 `Content-Type` charset：

```ts
app.use((_req, res, next) => {
  const encoding = process.env.ENCODING ?? 'utf-8';
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    res.setHeader('Content-Type', `application/json; charset=${encoding}`);
    return originalJson(body);
  };
  next();
});
```

> 採用覆寫 `res.json` 而非設定全域 header，確保只有 JSON 回應才加 charset，不影響 health check 等純文字 endpoint。

### 4.3 MAX_CHATTING_RECORD_NUM — 查詢上限與 pageSize 驗證

**套用位置：** `server/src/module/chatMessage/controller.ts`

**兩層保護：**

1. **API 層驗證（400 拒絕）**：收到 `pageSize` 大於 `MAX_CHATTING_RECORD_NUM` 時，回傳 `400 Bad Request`：

   ```ts
   const maxPageSize = Number(process.env.MAX_CHATTING_RECORD_NUM ?? 200);
   if (parsed.pageSize > maxPageSize) {
     return res.status(400).json({
       error: `pageSize cannot exceed ${maxPageSize}`,
     });
   }
   ```

2. **Service 層硬上限（防禦性）**：`chatMessage/service.ts` 的 `list()` 中加入：

   ```ts
   const maxRecords = Number(process.env.MAX_CHATTING_RECORD_NUM ?? 200);
   const effectivePageSize = Math.min(query.pageSize, maxRecords);
   ```

   使用 `effectivePageSize` 取代原本的 `query.pageSize` 作為 `.limit()` 參數。

### 4.4 .env.example 格式

新增 `server/.env.example`，列出所有環境變數、說明與範例值：

```dotenv
# 伺服器配置
SERVER_ADDRESS=localhost
SERVER_PORT=3000

# HTTP 編碼
ENCODING=utf-8

# 聊天記錄查詢上限（最大 pageSize 不可超過此值）
MAX_CHATTING_RECORD_NUM=200

# JWT 金鑰（正式環境須設為強密鑰，不可使用 dev-secret-key）
JWT_SECRET=dev-secret-key

# CORS 允許的前端 origin
CORS_ORIGIN=http://localhost:5173

# 執行環境（影響 Cookie secure flag）
NODE_ENV=development

# SQLite 資料庫檔案路徑（預設為 ./db/dev.sqlite）
# DB_FILENAME=./db/dev.sqlite
```

### 4.5 分環境 .env 檔案架構

> 此節為 RFC 11（Production Mode）引入的延伸設計，記錄於此以保持環境變數管理文件的完整性。

原本使用單一 `server/.env` 管理所有環境變數，改為依環境區分多檔案：

| 檔案                      | 用途             | Git 追蹤 |
| ------------------------- | ---------------- | -------- |
| `server/.env.example`     | 範本與說明文件   | ✅       |
| `server/.env.development` | 開發環境配置     | ❌       |
| `server/.env.production`  | 正式環境配置     | ❌       |

**dotenv 載入邏輯**：`dotenv.config()` 改為依 `NODE_ENV` 載入對應檔案（`NODE_ENV` 由 shell 環境或 Docker ENV 提供）。

詳細設計與實作見 [rfc_11-production-mode.md](rfc_11-production-mode.md) §4.1。

---

## 5. 影響範圍

| 檔案                                          | 變動類型 | 說明                                             |
| --------------------------------------------- | -------- | ------------------------------------------------ |
| `server/.env.example`                         | 新增     | 環境變數說明文件                                 |
| `server/.env`                                 | 修改     | 補上 `CORS_ORIGIN`                               |
| `server/src/app.ts`                           | 修改     | 加入 encoding middleware                         |
| `server/src/module/chatMessage/controller.ts` | 修改     | 加入 `pageSize > MAX_CHATTING_RECORD_NUM` 的驗證 |
| `server/src/module/chatMessage/service.ts`    | 修改     | 加入 `effectivePageSize` 防禦性上限              |

---

## 6. 完成標準

- [ ] `curl -v http://localhost:3000/api/health` 的 `Content-Type` header 含 `charset=utf-8`
- [ ] `GET /api/chat_messages?pageSize=999` 回傳 `400 { error: 'pageSize cannot exceed 200' }`
- [ ] 設 `MAX_CHATTING_RECORD_NUM=5` 後，chat API 實際回傳筆數 ≤ 5
- [ ] `server/.env.example` key 集合與程式碼中所有 `process.env.*` 讀取的 key 完全對應
- [ ] `npm test` 全部通過
