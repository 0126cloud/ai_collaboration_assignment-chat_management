# language: zh-TW
# 驗收規格來源：prd_00 §3.2 聊天監控 + rfc_03 §5.6~5.7 API 設計
# 技術設計參照：rfc_03-chatroom-and-chat.md

Feature: 聊天監控
  即時顯示各聊天室的玩家聊天訊息，管理員可搜尋、刪除訊息，並可直接從此頁面封鎖玩家或重設暱稱。

  Background:
    Given 系統已有以下管理員帳號
      | username | password | role            | is_active |
      | admin01  | 123456   | senior_manager  | true      |
      | admin02  | 123456   | general_manager | true      |
    And 系統已有聊天室 "baccarat_001"（Baccarat Room 1）
    And 系統已有 50 筆以上聊天訊息 mock data，分佈在多個聊天室

  # ─── 查看訊息列表 ───

  @happy_path
  Scenario: 查看聊天訊息列表（預設分頁）
    Given 管理員 "admin01" 已登入
    When 管理員請求聊天訊息列表
    Then 系統回傳 200 狀態碼
    And 回應包含訊息陣列
    And 每筆訊息包含 id、chatroom_id、player_username、player_nickname、message、created_at
    And 回應包含分頁資訊（page、pageSize、total、totalPages）
    And 預設 pageSize 為 30
    And 紀錄依 created_at 降冪排列（最新的在前）

  @happy_path
  Scenario: 查看聊天訊息列表（自訂分頁）
    Given 管理員 "admin01" 已登入
    When 管理員請求聊天訊息列表，頁碼 2，每頁 10 筆
    Then 系統回傳 200 狀態碼
    And 回應 pagination.page 為 2
    And 回應 pagination.pageSize 為 10
    And 回應資料最多 10 筆

  # ─── 篩選 ───

  @happy_path
  Scenario: 依聊天室篩選訊息
    Given 管理員 "admin01" 已登入
    When 管理員篩選聊天室為 "baccarat_001"
    Then 系統回傳 200 狀態碼
    And 所有回傳訊息的 chatroom_id 皆為 "baccarat_001"

  @happy_path
  Scenario: 依玩家帳號篩選訊息
    Given 管理員 "admin01" 已登入
    When 管理員篩選玩家帳號為 "player123"
    Then 系統回傳 200 狀態碼
    And 所有回傳訊息的 player_username 皆為 "player123"

  @happy_path
  Scenario: 依玩家暱稱模糊搜尋訊息
    Given 管理員 "admin01" 已登入
    When 管理員搜尋玩家暱稱 "Lucky"
    Then 系統回傳 200 狀態碼
    And 所有回傳訊息的 player_nickname 包含 "Lucky"

  @happy_path
  Scenario: 依訊息內容關鍵字搜尋
    Given 管理員 "admin01" 已登入
    When 管理員搜尋訊息關鍵字 "Hello"
    Then 系統回傳 200 狀態碼
    And 所有回傳訊息的 message 包含 "Hello"

  @happy_path
  Scenario: 依時間範圍篩選訊息
    Given 管理員 "admin01" 已登入
    When 管理員篩選時間範圍為 "2026-03-10" 至 "2026-03-15"
    Then 系統回傳 200 狀態碼
    And 所有回傳訊息的 created_at 在指定範圍內

  @happy_path
  Scenario: 複合條件篩選
    Given 管理員 "admin01" 已登入
    When 管理員同時篩選聊天室為 "baccarat_001" 且搜尋訊息關鍵字 "win"
    Then 系統回傳 200 狀態碼
    And 所有回傳訊息同時滿足兩個條件

  # ─── 刪除訊息 ───

  @happy_path
  Scenario: 刪除聊天訊息
    Given 管理員 "admin01" 已登入
    And 系統中有一筆 id 為 1 的未刪除訊息
    When 管理員刪除訊息 id 1
    Then 系統回傳 200 狀態碼
    And 回應包含成功訊息

  # ─── 軟刪除 ───

  @soft_delete
  Scenario: 已刪除訊息不出現在列表中
    Given 管理員 "admin01" 已登入
    And 管理員已刪除訊息 id 1
    When 管理員請求聊天訊息列表
    Then 回傳訊息中不包含 id 為 1 的訊息

  @soft_delete
  Scenario: 刪除訊息後自動產生操作紀錄
    Given 管理員 "admin01" 已登入
    When 管理員刪除訊息 id 1
    And 管理員查詢操作紀錄，篩選操作類型為 "DELETE_MESSAGE"
    Then 最新一筆紀錄的 operator 為 "admin01"
    And 最新一筆紀錄的 request 包含 method "DELETE"

  @soft_delete
  Scenario: 重複刪除已刪除的訊息
    Given 管理員 "admin01" 已登入
    And 管理員已刪除訊息 id 1
    When 管理員再次刪除訊息 id 1
    Then 系統回傳 404 狀態碼
    And 錯誤碼為 "CHAT_MESSAGE_NOT_FOUND"

  # ─── 權限 ───

  @permissions
  Scenario: 一般管理員可查看聊天訊息
    Given 管理員 "admin02" 已登入
    When 管理員請求聊天訊息列表
    Then 系統回傳 200 狀態碼

  @permissions
  Scenario: 一般管理員可刪除聊天訊息
    Given 管理員 "admin02" 已登入
    When 管理員刪除訊息 id 2
    Then 系統回傳 200 狀態碼

  @permissions
  Scenario: 高級管理員可查看聊天訊息
    Given 管理員 "admin01" 已登入
    When 管理員請求聊天訊息列表
    Then 系統回傳 200 狀態碼

  @permissions
  Scenario: 未登入無法查看聊天訊息
    When 管理員未帶 Token 請求聊天訊息列表
    Then 系統回傳 401 狀態碼
    And 錯誤碼為 "AUTH_MISSING_TOKEN"

  @permissions
  Scenario: 未登入無法刪除聊天訊息
    When 管理員未帶 Token 刪除訊息 id 1
    Then 系統回傳 401 狀態碼
    And 錯誤碼為 "AUTH_MISSING_TOKEN"

  # ─── 驗證 ───

  @validation
  Scenario: 分頁參數非正整數
    Given 管理員 "admin01" 已登入
    When 管理員請求聊天訊息列表，頁碼 -1
    Then 系統回傳 400 狀態碼
    And 錯誤碼為 "VALIDATION_ERROR"

  @validation
  Scenario: 篩選無結果
    Given 管理員 "admin01" 已登入
    When 管理員搜尋訊息關鍵字 "不存在的內容xyz"
    Then 系統回傳 200 狀態碼
    And 回應資料為空陣列
    And pagination.total 為 0

  @validation
  Scenario: 刪除不存在的訊息
    Given 管理員 "admin01" 已登入
    When 管理員刪除訊息 id 99999
    Then 系統回傳 404 狀態碼
    And 錯誤碼為 "CHAT_MESSAGE_NOT_FOUND"

  # ─── 前端 UI 佔位 ───

  @ui_only
  Scenario: 封鎖玩家按鈕可點擊並開啟 Modal
    Given 管理員 "admin01" 已登入
    When 前端渲染聊天監控頁面
    Then 每筆訊息的操作欄有「封鎖玩家」按鈕
    And 「封鎖玩家」按鈕為 enabled 狀態（可點擊）

  @ui_only
  Scenario: 重設暱稱按鈕存在但不可操作
    Given 管理員 "admin01" 已登入
    When 前端渲染聊天監控頁面
    Then 每筆訊息的操作欄有「重設暱稱」按鈕
    And 「重設暱稱」按鈕為 disabled 狀態（暱稱審核功能尚未整合至此頁面）
