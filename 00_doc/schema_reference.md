# DB Schema 參考文件

> **本文件為快速查閱用途，列出所有資料表的當前完整欄位結構。**
> 以 migration 檔案為最終準，各欄位標注所屬 RFC 與 migration 來源。
> 詳細設計說明請見各對應 RFC。

---

## admins

**RFC**: [rfc_01](rfc_01-auth-and-response.md) | **Migration**: `20260317000000_create_admins.ts`

| 欄位          | 型別         | 約束                  | 說明                                      |
| ------------- | ------------ | --------------------- | ----------------------------------------- |
| id            | INTEGER      | PRIMARY KEY AUTO      |                                           |
| username      | VARCHAR(50)  | NOT NULL, UNIQUE      | 管理員帳號                                |
| password_hash | VARCHAR(255) | NOT NULL              | bcrypt 雜湊密碼                           |
| role          | VARCHAR(20)  | NOT NULL              | `'general_manager'` \| `'senior_manager'` |
| is_active     | BOOLEAN      | NOT NULL DEFAULT true |                                           |
| created_by    | INTEGER      | nullable              | 建立者的 admins.id（第一位管理員為 null） |
| created_at    | DATETIME     | DEFAULT now()         |                                           |
| updated_at    | DATETIME     | DEFAULT now()         |                                           |

---

## operation_logs

**RFC**: [rfc_02](rfc_02-operation-logs.md) | **Migration**: `20260317000001_create_operation_logs.ts`

| 欄位           | 型別        | 約束             | 說明                                                           |
| -------------- | ----------- | ---------------- | -------------------------------------------------------------- |
| id             | INTEGER     | PRIMARY KEY AUTO |                                                                |
| operation_type | VARCHAR(50) | NOT NULL         | 操作類型（見下方枚舉）                                         |
| operator_id    | INTEGER     | NOT NULL         | 操作者的 admins.id                                             |
| operator       | VARCHAR(50) | NOT NULL         | 操作者帳號（快照，方便查詢顯示）                               |
| request        | TEXT        | NOT NULL         | JSON 字串：`{ url, method, payload }`（密碼欄位以 `***` 遮蔽） |
| created_at     | DATETIME    | DEFAULT now()    |                                                                |

**索引**: `operation_type`、`operator_id`、`created_at`

**operation_type 枚舉**（定義於 `shared/types/operationLog.ts`）：

| 值                  | 說明            | 模組      |
| ------------------- | --------------- | --------- |
| `CREATE_ADMIN`      | 新增管理員帳號  | admin     |
| `TOGGLE_ADMIN`      | 啟用/禁用管理員 | admin     |
| `UPDATE_ADMIN_ROLE` | 更新管理員角色  | admin     |
| `RESET_PASSWORD`    | 重設管理員密碼  | admin     |
| `CHANGE_PASSWORD`   | 修改自己密碼    | auth      |
| `LOGIN`             | 管理員登入      | auth      |
| `LOGOUT`            | 管理員登出      | auth      |
| `DELETE_MESSAGE`    | 刪除聊天訊息    | chat      |
| `BLOCK_PLAYER`      | 封鎖玩家        | blacklist |
| `UNBLOCK_PLAYER`    | 解封玩家        | blacklist |
| `BLOCK_IP`          | 封鎖 IP         | ip_block  |
| `UNBLOCK_IP`        | 解封 IP         | ip_block  |
| `APPROVE_REPORT`    | 核准玩家檢舉    | report    |
| `REJECT_REPORT`     | 駁回玩家檢舉    | report    |
| `APPROVE_NICKNAME`  | 核准暱稱變更    | nickname  |
| `REJECT_NICKNAME`   | 駁回暱稱變更    | nickname  |
| `RESET_NICKNAME`    | 重設玩家暱稱    | player    |
| `CREATE_BROADCAST`  | 發送廣播訊息    | broadcast |
| `DELETE_BROADCAST`  | 下架廣播訊息    | broadcast |

---

## chatrooms

**RFC**: [rfc_03](rfc_03-chatroom-and-chat.md) | **Migration**: `20260317000002_create_chatrooms.ts`

| 欄位              | 型別         | 約束               | 說明                         |
| ----------------- | ------------ | ------------------ | ---------------------------- |
| id                | VARCHAR(50)  | PRIMARY KEY        | 業務 ID（如 `baccarat_001`） |
| name              | VARCHAR(100) | NOT NULL           | 聊天室名稱                   |
| online_user_count | INTEGER      | NOT NULL DEFAULT 0 | 線上人數（Mock 靜態值）      |
| created_at        | DATETIME     | DEFAULT now()      |                              |
| updated_at        | DATETIME     | DEFAULT now()      |                              |
| deleted_at        | DATETIME     | nullable           | 軟刪除標記                   |

