# language: zh-TW
# 驗收規格來源：prd_00 §3.1 使用者認證 + rfc_01 §5.9 API 設計
# 技術設計參照：rfc_01-auth-and-response.md

Feature: 使用者認證與權限控制
  管理員透過帳號密碼登入系統，系統驗證身份並根據角色授予對應權限。

  Background:
    Given 系統已有以下管理員帳號
      | username | password | role            | is_active |
      | admin01  | 123456   | senior_manager  | true      |
      | admin02  | 123456   | general_manager | true      |
      | admin03  | 123456   | general_manager | false     |

  # ─── 登入 ───

  @happy_path
  Scenario: 使用正確帳密登入成功
    When 管理員以帳號 "admin01" 密碼 "123456" 登入
    Then 系統回傳 200 狀態碼
    And 系統透過 HttpOnly Cookie 設定 JWT token
    And 回應包含 JWT token（供 Postman 等工具使用 Bearer 認證）
    And 回應包含使用者資訊（id、username、role）
    And 回應格式為 { success: true, data: { token, user } }

  @happy_path
  Scenario: 登入後透過 /api/auth/me 取得使用者資訊與權限
    Given 管理員 "admin01" 已登入
    When 管理員請求 /api/auth/me
    Then 系統回傳 200 狀態碼
    And 回應包含使用者資訊（id、username、role）
    And 回應包含 role 為 "senior_manager"
    And 回應包含 21 個權限項目

  @happy_path
  Scenario: 一般管理員透過 /api/auth/me 取得權限清單
    Given 管理員 "admin02" 已登入
    When 管理員請求 /api/auth/me
    Then 系統回傳 200 狀態碼
    And 回應包含使用者資訊（id、username、role）
    And 回應包含 role 為 "general_manager"
    And 回應包含 15 個權限項目

  @happy_path
  Scenario: 頁面重新載入後恢復登入狀態
    Given 管理員 "admin01" 已登入
    When 頁面重新載入
    And 前端呼叫 /api/auth/me
    Then 系統透過 Cookie 驗證身份
    And 回傳使用者資訊與權限清單
    And 前端恢復登入狀態

  @happy_path
  Scenario: 登出成功清除 Cookie
    Given 管理員 "admin01" 已登入
    When 管理員請求登出（POST /api/auth/logout）
    Then 系統回傳 200 狀態碼
    And 系統清除 HttpOnly Cookie
    And 再次請求 /api/auth/me 回傳 401

  @security
  Scenario: Cookie 過期後存取受保護 API
    Given 管理員 "admin01" 的 Cookie 已過期
    When 管理員請求 /api/auth/me
    Then 系統回傳 401 狀態碼
    And 錯誤碼為 "AUTH_TOKEN_EXPIRED"

  @validation
  Scenario: 登入時缺少帳號欄位
    When 管理員以空白帳號和密碼 "123456" 登入
    Then 系統回傳 400 狀態碼
    And 錯誤碼為 "VALIDATION_ERROR"

  @validation
  Scenario: 登入時缺少密碼欄位
    When 管理員以帳號 "admin01" 和空白密碼登入
    Then 系統回傳 400 狀態碼
    And 錯誤碼為 "VALIDATION_ERROR"

  @error_handling
  Scenario: 帳號不存在
    When 管理員以帳號 "nonexistent" 密碼 "123456" 登入
    Then 系統回傳 401 狀態碼
    And 錯誤碼為 "AUTH_INVALID_CREDENTIALS"

  @error_handling
  Scenario: 密碼錯誤
    When 管理員以帳號 "admin01" 密碼 "wrong_password" 登入
    Then 系統回傳 401 狀態碼
    And 錯誤碼為 "AUTH_INVALID_CREDENTIALS"

  @permissions
  Scenario: 帳號已停用無法登入
    When 管理員以帳號 "admin03" 密碼 "123456" 登入
    Then 系統回傳 403 狀態碼
    And 錯誤碼為 "AUTH_ACCOUNT_DISABLED"

  # ─── 修改密碼 ───

  @happy_path
  Scenario: 成功修改自己的密碼
    Given 管理員 "admin01" 已登入
    When 管理員以舊密碼 "123456" 新密碼 "new_password" 修改密碼
    Then 系統回傳 200 狀態碼
    And 回應包含成功訊息
    And 使用新密碼可以重新登入

  @validation
  Scenario: 修改密碼時缺少舊密碼
    Given 管理員 "admin01" 已登入
    When 管理員以空白舊密碼和新密碼 "new_password" 修改密碼
    Then 系統回傳 400 狀態碼
    And 錯誤碼為 "VALIDATION_ERROR"

  @validation
  Scenario: 新密碼長度不足
    Given 管理員 "admin01" 已登入
    When 管理員以舊密碼 "123456" 新密碼 "123" 修改密碼
    Then 系統回傳 400 狀態碼
    And 錯誤碼為 "VALIDATION_ERROR"

  @error_handling
  Scenario: 舊密碼不正確
    Given 管理員 "admin01" 已登入
    When 管理員以舊密碼 "wrong_old" 新密碼 "new_password" 修改密碼
    Then 系統回傳 400 狀態碼
    And 錯誤碼為 "AUTH_OLD_PASSWORD_INCORRECT"

  # ─── Token 安全 ───

  @security
  Scenario: 未提供 Token 存取受保護 API
    When 管理員未帶 Token 請求修改密碼
    Then 系統回傳 401 狀態碼
    And 錯誤碼為 "AUTH_MISSING_TOKEN"

  @security
  Scenario: 提供無效 Token
    When 管理員以無效 Token 請求修改密碼
    Then 系統回傳 401 狀態碼
    And 錯誤碼為 "AUTH_INVALID_TOKEN"

  @security
  Scenario: 提供過期 Token
    When 管理員以過期 Token 請求修改密碼
    Then 系統回傳 401 狀態碼
    And 錯誤碼為 "AUTH_TOKEN_EXPIRED"

  # ─── 新增管理員 ───

  @happy_path
  Scenario: 高級管理員成功新增管理員帳號
    Given 管理員 "admin01" 已登入
    When 管理員新增帳號 username "admin04" password "123456" role "general_manager"
    Then 系統回傳 201 狀態碼
    And 回應包含新帳號的 id、username、role、is_active、created_at
    And 回應格式為 { success: true, data: { ... } }

  @validation
  Scenario: 新增管理員帳號名稱長度不足
    Given 管理員 "admin01" 已登入
    When 管理員新增帳號 username "ab" password "123456" role "general_manager"
    Then 系統回傳 400 狀態碼
    And 錯誤碼為 "VALIDATION_ERROR"

  @validation
  Scenario: 新增管理員密碼長度不足
    Given 管理員 "admin01" 已登入
    When 管理員新增帳號 username "admin04" password "123" role "general_manager"
    Then 系統回傳 400 狀態碼
    And 錯誤碼為 "VALIDATION_ERROR"

  @validation
  Scenario: 新增管理員角色無效
    Given 管理員 "admin01" 已登入
    When 管理員新增帳號 username "admin04" password "123456" role "invalid_role"
    Then 系統回傳 400 狀態碼
    And 錯誤碼為 "VALIDATION_ERROR"

  @error_handling
  Scenario: 新增管理員帳號已存在
    Given 管理員 "admin01" 已登入
    When 管理員新增帳號 username "admin02" password "123456" role "general_manager"
    Then 系統回傳 409 狀態碼
    And 錯誤碼為 "ADMIN_USERNAME_DUPLICATE"

  @permissions
  Scenario: 一般管理員無法新增管理員帳號
    Given 管理員 "admin02" 已登入
    When 管理員新增帳號 username "admin04" password "123456" role "general_manager"
    Then 系統回傳 403 狀態碼
    And 錯誤碼為 "FORBIDDEN_INSUFFICIENT_PERMISSIONS"

  # ─── 權限控制 ───

  @permissions
  Scenario: 一般管理員無法存取廣播功能
    Given 管理員 "admin02" 已登入
    When 管理員嘗試發送廣播訊息
    Then 系統回傳 403 狀態碼
    And 錯誤碼為 "FORBIDDEN_INSUFFICIENT_PERMISSIONS"

  @permissions
  Scenario: 一般管理員無法存取帳號管理
    Given 管理員 "admin02" 已登入
    When 管理員嘗試查看管理員列表
    Then 系統回傳 403 狀態碼
    And 錯誤碼為 "FORBIDDEN_INSUFFICIENT_PERMISSIONS"

  @permissions
  Scenario: 高級管理員可存取所有功能
    Given 管理員 "admin01" 已登入
    When 管理員嘗試發送廣播訊息
    Then 系統回傳成功狀態碼

  @permissions
  Scenario: Sidebar 依角色顯示選單 — 高級管理員
    Given 管理員 "admin01" 已登入
    When 前端渲染 Sidebar 選單
    Then 選單顯示 8 個項目（含廣播與帳號管理）

  @permissions
  Scenario: Sidebar 依角色顯示選單 — 一般管理員
    Given 管理員 "admin02" 已登入
    When 前端渲染 Sidebar 選單
    Then 選單顯示 6 個項目（不含廣播與帳號管理）

  @permissions
  Scenario: 未授權頁面導向
    Given 管理員 "admin02" 已登入
    When 管理員嘗試直接存取廣播頁面 URL
    Then 系統導向首頁或顯示無權限提示

  # ─── 頁面導向 ───

  @happy_path
  Scenario: 已登入使用者進入登入頁自動跳轉主頁
    Given 管理員 "admin01" 已登入
    When 管理員進入 /login 頁面
    Then 系統自動導向首頁 /

  @happy_path
  Scenario: 登入後存取不存在的頁面顯示 404
    Given 管理員 "admin01" 已登入
    When 管理員進入不存在的頁面 URL（如 /nonexistent）
    Then 系統在 AdminLayout 內顯示 NotFoundPage（404 提示）
    And Sidebar 與 Header 仍正常顯示
