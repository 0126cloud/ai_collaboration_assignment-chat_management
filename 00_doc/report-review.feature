Feature: 玩家檢舉審核（Player Report Review）

  Background:
    Given 系統已存在管理員帳號「admin01」（senior_manager 角色）
    And 玩家「player003」已被「player001」在「baccarat_001」聊天室以「spam」原因檢舉（status=pending）
    And 玩家「player007」已被「player002」在「blackjack_001」聊天室以「abuse」原因檢舉（status=pending）
    And 玩家「player010」已被「player004」的檢舉已審核（status=approved）
    And 玩家「player015」未在黑名單中

  # ------- 列表查詢 -------

  @integration @happy_path
  Scenario: 查看待審核檢舉列表（預設）
    Given 管理員已登入
    When 管理員請求 GET /api/reports
    Then 回應應為 200，並回傳 status=pending 的檢舉列表
    And 列表應依 created_at 遞減排序

  @integration @happy_path
  Scenario: 依狀態篩選查看已核准的檢舉
    Given 管理員已登入
    When 管理員請求 GET /api/reports?status=approved
    Then 回應應為 200，列表中所有紀錄的 status 應為「approved」

  @integration @happy_path
  Scenario: 依檢舉人帳號搜尋
    Given 管理員已登入
    When 管理員請求 GET /api/reports?reporterUsername=player001
    Then 回應應為 200，列表應只包含 reporter_username 含「player001」的檢舉

  @integration @happy_path
  Scenario: 依被檢舉玩家帳號搜尋
    Given 管理員已登入
    When 管理員請求 GET /api/reports?targetUsername=player003
    Then 回應應為 200，列表應只包含 target_username 含「player003」的檢舉

  @integration @happy_path
  Scenario: 依舉報時間範圍篩選
    Given 管理員已登入
    When 管理員請求 GET /api/reports?startDate=2026-03-16&endDate=2026-03-16
    Then 回應應為 200，列表應只包含 created_at 在 2026-03-16 的檢舉

  # ------- 核准檢舉 -------

  @integration @happy_path @auto_block
  Scenario: 管理員核准檢舉，被檢舉玩家自動被封鎖
    Given 管理員已登入
    And 玩家「player003」未在黑名單中
    When 管理員請求 POST /api/reports/1/approve
    Then 回應應為 200，訊息為「檢舉已核准，被檢舉玩家已封鎖」
    And 該檢舉的 status 應變為「approved」
    And 該檢舉的 reviewed_by 應為「admin01」
    And 玩家「player003」應出現在黑名單中（is_blocked = true）
    And 操作紀錄應包含 operationType 為「APPROVE_REPORT」的紀錄

  @integration @auto_block
  Scenario: 核准檢舉時被檢舉玩家已在黑名單中，操作仍成功
    Given 管理員已登入
    And 玩家「player007」已在黑名單中（is_blocked = true）
    When 管理員請求 POST /api/reports/2/approve
    Then 回應應為 200
    And 該檢舉的 status 應變為「approved」
    And 不應回傳任何封鎖相關錯誤

  # ------- 駁回檢舉 -------

  @integration @happy_path
  Scenario: 管理員駁回檢舉
    Given 管理員已登入
    When 管理員請求 POST /api/reports/2/reject
    Then 回應應為 200，訊息為「檢舉已駁回」
    And 該檢舉的 status 應變為「rejected」
    And 該檢舉的 reviewed_by 應為「admin01」
    And 操作紀錄應包含 operationType 為「REJECT_REPORT」的紀錄

  # ------- 錯誤情境 -------

  @integration @already_reviewed
  Scenario: 對已審核的檢舉再次核准
    Given 管理員已登入
    And id=3 的檢舉 status 為「approved」
    When 管理員請求 POST /api/reports/3/approve
    Then 回應應為 409，錯誤碼為「REPORT_ALREADY_REVIEWED」

  @integration @already_reviewed
  Scenario: 對已審核的檢舉再次駁回
    Given 管理員已登入
    And id=3 的檢舉 status 為「approved」
    When 管理員請求 POST /api/reports/3/reject
    Then 回應應為 409，錯誤碼為「REPORT_ALREADY_REVIEWED」

  @integration @validation
  Scenario: 對不存在的檢舉執行核准
    Given 管理員已登入
    When 管理員請求 POST /api/reports/9999/approve
    Then 回應應為 404，錯誤碼為「REPORT_NOT_FOUND」

  @integration @permissions
  Scenario: 未登入時無法存取檢舉 API
    Given 使用者未登入（未攜帶 JWT）
    When 使用者請求 GET /api/reports
    Then 回應應為 401，錯誤碼為「AUTH_MISSING_TOKEN」

  @integration @permissions
  Scenario: 缺少 report:review 權限無法核准檢舉
    Given 管理員已登入，但無 report:review 權限
    When 管理員請求 POST /api/reports/1/approve
    Then 回應應為 403，錯誤碼為「FORBIDDEN_INSUFFICIENT_PERMISSIONS」

  # ------- E2E -------

  @e2e @happy_path
  Scenario: 管理員核准檢舉，被檢舉玩家自動加入黑名單
    Given 管理員 "admin01" 已登入
    And 玩家 "player003" 未在黑名單中
    When 管理員核准 id=1 的檢舉並確認
    Then 頁面顯示操作成功提示
    And 至黑名單頁面查詢，"player003" 出現在列表中
