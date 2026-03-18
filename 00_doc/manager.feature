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