**索引**: `name`

---

## players

**RFC**: [rfc_03](rfc_03-chatroom-and-chat.md) + [rfc_05](rfc_05-nickname-and-report.md)
**Migration**: `20260317000003_create_players.ts` + `20260317000008`（加 `nickname_apply_at`）+ `20260318000010`（加審核欄位）

| 欄位                   | 型別        | 約束          | 說明                                                |
| ---------------------- | ----------- | ------------- | --------------------------------------------------- |
| username               | VARCHAR(50) | PRIMARY KEY   | 玩家帳號                                            |
| nickname               | VARCHAR(50) | NOT NULL      | 目前暱稱                                            |
| nickname_apply_at      | DATETIME    | nullable      | 最後一次申請改暱稱的時間（歷史記錄，審核後不清除）  |
| nickname_review_status | VARCHAR(20) | nullable      | `'pending'` \| `'approved'` \| `'rejected'` \| null |
| nickname_reviewed_by   | VARCHAR(50) | nullable      | 審核管理員帳號                                      |
| nickname_reviewed_at   | DATETIME    | nullable      | 審核時間                                            |
| created_at             | DATETIME    | DEFAULT now() |                                                     |
| updated_at             | DATETIME    | DEFAULT now() |                                                     |
| deleted_at             | DATETIME    | nullable      | 軟刪除標記                                          |

> **判斷是否有待審請求**：以 `nickname_review_status = 'pending'` 為準，`nickname_apply_at IS NOT NULL` 僅代表歷史上曾申請過。

---

## chatroom_players

**RFC**: [rfc_03](rfc_03-chatroom-and-chat.md) | **Migration**: `20260317000004_create_chatroom_players.ts`

| 欄位            | 型別        | 約束             | 說明                  |
| --------------- | ----------- | ---------------- | --------------------- |
| id              | INTEGER     | PRIMARY KEY AUTO |                       |
| chatroom_id     | VARCHAR(50) | NOT NULL         | FK → chatrooms.id     |
| player_username | VARCHAR(50) | NOT NULL         | FK → players.username |
| created_at      | DATETIME    | DEFAULT now()    |                       |
| deleted_at      | DATETIME    | nullable         | 軟刪除標記            |

**索引**: `chatroom_id`、`player_username`
**唯一約束**: `(chatroom_id, player_username)`

---

## chat_messages

**RFC**: [rfc_03](rfc_03-chatroom-and-chat.md) | **Migration**: `20260317000005_create_chat_messages.ts`

| 欄位            | 型別        | 約束             | 說明                            |
| --------------- | ----------- | ---------------- | ------------------------------- |
| id              | INTEGER     | PRIMARY KEY AUTO |                                 |
| chatroom_id     | VARCHAR(50) | NOT NULL         | 所屬聊天室                      |
| player_username | VARCHAR(50) | NOT NULL         | 發訊玩家帳號                    |
| ~~player_nickname~~ | ~~VARCHAR(50)~~ | ~~已移除~~ | ~~改為 JOIN players.nickname~~ |
| message         | TEXT        | NOT NULL         | 訊息內容                        |
| created_at      | DATETIME    | DEFAULT now()    | 發訊時間                        |
| deleted_at      | DATETIME    | nullable         | 軟刪除標記（管理員刪除時間）    |

**索引**: `chatroom_id`、`player_username`、`created_at`

---

## blacklist

**RFC**: [rfc_04](rfc_04-blacklist-and-ip-blocking.md)
**Migration**: `20260317000006_create_blacklist.ts` + `20260317000007_blacklist_is_blocked.ts`（`deleted_at` → `is_blocked`）+ `20260318000012_blacklist_global_chatroom_all.ts`（`chatroom_id='*'` → `'all'`）

| 欄位        | 型別         | 約束                   | 說明                                       |
| ----------- | ------------ | ---------------------- | ------------------------------------------ |
| id          | INTEGER      | PRIMARY KEY AUTO       |                                            |
| block_type  | VARCHAR(10)  | NOT NULL               | `'player'` \| `'ip'`                       |
| target      | VARCHAR(100) | NOT NULL               | 玩家帳號或 IP（支援萬用字元如 `116.62.*`） |
| reason      | VARCHAR(20)  | NOT NULL               | `'spam'` \| `'abuse'` \| `'advertisement'` |
| operator    | VARCHAR(50)  | NOT NULL               | 操作者帳號（快照）                         |
| chatroom_id | VARCHAR(50)  | NOT NULL DEFAULT `'all'` | 特定聊天室 ID 或 `'all'`（全域封鎖）      |
| created_at  | DATETIME     | DEFAULT now()          |                                            |
| is_blocked  | BOOLEAN      | NOT NULL DEFAULT true  | 封鎖狀態（true=封鎖中，false=已解封）      |

