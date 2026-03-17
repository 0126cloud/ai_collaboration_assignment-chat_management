export enum ErrorCode {
  // 通用
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',

  // 認證
  AUTH_MISSING_TOKEN = 'AUTH_MISSING_TOKEN',
  AUTH_INVALID_TOKEN = 'AUTH_INVALID_TOKEN',
  AUTH_TOKEN_EXPIRED = 'AUTH_TOKEN_EXPIRED',
  AUTH_INVALID_CREDENTIALS = 'AUTH_INVALID_CREDENTIALS',
  AUTH_ACCOUNT_DISABLED = 'AUTH_ACCOUNT_DISABLED',
  AUTH_OLD_PASSWORD_INCORRECT = 'AUTH_OLD_PASSWORD_INCORRECT',

  // 授權
  FORBIDDEN_INSUFFICIENT_PERMISSIONS = 'FORBIDDEN_INSUFFICIENT_PERMISSIONS',

  // 管理員管理
  ADMIN_USERNAME_DUPLICATE = 'ADMIN_USERNAME_DUPLICATE',

  // 聊天訊息
  CHAT_MESSAGE_NOT_FOUND = 'CHAT_MESSAGE_NOT_FOUND',

  // 黑名單
  BLACKLIST_ALREADY_BLOCKED = 'BLACKLIST_ALREADY_BLOCKED',
  BLACKLIST_ENTRY_NOT_FOUND = 'BLACKLIST_ENTRY_NOT_FOUND',
}

export const ERROR_MESSAGES: Record<ErrorCode, { statusCode: number; message: string }> = {
  [ErrorCode.VALIDATION_ERROR]: { statusCode: 400, message: '輸入資料驗證失敗' },
  [ErrorCode.INTERNAL_SERVER_ERROR]: { statusCode: 500, message: '伺服器內部錯誤' },
  [ErrorCode.AUTH_MISSING_TOKEN]: { statusCode: 401, message: '未提供認證 Token' },
  [ErrorCode.AUTH_INVALID_TOKEN]: { statusCode: 401, message: '無效的認證 Token' },
  [ErrorCode.AUTH_TOKEN_EXPIRED]: { statusCode: 401, message: '認證 Token 已過期' },
  [ErrorCode.AUTH_INVALID_CREDENTIALS]: { statusCode: 401, message: '帳號或密碼錯誤' },
  [ErrorCode.AUTH_ACCOUNT_DISABLED]: { statusCode: 403, message: '帳號已被停用' },
  [ErrorCode.AUTH_OLD_PASSWORD_INCORRECT]: { statusCode: 400, message: '舊密碼不正確' },
  [ErrorCode.FORBIDDEN_INSUFFICIENT_PERMISSIONS]: { statusCode: 403, message: '權限不足' },
  [ErrorCode.ADMIN_USERNAME_DUPLICATE]: { statusCode: 409, message: '帳號已存在' },
  [ErrorCode.CHAT_MESSAGE_NOT_FOUND]: { statusCode: 404, message: '訊息不存在或已刪除' },
  [ErrorCode.BLACKLIST_ALREADY_BLOCKED]: { statusCode: 409, message: '該目標已在封鎖名單中' },
  [ErrorCode.BLACKLIST_ENTRY_NOT_FOUND]: { statusCode: 404, message: '封鎖紀錄不存在或已解封' },
};
