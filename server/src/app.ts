import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { AppError } from './utils/appError';
import { ErrorCode } from './utils/errorCodes';
import { ResponseHelper } from './utils/responseHelper';
import { initDatabase } from './config/database';
import { createAuthRoutes } from './module/auth/route';
import { createAdminRoutes } from './module/admin/route';
import { createOperationLogRoutes } from './module/operationLog/route';
import { createChatroomRoutes } from './module/chatroom/route';
import { createChatMessageRoutes } from './module/chatMessage/route';
import { createBlacklistRoutes } from './module/blacklist/route';
import { createReportRoutes } from './module/report/route';
import { createBroadcastRoutes } from './module/broadcast/route';
import { createPlayerRoutes } from './module/player/route';
import { operationLogger } from './middleware/operationLogger';

dotenv.config();

const app = express();

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  }),
);

// Encoding middleware — 確保所有 JSON response 的 Content-Type 帶有 charset
const encoding = process.env.ENCODING ?? 'utf-8';
app.use((_req: Request, res: Response, next: NextFunction) => {
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    res.setHeader('Content-Type', `application/json; charset=${encoding}`);
    return originalJson(body);
  };
  next();
});

// 初始化 DB 並掛載到 app.locals
const db = initDatabase();
app.locals.db = db;

// operationLogger afterware — 在路由之前掛載，監聽 res.on('finish') 寫入操作紀錄
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
app.use('/api/reports', createReportRoutes(db));
app.use('/api/broadcasts', createBroadcastRoutes(db));
app.use('/api/players', createPlayerRoutes(db));

// 404 handler
app.use((_req: Request, _res: Response, next: NextFunction) => {
  next(new AppError(ErrorCode.INTERNAL_SERVER_ERROR, '找不到該路由'));
});

// 統一 error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack);

  if (err instanceof AppError) {
    return ResponseHelper.error(res, err);
  }

  // 未知錯誤
  const unknownError = new AppError(ErrorCode.INTERNAL_SERVER_ERROR);
  return ResponseHelper.error(res, unknownError);
});

export default app;