**索引**: `(block_type, target)`、`created_at`
**唯一約束**: `(block_type, target, chatroom_id)`

> **注意**：`chatroom_id` 使用 `'all'`（非 NULL）代表全域封鎖，確保 UNIQUE 約束正確運作（SQLite 中 NULL ≠ NULL）。此表不使用 `deleted_at` 軟刪除，以 `is_blocked` 表示當前狀態，保留完整封鎖歷史。

---

## reports

**RFC**: [rfc_05](rfc_05-nickname-and-report.md) | **Migration**: `20260317000009_create_reports.ts`

| 欄位              | 型別        | 約束                         | 說明                                        |
| ----------------- | ----------- | ---------------------------- | ------------------------------------------- |
| id                | INTEGER     | PRIMARY KEY AUTO             |                                             |
| reporter_username | VARCHAR(50) | NOT NULL                     | FK → players.username（舉報者）             |
| target_username   | VARCHAR(50) | NOT NULL                     | FK → players.username（被舉報者）           |
| chatroom_id       | VARCHAR(50) | NOT NULL                     | 事件發生的聊天室                            |
| chat_message_id   | INTEGER     | nullable                     | FK → chat_messages.id（訊息可能已被刪除）   |
| chat_message      | TEXT        | NOT NULL                     | 被舉報訊息快照                              |
| reason            | VARCHAR(20) | NOT NULL                     | `'spam'` \| `'abuse'` \| `'advertisement'`  |
| status            | VARCHAR(20) | NOT NULL DEFAULT `'pending'` | `'pending'` \| `'approved'` \| `'rejected'` |
| reviewed_by       | VARCHAR(50) | nullable                     | 審核管理員帳號                              |
| reviewed_at       | DATETIME    | nullable                     | 審核時間                                    |
| created_at        | DATETIME    | DEFAULT now()                |                                             |

**索引**: `status`、`reporter_username`、`target_username`、`created_at`

> **無 `deleted_at`**：舉報記錄為不可變稽核資料，不支援刪除操作。

---

## broadcasts

**RFC**: [rfc_06](rfc_06-broadcast-message.md) | **Migration**: `20260318000011_create_broadcasts.ts`

| 欄位        | 型別        | 約束             | 說明                                   |
| ----------- | ----------- | ---------------- | -------------------------------------- |
| id          | INTEGER     | PRIMARY KEY AUTO |                                        |
| message     | TEXT        | NOT NULL         | 廣播內容                               |
| chatroom_id | VARCHAR(50) | NOT NULL         | 目標聊天室 ID 或 `'all'`（全部聊天室） |
| duration    | INTEGER     | NOT NULL         | 顯示時長（秒，1–86400）                |
| start_at    | DATETIME    | NOT NULL         | 廣播開始時間（UTC）                    |
| operator    | VARCHAR(50) | NOT NULL         | 操作者帳號（快照）                     |
| created_at  | DATETIME    | DEFAULT now()    |                                        |
| deleted_at  | DATETIME    | nullable         | 軟刪除標記（下架時間）                 |

**索引**: `chatroom_id`、`start_at`、`created_at`

**廣播狀態（計算欄位，非 DB 儲存）**：

| 狀態        | 條件                                      |
| ----------- | ----------------------------------------- |
| `scheduled` | `start_at > now()`                        |
| `active`    | `start_at <= now() < start_at + duration` |
| `expired`   | `start_at + duration <= now()`            |

> **`chatroom_id = 'all'`**：代表廣播至全部聊天室，為保留 magic value（非真實聊天室 ID）。blacklist 表與 broadcasts 表統一使用 `'all'` 作為全域 magic value。

---

## 全域設計慣例

| 慣例              | 說明                                                                                                                   |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **軟刪除**        | 大多數表使用 `deleted_at DATETIME nullable`，例外：`blacklist` 使用 `is_blocked`，`reports` 無刪除機制                 |
| **時間儲存**      | 全部 UTC+0 儲存，前端以 dayjs 轉換為 UTC+8 顯示                                                                        |
| **快照欄位**      | `operator VARCHAR(50)` 為寫入時快照，事後不同步更新。`player_nickname` 已移除，改為 JOIN players 取得即時暱稱          |
| **Magic values**  | `chatroom_id = 'all'` 統一代表「全部聊天室」（blacklist 與 broadcasts 皆用此值），以字串代替 NULL 避免 UNIQUE 約束問題 |
| **FK 無 DB 約束** | SQLite 預設不強制 FK，應用層自行維護一致性                                                                             |
