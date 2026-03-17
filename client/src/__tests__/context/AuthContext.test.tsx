import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../../context/AuthContext';
import type { ReactNode } from 'react';

// Mock authApi
vi.mock('../../api/auth', () => ({
  authApi: {
    login: vi.fn(),
    getMe: vi.fn(),
    logout: vi.fn(),
    getPermissions: vi.fn(),
  },
}));

import { authApi } from '../../api/auth';

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AuthContext', () => {
  it('初始化 → 呼叫 /api/auth/me → 成功恢復 user + permissions', async () => {
    vi.mocked(authApi.getMe).mockResolvedValue({
      data: {
        success: true,
        data: {
          user: { id: 1, username: 'admin01', role: 'senior_manager' },
          permissions: ['chat:read', 'admin:create'],
        },
      },
    } as ReturnType<typeof authApi.getMe> extends Promise<infer R> ? R : never);

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user?.username).toBe('admin01');
    expect(result.current.permissions).toEqual(['chat:read', 'admin:create']);
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('初始化 → /api/auth/me 回傳 401 → 保持未登入，loading = false', async () => {
    vi.mocked(authApi.getMe).mockRejectedValue({ response: { status: 401 } });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('login 成功 → user + permissions 正確設定', async () => {
    // 初始化 /me 回傳 401
    vi.mocked(authApi.getMe).mockRejectedValueOnce({ response: { status: 401 } });

    vi.mocked(authApi.login).mockResolvedValue({
      data: {
        success: true,
        data: {
          token: 'test-token',
          user: { id: 1, username: 'admin01', role: 'senior_manager' },
        },
      },
    } as ReturnType<typeof authApi.login> extends Promise<infer R> ? R : never);

    // login 之後呼叫 getMe
    vi.mocked(authApi.getMe).mockResolvedValue({
      data: {
        success: true,
        data: {
          user: { id: 1, username: 'admin01', role: 'senior_manager' },
          permissions: ['chat:read', 'admin:create'],
        },
      },
    } as ReturnType<typeof authApi.getMe> extends Promise<infer R> ? R : never);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.login('admin01', '123456');
    });

    expect(result.current.user).toEqual({
      id: 1,
      username: 'admin01',
      role: 'senior_manager',
    });
    expect(result.current.permissions).toEqual(['chat:read', 'admin:create']);
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('logout → 呼叫 /api/auth/logout → 清除 user + permissions', async () => {
    vi.mocked(authApi.getMe).mockResolvedValue({
      data: {
        success: true,
        data: {
          user: { id: 1, username: 'admin01', role: 'senior_manager' },
          permissions: ['chat:read'],
        },
      },
    } as ReturnType<typeof authApi.getMe> extends Promise<infer R> ? R : never);

    vi.mocked(authApi.logout).mockResolvedValue({
      data: { success: true, data: { message: '登出成功' } },
    } as ReturnType<typeof authApi.logout> extends Promise<infer R> ? R : never);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.user).toBeNull();
    expect(result.current.permissions).toEqual([]);
    expect(result.current.isAuthenticated).toBe(false);
    expect(authApi.logout).toHaveBeenCalled();
  });

  it('hasPermission → 正確檢查權限', async () => {
    vi.mocked(authApi.getMe).mockResolvedValue({
      data: {
        success: true,
        data: {
          user: { id: 1, username: 'admin01', role: 'senior_manager' },
          permissions: ['chat:read', 'admin:create'],
        },
      },
    } as ReturnType<typeof authApi.getMe> extends Promise<infer R> ? R : never);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.hasPermission('chat:read')).toBe(true);
    expect(result.current.hasPermission('admin:create')).toBe(true);
    expect(result.current.hasPermission('broadcast:create')).toBe(false);
  });

  it('loading 狀態：初始化期間為 true，完成後為 false', async () => {
    let resolveGetMe: (value: unknown) => void;
    vi.mocked(authApi.getMe).mockImplementation(
      () => new Promise((resolve) => (resolveGetMe = resolve)),
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.loading).toBe(true);

    await act(async () => {
      resolveGetMe!({
        data: {
          success: true,
          data: {
            user: { id: 1, username: 'admin01', role: 'senior_manager' },
            permissions: [],
          },
        },
      });
    });

    expect(result.current.loading).toBe(false);
  });
});
