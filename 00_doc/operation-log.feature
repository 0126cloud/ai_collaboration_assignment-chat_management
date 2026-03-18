# language: zh-TW
# 驗收規格來源：prd_00 §3.6 操作紀錄 + rfc_02 §5.3 API 設計
# 技術設計參照：rfc_02-operation-logs.md

Feature: 操作紀錄
  記錄並顯示所有管理操作，作為系統稽核追蹤。此為唯讀模組，紀錄由其他模組的操作自動產生。

  Background:
    Given 系統已有以下管理員帳號
      | username | password | role            | is_active |
      | admin01  | 123456   | senior_manager  | true      |
      | admin02  | 123456   | general_manager | true      |
    And 系統已有 20 筆操作紀錄 mock data，涵蓋多種操作類型

  # ─── 查看操作紀錄 ───

  @integration @happy_path
  Scenario: 查看操作紀錄列表（預設分頁）
    Given 管理員 "admin01" 已登入
    When 管理員請求操作紀錄列表
    Then 系統回傳 200 狀態碼
    And 回應包含操作紀錄陣列
    And 每筆紀錄包含 id、operation_type、operator、request、created_at
    And 回應包含分頁資訊（page、pageSize、total、totalPages）
    And 紀錄依 created_at 降冪排列（最新的在前）

  @integration @happy_path
  Scenario: 查看操作紀錄列表（自訂分頁）
    Given 管理員 "admin01" 已登入
    When 管理員請求操作紀錄列表，頁碼 2，每頁 5 筆
    Then 系統回傳 200 狀態碼
    And 回應 pagination.page 為 2
    And 回應 pagination.pageSize 為 5
    And 回應資料最多 5 筆

  # ─── 篩選 ───

  @integration @happy_path
  Scenario: 依操作類型篩選
    Given 管理員 "admin01" 已登入
    When 管理員篩選操作類型為 "CREATE_ADMIN"
    Then 系統回傳 200 狀態碼
    And 所有回傳紀錄的 operation_type 皆為 "CREATE_ADMIN"

  @integration @happy_path
  Scenario: 依操作者篩選
    Given 管理員 "admin01" 已登入
    When 管理員篩選操作者為 "admin01"
    Then 系統回傳 200 狀態碼
    And 所有回傳紀錄的 operator 包含 "admin01"

  @integration @happy_path
  Scenario: 依時間範圍篩選
    Given 管理員 "admin01" 已登入
    When 管理員篩選時間範圍為 "2026-03-01" 至 "2026-03-15"
    Then 系統回傳 200 狀態碼
    And 所有回傳紀錄的 created_at 在指定範圍內

  @integration @happy_path
  Scenario: 複合條件篩選
    Given 管理員 "admin01" 已登入
    When 管理員同時篩選操作類型為 "DELETE_MESSAGE" 且操作者為 "admin02"
    Then 系統回傳 200 狀態碼
    And 所有回傳紀錄同時滿足兩個條件

  # ─── 時區顯示 ───

  @integration @happy_path
  Scenario: 前端時間顯示為 UTC+8 格式
    Given 管理員 "admin01" 已登入
    And 資料庫中有一筆 created_at 為 "2026-03-15 02:30:00"（UTC+0）的紀錄
    When 前端渲染操作紀錄頁面
    Then 該筆紀錄的時間顯示為 "2026-03-15 10:30:00"（UTC+8）

  # ─── 權限 ───

  @integration @permissions
  Scenario: 一般管理員可查看操作紀錄
    Given 管理員 "admin02" 已登入
    When 管理員請求操作紀錄列表
    Then 系統回傳 200 狀態碼

  @integration @permissions
  Scenario: 高級管理員可查看操作紀錄
    Given 管理員 "admin01" 已登入
    When 管理員請求操作紀錄列表
    Then 系統回傳 200 狀態碼

  @integration @permissions
  Scenario: 未登入無法查看操作紀錄
    When 管理員未帶 Token 請求操作紀錄列表
    Then 系統回傳 401 狀態碼
    And 錯誤碼為 "AUTH_MISSING_TOKEN"

  # ─── 驗證 ───

  @integration @validation
  Scenario: 分頁參數非正整數
    Given 管理員 "admin01" 已登入
    When 管理員請求操作紀錄列表，頁碼 -1
    Then 系統回傳 400 狀態碼
    And 錯誤碼為 "VALIDATION_ERROR"

  @integration @validation
  Scenario: 無篩選結果
    Given 管理員 "admin01" 已登入
    When 管理員篩選操作類型為不存在的類型
    Then 系統回傳 200 狀態碼
    And 回應資料為空陣列
    And pagination.total 為 0

  # ─── 自動記錄整合 ───

  @integration
  Scenario: 新增管理員後自動產生操作紀錄
    Given 管理員 "admin01" 已登入
    When 管理員新增帳號 username "admin04" password "123456" role "general_manager"
    And 管理員請求操作紀錄列表，篩選操作類型為 "CREATE_ADMIN"
    Then 最新一筆紀錄的 operator 為 "admin01"
    And 最新一筆紀錄的 request 包含 url "/api/admins" 和 method "POST"
    And 最新一筆紀錄的 request.payload 不包含密碼明文

  @integration
  Scenario: 修改密碼後自動產生操作紀錄
    Given 管理員 "admin01" 已登入
    When 管理員以舊密碼 "123456" 新密碼 "new_password" 修改密碼
    And 管理員請求操作紀錄列表，篩選操作類型為 "CHANGE_PASSWORD"
    Then 最新一筆紀錄的 operator 為 "admin01"
    And 最新一筆紀錄的 request.payload 中密碼欄位為 "***"

  @integration
  Scenario: 登入後自動產生操作紀錄
    When 管理員以 username "admin01" password "123456" 登入
    Then 系統回傳 200 狀態碼
    And operation_logs 最新一筆的 operation_type 為 "LOGIN"
    And 最新一筆紀錄的 operator 為 "admin01"
    And 最新一筆紀錄的 request.payload 中密碼欄位為 "***"

  @integration
  Scenario: 登入失敗不產生操作紀錄
    When 管理員以 username "admin01" password "wrong_password" 登入
    Then 系統回傳 401 狀態碼
    And operation_logs 無新增 "LOGIN" 紀錄

  @integration
  Scenario: 登出後自動產生操作紀錄
    Given 管理員 "admin01" 已登入
    When 管理員執行登出
    Then 系統回傳 200 狀態碼
    And operation_logs 最新一筆的 operation_type 為 "LOGOUT"
    And 最新一筆紀錄的 operator 為 "admin01"

  @integration
  Scenario: 未登入直接登出不產生操作紀錄
    When 管理員未帶 Token 執行登出
    Then 系統回傳 401 狀態碼
    And operation_logs 無新增 "LOGOUT" 紀錄

  # ------- E2E -------

  @e2e @happy_path
  Scenario: 管理員查看操作紀錄列表並依類型篩選
    Given 管理員 "admin01" 已登入
    When 在操作紀錄頁面篩選操作類型為 "DELETE_MESSAGE"
    Then 頁面只顯示 operation_type 為 "DELETE_MESSAGE" 的紀錄
