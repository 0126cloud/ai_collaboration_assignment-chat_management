import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { authApi } from '../api/auth';

interface IUser {
  id: number;
  username: string;
  role: string;
}

interface IAuthContext {
  user: IUser | null;
  permissions: string[];
  isAuthenticated: boolean;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (code: string) => boolean;
}

const AuthContext = createContext<IAuthContext | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<IUser | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const isAuthenticated = !!user;

  const login = useCallback(async (username: string, password: string) => {
    await authApi.login({ username, password });

    // 透過 /me 取得 user + permissions
    const meRes = await authApi.getMe();
    setUser(meRes.data.data.user);
    setPermissions(meRes.data.data.permissions);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // 即使 API 失敗也清除狀態
    }
    setUser(null);
    setPermissions([]);
  }, []);

  const hasPermission = useCallback((code: string) => permissions.includes(code), [permissions]);

  // 初始化：呼叫 /me 恢復登入狀態
  useEffect(() => {
    authApi
      .getMe()
      .then((res) => {
        setUser(res.data.data.user);
        setPermissions(res.data.data.permissions);
      })
      .catch(() => {
        // cookie 無效或未登入，保持未登入狀態
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        permissions,
        isAuthenticated,
        loading,
        login,
        logout,
        hasPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): IAuthContext {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
