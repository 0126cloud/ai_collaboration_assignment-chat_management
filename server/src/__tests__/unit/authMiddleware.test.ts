import { describe, it, expect, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { auth } from '../../middleware/auth';
import { ErrorCode } from '../../utils/errorCodes';
import { AppError } from '../../utils/appError';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';

function createMockReq(authHeader?: string): Partial<Request> {
  return {
    headers: authHeader ? { authorization: authHeader } : {},
  };
}

function createMockRes(): Partial<Response> {
  return {};
}

describe('Auth Middleware', () => {
  const next: NextFunction = vi.fn();

  it('無 Authorization header → AUTH_MISSING_TOKEN', () => {
    const req = createMockReq() as Request;
    const res = createMockRes() as Response;

    expect(() => auth(req, res, next)).toThrow(AppError);
    try {
      auth(req, res, next);
    } catch (err) {
      expect((err as AppError).code).toBe(ErrorCode.AUTH_MISSING_TOKEN);
    }
  });

  it('Authorization 格式不是 Bearer → AUTH_MISSING_TOKEN', () => {
    const req = createMockReq('Basic abc123') as Request;
    const res = createMockRes() as Response;

    expect(() => auth(req, res, next)).toThrow(AppError);
    try {
      auth(req, res, next);
    } catch (err) {
      expect((err as AppError).code).toBe(ErrorCode.AUTH_MISSING_TOKEN);
    }
  });

  it('無效 token → AUTH_INVALID_TOKEN', () => {
    const req = createMockReq('Bearer invalid-token') as Request;
    const res = createMockRes() as Response;

    expect(() => auth(req, res, next)).toThrow(AppError);
    try {
      auth(req, res, next);
    } catch (err) {
      expect((err as AppError).code).toBe(ErrorCode.AUTH_INVALID_TOKEN);
    }
  });

  it('過期 token → AUTH_TOKEN_EXPIRED', () => {
    const expiredToken = jwt.sign(
      { id: 1, username: 'admin01', role: 'senior_manager' },
      JWT_SECRET,
      { expiresIn: '0s' },
    );
    const req = createMockReq(`Bearer ${expiredToken}`) as Request;
    const res = createMockRes() as Response;

    // 等待 token 確實過期
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(() => auth(req, res, next)).toThrow(AppError);
        try {
          auth(req, res, next);
        } catch (err) {
          expect((err as AppError).code).toBe(ErrorCode.AUTH_TOKEN_EXPIRED);
        }
        resolve();
      }, 1100);
    });
  });

  it('有效 token → req.user 正確設定，呼叫 next()', () => {
    const payload = { id: 1, username: 'admin01', role: 'senior_manager' };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '4h' });
    const req = createMockReq(`Bearer ${token}`) as Request;
    const res = createMockRes() as Response;
    const mockNext = vi.fn();

    auth(req, res, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect(req.user?.id).toBe(payload.id);
    expect(req.user?.username).toBe(payload.username);
    expect(req.user?.role).toBe(payload.role);
  });
});
