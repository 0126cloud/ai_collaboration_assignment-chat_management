import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from '../../components/ProtectedRoute';

// Mock useAuth
const mockUseAuth = vi.fn();
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

function renderWithRouter(
  authState: {
    isAuthenticated: boolean;
    loading: boolean;
    permissions?: string[];
  },
  permission?: string,
) {
  mockUseAuth.mockReturnValue({
    isAuthenticated: authState.isAuthenticated,
    loading: authState.loading,
    hasPermission: (code: string) => (authState.permissions || []).includes(code),
  });

  return render(
    <MemoryRouter initialEntries={['/protected']}>
      <Routes>
        <Route path="/login" element={<div>Login Page</div>} />
        <Route path="/" element={<div>Home Page</div>} />
        <Route
          path="/protected"
          element={
            <ProtectedRoute permission={permission}>
              <div>Protected Content</div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute', () => {
  it('loading 中 → 顯示 Spin（不跳轉）', () => {
    renderWithRouter({ isAuthenticated: false, loading: true });
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    // Spin 元件存在
    expect(document.querySelector('.ant-spin')).toBeInTheDocument();
  });

  it('loading 完成 + 未登入 → 導向 /login', () => {
    renderWithRouter({ isAuthenticated: false, loading: false });
    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });

  it('loading 完成 + 已登入但無權限 → 導向首頁', () => {
    renderWithRouter(
      { isAuthenticated: true, loading: false, permissions: [] },
      'broadcast:create',
    );
    expect(screen.getByText('Home Page')).toBeInTheDocument();
  });

  it('loading 完成 + 已登入且有權限 → 渲染子元件', () => {
    renderWithRouter(
      { isAuthenticated: true, loading: false, permissions: ['broadcast:create'] },
      'broadcast:create',
    );
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });
});
