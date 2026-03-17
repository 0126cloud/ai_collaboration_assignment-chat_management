Feature: 黑名單與 IP 封鎖管理

  Background:
    Given 系統已有聊天室 "baccarat_001" 和玩家 "player123"
    And 管理員 "admin01" 已登入（general_manager 角色）

  # ==========================================
  # Happy Path — 玩家黑名單
  # ==========================================

  @happy_path
  Scenario: 成功封鎖玩家（指定聊天室）
    When 管理員送出 POST /api/blacklist/player，帶 target="player123"、reason="spam"、chatroom_id="baccarat_001"
    Then 回應狀態碼為 201
    And 回應 data 包含 id、block_type="player"、target="player123"、reason="spam"、chatroom_id="baccarat_001"
    And operation_logs 有一筆 operation_type="BLOCK_PLAYER" 的紀錄

  @happy_path
  Scenario: 成功封鎖玩家（全域）
    When 管理員送出 POST /api/blacklist/player，帶 target="player123"、reason="abuse"，不帶 chatroom_id
    Then 回應狀態碼為 201
    And 回應 data 中 chatroom_id="*"

  @happy_path
  Scenario: 查詢玩家黑名單列表
    Given 黑名單中已有 3 筆 block_type="player" 的封鎖紀錄
    When 管理員送出 GET /api/blacklist/player
    Then 回應狀態碼為 200
    And 回應包含 data 陣列和 pagination
    And data 中所有紀錄的 block_type 均為 "player"
    And data 中所有紀錄的 deleted_at 均為 null（僅顯示有效封鎖）

  @happy_path
  Scenario: 依 target 模糊搜尋玩家黑名單
    Given 黑名單中有 "player123" 和 "player456" 兩筆封鎖紀錄
    When 管理員送出 GET /api/blacklist/player?target=player12
    Then 回應狀態碼為 200
    And data 僅包含 target 含 "player12" 的紀錄

  @happy_path
  Scenario: 成功解封玩家
    Given 黑名單中有 id=1、block_type="player"、deleted_at=null 的封鎖紀錄
    When 管理員送出 DELETE /api/blacklist/player/1
    Then 回應狀態碼為 200
    And 該筆紀錄的 deleted_at 已設定為解封時間
    And operation_logs 有一筆 operation_type="UNBLOCK_PLAYER" 的紀錄

  # ==========================================
  # Happy Path — IP 封鎖
  # ==========================================

  @happy_path
  Scenario: 成功封鎖精確 IP
    When 管理員送出 POST /api/blacklist/ip，帶 target="116.62.238.199"、reason="spam"
    Then 回應狀態碼為 201
    And 回應 data 包含 block_type="ip"、target="116.62.238.199"
    And operation_logs 有一筆 operation_type="BLOCK_IP" 的紀錄

  @happy_path
  Scenario: 成功封鎖萬用字元 IP 段
    When 管理員送出 POST /api/blacklist/ip，帶 target="116.62.238.*"、reason="abuse"
    Then 回應狀態碼為 201
    And 回應 data 中 target="116.62.238.*"

  @happy_path
  Scenario: 查詢 IP 封鎖列表
    Given 黑名單中已有 2 筆 block_type="ip" 的封鎖紀錄
    When 管理員送出 GET /api/blacklist/ip
    Then 回應狀態碼為 200
    And data 中所有紀錄的 block_type 均為 "ip"

  @happy_path
  Scenario: 成功解除 IP 封鎖
    Given 黑名單中有 id=8、block_type="ip"、deleted_at=null 的封鎖紀錄
    When 管理員送出 DELETE /api/blacklist/ip/8
    Then 回應狀態碼為 200
    And 該筆紀錄的 deleted_at 已設定
    And operation_logs 有一筆 operation_type="UNBLOCK_IP" 的紀錄

  # ==========================================
  # Soft Delete — 解封後重新封鎖
  # ==========================================

  @soft_delete
  Scenario: 解封玩家後可重新封鎖（upsert 行為）
    Given 黑名單中有一筆已解封紀錄（deleted_at IS NOT NULL），target="player123"、chatroom_id="baccarat_001"
    When 管理員再次送出 POST /api/blacklist/player，帶 target="player123"、chatroom_id="baccarat_001"
    Then 回應狀態碼為 201
    And 該筆紀錄的 deleted_at 已清除（重新生效）
    And 資料庫中不會產生重複紀錄

  @soft_delete
  Scenario: 已解封的玩家不出現在黑名單列表中
    Given 黑名單中有一筆 deleted_at IS NOT NULL 的紀錄
    When 管理員送出 GET /api/blacklist/player
    Then 回應 data 中不包含已解封的紀錄

  # ==========================================
  # Validation — 輸入驗證
  # ==========================================

  @validation
  Scenario: 重複封鎖同一玩家同一聊天室
    Given 黑名單中已有 target="player123"、chatroom_id="baccarat_001" 的有效封鎖
    When 管理員再次送出 POST /api/blacklist/player，帶 target="player123"、chatroom_id="baccarat_001"
    Then 回應狀態碼為 409
    And 回應 error.code 為 "BLACKLIST_ALREADY_BLOCKED"

  @validation
  Scenario: 封鎖時不帶 reason
    When 管理員送出 POST /api/blacklist/player，帶 target="player123"，不帶 reason
    Then 回應狀態碼為 400
    And 回應 error.code 為 "VALIDATION_ERROR"

  @validation
  Scenario: IP 格式錯誤（非法字串）
    When 管理員送出 POST /api/blacklist/ip，帶 target="not-an-ip"
    Then 回應狀態碼為 400
    And 回應 error.code 為 "VALIDATION_ERROR"
    And 回應錯誤訊息包含 IP 格式提示

  @validation
  Scenario: IP 格式錯誤（部分萬用字元不支援）
    When 管理員送出 POST /api/blacklist/ip，帶 target="116.62.*.199"
    Then 回應狀態碼為 400
    And 回應 error.code 為 "VALIDATION_ERROR"

  @validation
  Scenario: 解封不存在的紀錄
    When 管理員送出 DELETE /api/blacklist/player/9999
    Then 回應狀態碼為 404
    And 回應 error.code 為 "BLACKLIST_ENTRY_NOT_FOUND"

  @validation
  Scenario: 解封已解封的紀錄
    Given 黑名單中有一筆 deleted_at IS NOT NULL 的紀錄，id=5
    When 管理員送出 DELETE /api/blacklist/player/5
    Then 回應狀態碼為 404
    And 回應 error.code 為 "BLACKLIST_ENTRY_NOT_FOUND"

  @validation
  Scenario: 使用 ip 路由嘗試解封 player 類型的紀錄
    Given 黑名單中有 id=1、block_type="player" 的封鎖紀錄
    When 管理員送出 DELETE /api/blacklist/ip/1
    Then 回應狀態碼為 404
    And 回應 error.code 為 "BLACKLIST_ENTRY_NOT_FOUND"

  # ==========================================
  # Permissions — 權限驗證
  # ==========================================

  @permissions
  Scenario: general_manager 可封鎖玩家
    Given 已登入的管理員角色為 general_manager
    When 送出 POST /api/blacklist/player
    Then 回應狀態碼為 201

  @permissions
  Scenario: senior_manager 可封鎖 IP
    Given 已登入的管理員角色為 senior_manager
    When 送出 POST /api/blacklist/ip
    Then 回應狀態碼為 201

  @permissions
  Scenario: 未帶 token 無法存取黑名單
    Given 未帶認證 token
    When 送出 GET /api/blacklist/player
    Then 回應狀態碼為 401
    And 回應 error.code 為 "AUTH_MISSING_TOKEN"

  @permissions
  Scenario: 未帶 token 無法封鎖 IP
    Given 未帶認證 token
    When 送出 POST /api/blacklist/ip
    Then 回應狀態碼為 401

  # ==========================================
  # UI — 前端行為
  # ==========================================

  @ui_only
  Scenario: BlacklistPage 依 type 切換查詢不同 API
    Given 使用者在 BlacklistPage，type 選擇器預設為 "Player"
    When 使用者切換 type 選擇器為 "IP"
    Then 頁面重新查詢 GET /api/blacklist/ip
    And 表格資料更新為 IP 封鎖列表

  @ui_only
  Scenario: CreateBlacklistModal 依 type 切換表單欄位
    Given 使用者開啟 CreateBlacklistModal，type 選擇器為 "Player"
    When 使用者切換 type 選擇器為 "IP"
    Then target 輸入欄位清空
    And target 欄位提示文字更新為 IP 格式說明

  @ui_only
  Scenario: ChatMonitoringPage 封鎖玩家按鈕已啟用
    Given 使用者在 ChatMonitoringPage 查看聊天訊息列表
    Then 「封鎖玩家」按鈕為 enabled 狀態（非 disabled）

  @ui_only
  Scenario: 從 ChatMonitoringPage 開啟封鎖 Modal 帶預填資料
    Given 使用者在 ChatMonitoringPage 看到玩家 "player123" 在 "baccarat_001" 的訊息
    When 使用者點擊該訊息列的「封鎖玩家」按鈕
    Then CreateBlacklistModal 開啟
    And Modal 中 type 預填為 "Player"
    And Modal 中 target 預填為 "player123"
    And Modal 中聊天室預填為 "baccarat_001"
