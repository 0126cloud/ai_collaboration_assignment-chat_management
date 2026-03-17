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

// 初始化 DB 並掛載到 app.locals
const db = initDatabase();
app.locals.db = db;

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  ResponseHelper.success(res, { status: 'ok' });
});

// Routes
app.use('/api/auth', createAuthRoutes(db));
app.use('/api/admins', createAdminRoutes(db));

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
