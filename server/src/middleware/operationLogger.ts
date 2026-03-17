import { Request, Response, NextFunction } from 'express';
import { Knex } from 'knex';

// 敏感欄位過濾清單
const SENSITIVE_FIELDS = ['password', 'newPassword', 'oldPassword', 'password_hash'];

function sanitizePayload(body: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...body };
  for (const field of SENSITIVE_FIELDS) {
    if (field in sanitized) {
      sanitized[field] = '***';
    }
  }
  return sanitized;
}

export function operationLogger(req: Request, res: Response, next: NextFunction): void {
  res.on('finish', async () => {
    const logData = res.locals.operationLog;

    // 僅在有設定 operationLog 且回應成功時寫入
    if (!logData || res.statusCode < 200 || res.statusCode >= 300) {
      return;
    }

    try {
      const db: Knex = req.app.locals.db;
      await db('operation_logs').insert({
        operation_type: logData.operationType,
        // operator 來源優先順序：res.locals.operationLog > req.user
        // LOGIN 路由不經 auth middleware，需由 controller 手動帶入
        operator_id: logData.operatorId ?? req.user?.id,
        operator: logData.operator ?? req.user?.username,
        request: JSON.stringify({
          url: req.originalUrl,
          method: req.method,
          payload: sanitizePayload(req.body || {}),
        }),
      });
    } catch (error) {
      // 靜默處理，不影響已送出的回應
      console.error('[operationLogger] 寫入失敗:', error);
    }
  });

  next();
}

export { sanitizePayload };
