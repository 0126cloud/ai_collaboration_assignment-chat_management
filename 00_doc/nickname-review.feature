Feature: 暱稱審核（Nickname Review）

  Background:
    Given 系統已存在管理員帳號「admin01」（senior_manager 角色）
    And 已有玩家「player016」申請將暱稱改為「DragonKing」，申請時間為 2026-03-15 10:00:00
    And 已有玩家「player017」申請將暱稱改為「LuckyStrike99」，申請時間為 2026-03-15 11:30:00
    And 已有玩家「player019」的暱稱已核准（nickname_review_status = 'approved'）

  # ------- 列表查詢 -------

  @integration @happy_path
  Scenario: 查看待審核暱稱列表
    Given 管理員已登入
    When 管理員請求 GET /api/players/nickname/reviews
    Then 回應應為 200，並回傳待審核玩家列表
    And 列表應只包含 nickname_review_status = 'pending' 的玩家
    And 列表應依 nickname_apply_at 遞增排序

  @integration @happy_path
  Scenario: 依玩家帳號搜尋待審核列表
    Given 管理員已登入
    When 管理員請求 GET /api/players/nickname/reviews?username=player016
    Then 回應應為 200
    And 列表應只包含 username 含「player016」的玩家

  @integration @happy_path
  Scenario: 依申請暱稱搜尋待審核列表
    Given 管理員已登入
    When 管理員請求 GET /api/players/nickname/reviews?nickname=Dragon
    Then 回應應為 200
    And 列表應只包含 nickname 含「Dragon」的玩家

  @integration @happy_path
  Scenario: 依申請時間範圍篩選
    Given 管理員已登入
    When 管理員請求 GET /api/players/nickname/reviews?applyStartDate=2026-03-15&applyEndDate=2026-03-15
    Then 回應應為 200
    And 列表應只包含 2026-03-15 當天申請的玩家

  # ------- 核准暱稱 -------

  @integration @happy_path
  Scenario: 管理員核准暱稱申請
    Given 管理員已登入
    When 管理員請求 POST /api/players/player016/nickname/approve
    Then 回應應為 200，訊息為「暱稱申請已核准」
    And 玩家「player016」的 nickname_review_status 應變為 'approved'
    And 玩家「player016」的 nickname_reviewed_by 應為「admin01」
    And 操作紀錄應包含 operationType 為「APPROVE_NICKNAME」的紀錄

  # ------- 駁回暱稱 -------

  @integration @happy_path
  Scenario: 管理員駁回暱稱申請，暱稱重設為帳號名稱
    Given 管理員已登入
    When 管理員請求 POST /api/players/player016/nickname/reject
    Then 回應應為 200，訊息為「暱稱申請已駁回，暱稱已重設為帳號名稱」
    And 玩家「player016」的 nickname 應變為「player016」（即 username）
    And 玩家「player016」的 nickname_review_status 應變為 'rejected'
    And 玩家「player016」的 nickname_reviewed_by 應為「admin01」
    And 操作紀錄應包含 operationType 為「REJECT_NICKNAME」的紀錄

  # ------- 錯誤情境 -------

  @integration @validation
  Scenario: 對無待審核申請的玩家執行核准
    Given 管理員已登入
    And 玩家「player019」的暱稱已核准（nickname_review_status = 'approved'）
    When 管理員請求 POST /api/players/player019/nickname/approve
    Then 回應應為 409，錯誤碼為「PLAYER_NICKNAME_NOT_PENDING」

  @integration @validation
  Scenario: 對不存在的玩家執行核准
    Given 管理員已登入
    When 管理員請求 POST /api/players/nonexistent_player/nickname/approve
    Then 回應應為 404，錯誤碼為「PLAYER_NOT_FOUND」

  @integration @permissions
  Scenario: 未登入時無法存取暱稱審核 API
    Given 使用者未登入（未攜帶 JWT）
    When 使用者請求 GET /api/players/nickname/reviews
    Then 回應應為 401，錯誤碼為「AUTH_MISSING_TOKEN」

  @integration @permissions
  Scenario: 缺少 nickname:review 權限無法核准
    Given 管理員已登入，但無 nickname:review 權限
    When 管理員請求 POST /api/players/player016/nickname/approve
    Then 回應應為 403，錯誤碼為「FORBIDDEN_INSUFFICIENT_PERMISSIONS」

  # ------- E2E -------

  @e2e @happy_path
  Scenario: 管理員核准暱稱申請完整流程
    Given 管理員 "admin01" 已登入
    And 待審核列表中有玩家 "player016" 申請暱稱 "DragonKing"
    When 管理員點擊核准按鈕並確認
    Then 頁面顯示操作成功提示
    And 該申請從待審核列表消失
