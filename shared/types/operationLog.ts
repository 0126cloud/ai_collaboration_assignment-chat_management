export const OPERATION_TYPES = [
  'CREATE_ADMIN',
  'TOGGLE_ADMIN',
  'UPDATE_ADMIN_ROLE',
  'RESET_PASSWORD',
  'DELETE_MESSAGE',
  'BLOCK_PLAYER',
  'UNBLOCK_PLAYER',
  'BLOCK_IP',
  'UNBLOCK_IP',
  'CREATE_BROADCAST',
  'APPROVE_REPORT',
  'REJECT_REPORT',
  'APPROVE_NICKNAME',
  'REJECT_NICKNAME',
  'CHANGE_PASSWORD',
  'LOGIN',
  'LOGOUT',
] as const;

export type TOperationType = (typeof OPERATION_TYPES)[number];

// 操作類型中文標籤
export const OPERATION_TYPE_LABELS: Record<TOperationType, string> = {
  CREATE_ADMIN: '新增管理員帳號',
  TOGGLE_ADMIN: '啟用/禁用管理員',
  UPDATE_ADMIN_ROLE: '更新管理員角色',
  RESET_PASSWORD: '重設管理員密碼',
  DELETE_MESSAGE: '刪除聊天訊息',
  BLOCK_PLAYER: '封鎖玩家',
  UNBLOCK_PLAYER: '解封玩家',
  BLOCK_IP: '封鎖 IP',
  UNBLOCK_IP: '解封 IP',
  CREATE_BROADCAST: '發送廣播訊息',
  APPROVE_REPORT: '核准玩家檢舉',
  REJECT_REPORT: '駁回玩家檢舉',
  APPROVE_NICKNAME: '核准暱稱變更',
  REJECT_NICKNAME: '駁回暱稱變更',
  CHANGE_PASSWORD: '修改自己密碼',
  LOGIN: '管理員登入',
  LOGOUT: '管理員登出',
};

export type TOperationLogRequest = {
  url: string;
  method: string;
  payload: Record<string, unknown>;
};

export type TOperationLogItem = {
  id: number;
  operation_type: TOperationType;
  operator_id: number;
  operator: string;
  request: TOperationLogRequest;
  created_at: string;
};

export type TOperationLogQuery = {
  page?: number;
  pageSize?: number;
  operationType?: TOperationType;
  operator?: string;
  startDate?: string;
  endDate?: string;
};
