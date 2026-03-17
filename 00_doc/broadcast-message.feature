Feature: 系統廣播訊息

  Background:
    Given 系統中已有聊天室 "baccarat_001"、"blackjack_001"、"roulette_001"
    And 系統中已有 senior_manager 帳號 "admin01"
    And 系統中已有 general_manager 帳號 "admin02"

  @happy_path
  Scenario: 高級管理員發送廣播至單一聊天室
    Given 我以 "admin01"（senior_manager）身份登入
    When 我發送廣播訊息 "Welcome bonus event starts now!" 至聊天室 "baccarat_001"
    And 設定顯示時長為 3600 秒
    And 設定開始時間為 5 分鐘後
    Then API 回傳狀態碼 201
    And 回應資料包含 "message": "Welcome bonus event starts now!"
    And 回應資料包含 "chatroom_id": "baccarat_001"
    And 回應資料包含 "status": "scheduled"
    And 操作紀錄中新增一筆 operationType = "SEND_BROADCAST" 的紀錄

  @happy_path
  Scenario: 高級管理員發送廣播至所有聊天室
    Given 我以 "admin01"（senior_manager）身份登入
    When 我發送廣播訊息 "System maintenance in 10 minutes" 至 "all"
    And 設定顯示時長為 600 秒
    And 設定開始時間為現在
    Then API 回傳狀態碼 201
    And 回應資料包含 "chatroom_id": "all"
    And 回應資料包含 "status": "active"

  @happy_path
  Scenario: 查看廣播列表並顯示各種狀態
    Given 系統中有 3 筆廣播：scheduled 狀態 1 筆、active 狀態 1 筆、expired 狀態 1 筆
    And 我以 "admin01"（senior_manager）身份登入
    When 我查詢 GET /api/broadcasts
    Then API 回傳狀態碼 200
    And 回應資料中每筆廣播包含 "status" 欄位
    And 未開始的廣播 status 為 "scheduled"
    And 廣播中的廣播 status 為 "active"
    And 已過期的廣播 status 為 "expired"
    And 回應包含 pagination 資訊

  @happy_path
  Scenario: 依狀態篩選廣播列表
    Given 系統中有廣播資料（各種狀態）
    And 我以 "admin01"（senior_manager）身份登入
    When 我查詢 GET /api/broadcasts?status=active
    Then API 回傳狀態碼 200
    And 回應資料中所有廣播的 status 均為 "active"

  @happy_path
  Scenario: 高級管理員下架廣播
    Given 系統中有一筆 scheduled 狀態的廣播（id = 1）
    And 我以 "admin01"（senior_manager）身份登入
    When 我呼叫 DELETE /api/broadcasts/1
    Then API 回傳狀態碼 200
    And 回應資料包含 "message": "廣播已下架"
    And 操作紀錄中新增一筆 operationType = "DELETE_BROADCAST" 的紀錄
    And 後續查詢廣播列表時該廣播不再出現

  @permissions
  Scenario: 一般管理員無法發送廣播
    Given 我以 "admin02"（general_manager）身份登入
    When 我嘗試發送廣播訊息 "Test broadcast" 至 "all"
    Then API 回傳狀態碼 403
    And 回應包含 error code "FORBIDDEN_INSUFFICIENT_PERMISSIONS"

  @permissions
  Scenario: 一般管理員無法查看廣播列表
    Given 我以 "admin02"（general_manager）身份登入
    When 我查詢 GET /api/broadcasts
    Then API 回傳狀態碼 403
    And 回應包含 error code "FORBIDDEN_INSUFFICIENT_PERMISSIONS"

  @permissions
  Scenario: 一般管理員無法下架廣播
    Given 系統中有一筆廣播（id = 1）
    And 我以 "admin02"（general_manager）身份登入
    When 我呼叫 DELETE /api/broadcasts/1
    Then API 回傳狀態碼 403
    And 回應包含 error code "FORBIDDEN_INSUFFICIENT_PERMISSIONS"

  @validation
  Scenario: 發送廣播時缺少必填欄位 message
    Given 我以 "admin01"（senior_manager）身份登入
    When 我發送廣播請求但不包含 "message" 欄位
    Then API 回傳狀態碼 400
    And 回應包含 error code "VALIDATION_ERROR"

  @validation
  Scenario: 發送廣播時 duration 為非正整數
    Given 我以 "admin01"（senior_manager）身份登入
    When 我發送廣播請求，duration 為 0
    Then API 回傳狀態碼 400
    And 回應包含 error code "VALIDATION_ERROR"

  @validation
  Scenario: 發送廣播時 duration 為負數
    Given 我以 "admin01"（senior_manager）身份登入
    When 我發送廣播請求，duration 為 -60
    Then API 回傳狀態碼 400
    And 回應包含 error code "VALIDATION_ERROR"

  @validation
  Scenario: 下架不存在的廣播
    Given 我以 "admin01"（senior_manager）身份登入
    When 我呼叫 DELETE /api/broadcasts/99999
    Then API 回傳狀態碼 404
    And 回應包含 error code "BROADCAST_NOT_FOUND"

  @validation
  Scenario: 下架已下架的廣播
    Given 系統中有一筆已下架的廣播（id = 2）
    And 我以 "admin01"（senior_manager）身份登入
    When 我呼叫 DELETE /api/broadcasts/2
    Then API 回傳狀態碼 404
    And 回應包含 error code "BROADCAST_NOT_FOUND"
