# Phase 9: UX 優化與功能補齊

## 背景

Phase 8 完成 E2E 測試後，本 Phase 修正跨頁面 UX 一致性問題，並補完兩個原本 placeholder 的功能：進階管理員重設密碼、Chat Monitoring 重置暱稱。

技術設計異動詳見：

- [prd_00](prd_00-chat_management_backstage.md) — UX 行為規範章節
- [rfc_01](rfc_01-auth-and-response.md) — admin 密碼重設 API、player:reset_nickname 權限
- [rfc_03](rfc_03-chatroom-and-chat.md) — 玩家暱稱重設 API

## 完成狀態

**Phase 9 已完成。** 所有 tasks 均已實作並通過測試。

## 已完成項目

### Task 9.0: 文件更新

- `prd_00`: 新增 UX 行為規範章節、更新功能描述
- `rfc_01`: 新增 `player:reset_nickname` 權限、`PUT /api/admins/:id/password` API spec、更新路由對照表
- `rfc_03`: 新增 `PUT /api/players/:username/nickname/reset` API spec

### Task 9.1: HTML title & root 重導

- `client/index.html`: title 改為「聊天管理後台」
- `client/src/router.tsx`: 新增 index route → Navigate to `/chat`

### Task 9.2: 共用型別/Schema

- `shared/types/operationLog.ts`: 新增 `RESET_NICKNAME` operation type
- `shared/schemas/admin.ts`: 新增 `resetAdminPasswordSchema`
- `shared/types/admin.ts`: 新增 `TResetAdminPasswordPayload`
- `shared/index.ts`: 更新 exports

### Task 9.3: 後端 permissions

- `server/src/config/permissions.ts`: general_manager 新增 `player:reset_nickname`
- 相關測試同步更新（unit + integration）

### Task 9.4: 後端 Admin 密碼重設 API

- `server/src/module/admin/service.ts`: 新增 `resetPassword` method
- `server/src/module/admin/controller.ts`: 新增 `resetPassword` handler
- `server/src/module/admin/route.ts`: 新增 `PUT /:id/password`

### Task 9.5: 後端 Player Module

- 新建 `server/src/module/player/service.ts`
- 新建 `server/src/module/player/controller.ts`
- 新建 `server/src/module/player/route.ts`
- `server/src/app.ts`: 注冊 `/api/players` routes

### Task 9.6: 前端 API client

- `client/src/api/admin.ts`: 新增 `resetPassword`
- 新建 `client/src/api/player.ts`: `playerApi.resetNickname`

### Task 9.7: ManagerPage 重設密碼 UI

- Enter disable on all forms
- 新增管理員前 Modal.confirm
- 角色變更前 Modal.confirm
- 新增重設密碼 Modal 及相關 state/handler
- `Select` inline style 改用 `createStyles.roleSelect`

### Task 9.8: ChatMonitoringPage 重置暱稱

- 移除 Tooltip disabled 包裝，啟用「重設暱稱」按鈕
- 新增 `handleResetNickname` 含 Modal.confirm
- Input maxWidth 改用 `filterInput` class

### Task 9.9: BroadcastPage 改為 Modal 模式

- 移除 inline Card form，改為按鈕 → Modal 模式
- 新增 `新增廣播` 按鈕於廣播列表 Card extra
- Form 加 Enter disable + Modal.confirm
- `width: '100%'` inline style 改用 `formControl` class
- `marginBottom: 16` inline style 移除，改用 `filterRow.marginBottom: token.marginMD`

### Task 9.10: 統一 UX

- `CreateBlacklistModal`: Form Enter disable + handleSubmit 改為先 Modal.confirm
- `LoginPage`: Form Enter disable
- Input maxWidth 300 (createStyles filterInput)：ChatroomPage、BlacklistPage、OperationLogPage、NicknameReviewPage、ReportReviewPage
- `OperationLogPage`: `<pre>` inline style 改用 `preContent` class，`columns` 移至 component 內

### Task 9.11: 測試更新 & Prettier

- 更新 ChatMonitoringPage 測試：重設暱稱按鈕由 disabled → enabled
- 更新 CreateBlacklistModal 測試：新增點擊確認對話框步驟
- 更新 BroadcastPage 測試：先開啟 Modal 再測試 form validation
- 所有修改檔案執行 prettier format
