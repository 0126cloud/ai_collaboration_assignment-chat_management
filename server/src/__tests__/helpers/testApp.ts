import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { Knex } from 'knex';
import { AppError } from '../../utils/appError';
import { ErrorCode } from '../../utils/errorCodes';
import { ResponseHelper } from '../../utils/responseHelper';
import { createAuthRoutes } from '../../module/auth/route';
import { createAdminRoutes } from '../../module/admin/route';
import { createOperationLogRoutes } from '../../module/operationLog/route';
import { createChatroomRoutes } from '../../module/chatroom/route';
import { createChatMessageRoutes } from '../../module/chatMessage/route';
import { createBlacklistRoutes } from '../../module/blacklist/route';
import { createNicknameReviewRoutes } from '../../module/nicknameReview/route';
import { createReportRoutes } from '../../module/report/route';
import { operationLogger } from '../../middleware/operationLogger';

export function createTestApp(db: Knex) {
  const app = express();

  app.use(express.json());
  app.use(cookieParser());
  app.use(cors({ credentials: true }));

  // 將 db 掛載到 app.locals，供 service 使用
  app.locals.db = db;

  // operationLogger afterware
  app.use(operationLogger);

  // Health check
  app.get('/api/health', (_req: Request, res: Response) => {
    ResponseHelper.success(res, { status: 'ok' });
  });

  // Routes
  app.use('/api/auth', createAuthRoutes(db));
  app.use('/api/admins', createAdminRoutes(db));
  app.use('/api/operation-logs', createOperationLogRoutes(db));
  app.use('/api/chatrooms', createChatroomRoutes(db));
  app.use('/api/chat_messages', createChatMessageRoutes(db));
  app.use('/api/blacklist', createBlacklistRoutes(db));
  app.use('/api/nickname_reviews', createNicknameReviewRoutes(db));
  app.use('/api/reports', createReportRoutes(db));

  return app;
}

// 統一 error handler（需在掛載 routes 後呼叫）
export function applyErrorHandlers(app: express.Express) {
  // 404 handler
  app.use((_req: Request, _res: Response, next: NextFunction) => {
    next(new AppError(ErrorCode.INTERNAL_SERVER_ERROR, '找不到該路由'));
  });

  // 統一 error handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) {
      return ResponseHelper.error(res, err);
    }
    const unknownError = new AppError(ErrorCode.INTERNAL_SERVER_ERROR);
    return ResponseHelper.error(res, unknownError);
  });
}
