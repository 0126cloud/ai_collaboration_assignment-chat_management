import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from '../utils/appError';
import { ErrorCode } from '../utils/errorCodes';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';

export interface IAuthPayload {
  id: number;
  username: string;
  role: string;
}

// 擴展 Express Request 型別
declare module 'express-serve-static-core' {
  interface Request {
    user?: IAuthPayload;
  }
}

export function auth(req: Request, _res: Response, next: NextFunction) {
  // 優先讀取 cookie，fallback 到 Authorization header
  let token: string | undefined = req.cookies?.token;

  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
  }

  if (!token) {
    throw new AppError(ErrorCode.AUTH_MISSING_TOKEN);
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as IAuthPayload;
    req.user = decoded;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new AppError(ErrorCode.AUTH_TOKEN_EXPIRED);
    }
    throw new AppError(ErrorCode.AUTH_INVALID_TOKEN);
  }
}
