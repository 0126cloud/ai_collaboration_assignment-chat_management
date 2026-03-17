# language: zh-TW
# 驗收規格來源：prd_00 §3.5 聊天室管理 + rfc_03 §5.5 API 設計
# 技術設計參照：rfc_03-chatroom-and-chat.md

Feature: 聊天室管理
  查看所有聊天室列表及各聊天室的線上人數。此為唯讀模組。

  Background:
    Given 系統已有以下管理員帳號
      | username | password | role            | is_active |
      | admin01  | 123456   | senior_manager  | true      |
      | admin02  | 123456   | general_manager | true      |
    And 系統已有以下聊天室
      | id            | name              | online_user_count |
      | baccarat_001  | Baccarat Room 1   | 120               |
      | baccarat_002  | Baccarat Room 2   | 85                |
      | blackjack_001 | Blackjack Room 1  | 64                |
      | roulette_001  | Roulette Room 1   | 45                |
      | slots_001     | Slots Room 1      | 200               |

  # ─── 查看聊天室列表 ───

  @happy_path
  Scenario: 查看聊天室列表（預設分頁）
    Given 管理員 "admin01" 已登入
    When 管理員請求聊天室列表
    Then 系統回傳 200 狀態碼
    And 回應包含聊天室陣列
    And 每筆聊天室包含 id、name、online_user_count、created_at
    And 回應包含分頁資訊（page、pageSize、total、totalPages）
    And 預設 pageSize 為 30

  @happy_path
  Scenario: 查看聊天室列表（自訂分頁）
    Given 管理員 "admin01" 已登入
    When 管理員請求聊天室列表，頁碼 1，每頁 2 筆
    Then 系統回傳 200 狀態碼
    And 回應 pagination.page 為 1
    And 回應 pagination.pageSize 為 2
    And 回應資料最多 2 筆
    And 回應 pagination.total 為 5

  # ─── 搜尋 ───

  @happy_path
  Scenario: 依名稱搜尋聊天室
    Given 管理員 "admin01" 已登入
    When 管理員搜尋聊天室名稱 "Baccarat"
    Then 系統回傳 200 狀態碼
    And 所有回傳聊天室的名稱包含 "Baccarat"
    And 回應 pagination.total 為 2

  @happy_path
  Scenario: 依 ID 搜尋聊天室
    Given 管理員 "admin01" 已登入
    When 管理員搜尋聊天室名稱 "blackjack_001"
    Then 系統回傳 200 狀態碼
    And 回傳聊天室的 id 為 "blackjack_001"
    And 回應 pagination.total 為 1

  # ─── 權限 ───

  @permissions
  Scenario: 一般管理員可查看聊天室列表
    Given 管理員 "admin02" 已登入
    When 管理員請求聊天室列表
    Then 系統回傳 200 狀態碼

  @permissions
  Scenario: 高級管理員可查看聊天室列表
    Given 管理員 "admin01" 已登入
    When 管理員請求聊天室列表
    Then 系統回傳 200 狀態碼

  @permissions
  Scenario: 未登入無法查看聊天室列表
    When 管理員未帶 Token 請求聊天室列表
    Then 系統回傳 401 狀態碼
    And 錯誤碼為 "AUTH_MISSING_TOKEN"

  # ─── 驗證 ───

  @validation
  Scenario: 搜尋無結果
    Given 管理員 "admin01" 已登入
    When 管理員搜尋聊天室名稱 "不存在的聊天室"
    Then 系統回傳 200 狀態碼
    And 回應資料為空陣列
    And pagination.total 為 0

  @validation
  Scenario: 分頁參數非正整數
    Given 管理員 "admin01" 已登入
    When 管理員請求聊天室列表，頁碼 -1
    Then 系統回傳 400 狀態碼
    And 錯誤碼為 "VALIDATION_ERROR"
