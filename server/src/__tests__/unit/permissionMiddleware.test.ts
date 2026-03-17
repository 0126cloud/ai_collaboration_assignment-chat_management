import { describe, it, expect, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { requirePermission } from '../../middleware/permission';
import { ErrorCode } from '../../utils/errorCodes';
import { AppError } from '../../utils/appError';

function createMockReq(role: string): Partial<Request> {
  return {
    user: { id: 1, username: 'test', role },
  };
}

function createMockRes(): Partial<Response> {
  return {};
}

describe('Permission Middleware', () => {
  it('general_manager 存取 chat:read → 通過', () => {
    const req = createMockReq('general_manager') as Request;
    const res = createMockRes() as Response;
    const next = vi.fn();

    const middleware = requirePermission('chat:read');
    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('general_manager 存取 broadcast:create → FORBIDDEN', () => {
    const req = createMockReq('general_manager') as Request;
    const res = createMockRes() as Response;
    const next = vi.fn();

    const middleware = requirePermission('broadcast:create');

    expect(() => middleware(req, res, next)).toThrow(AppError);
    try {
      middleware(req, res, next);
    } catch (err) {
      expect((err as AppError).code).toBe(ErrorCode.FORBIDDEN_INSUFFICIENT_PERMISSIONS);
    }
  });

  it('senior_manager 存取 broadcast:create → 通過', () => {
    const req = createMockReq('senior_manager') as Request;
    const res = createMockRes() as Response;
    const next = vi.fn();

    const middleware = requirePermission('broadcast:create');
    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('多權限 AND 邏輯檢查 — 全部擁有則通過', () => {
    const req = createMockReq('senior_manager') as Request;
    const res = createMockRes() as Response;
    const next = vi.fn();

    const middleware = requirePermission('admin:create', 'broadcast:create');
    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('多權限 AND 邏輯檢查 — 缺少部分則 FORBIDDEN', () => {
    const req = createMockReq('general_manager') as Request;
    const res = createMockRes() as Response;
    const next = vi.fn();

    const middleware = requirePermission('chat:read', 'broadcast:create');

    expect(() => middleware(req, res, next)).toThrow(AppError);
    try {
      middleware(req, res, next);
    } catch (err) {
      expect((err as AppError).code).toBe(ErrorCode.FORBIDDEN_INSUFFICIENT_PERMISSIONS);
    }
  });

  it('未知 role → FORBIDDEN', () => {
    const req = createMockReq('unknown_role') as Request;
    const res = createMockRes() as Response;
    const next = vi.fn();

    const middleware = requirePermission('chat:read');

    expect(() => middleware(req, res, next)).toThrow(AppError);
    try {
      middleware(req, res, next);
    } catch (err) {
      expect((err as AppError).code).toBe(ErrorCode.FORBIDDEN_INSUFFICIENT_PERMISSIONS);
    }
  });
});
