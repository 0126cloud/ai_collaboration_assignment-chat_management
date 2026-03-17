import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import LoginPage from '../../pages/LoginPage';

// Mock useAuth
const mockLogin = vi.fn();
const mockUseAuth = vi.fn();

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

function renderLoginPage() {
  return render(
    <ConfigProvider>
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<div>Home Page</div>} />
        </Routes>
      </MemoryRouter>
    </ConfigProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({
    login: mockLogin,
    isAuthenticated: false,
  });
});

describe('LoginPage', () => {
  it('渲染登入表單（username、password、submit button）', () => {
    renderLoginPage();
    expect(screen.getByPlaceholderText('帳號')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('密碼')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /登/i })).toBeInTheDocument();
  });

  it('空白送出 → 顯示驗證錯誤', async () => {
    renderLoginPage();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /登/i }));

    await waitFor(() => {
      const errorElements = document.querySelectorAll('.ant-form-item-explain-error');
      expect(errorElements.length).toBeGreaterThan(0);
    });
  });

  it('填入帳密送出 → 呼叫 login API', async () => {
    mockLogin.mockResolvedValue(undefined);
    renderLoginPage();
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText('帳號'), 'admin01');
    await user.type(screen.getByPlaceholderText('密碼'), '123456');
    await user.click(screen.getByRole('button', { name: /登/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('admin01', '123456');
    });
  });

  it('API 失敗 → 顯示錯誤訊息', async () => {
    mockLogin.mockRejectedValue({
      response: {
        data: { error: { message: '帳號或密碼錯誤' } },
      },
    });
    renderLoginPage();
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText('帳號'), 'admin01');
    await user.type(screen.getByPlaceholderText('密碼'), 'wrong');
    await user.click(screen.getByRole('button', { name: /登/i }));

    await waitFor(() => {
      expect(screen.getByText('帳號或密碼錯誤')).toBeInTheDocument();
    });
  });

  it('已登入 → 自動導向 /（不顯示表單）', () => {
    mockUseAuth.mockReturnValue({
      login: mockLogin,
      isAuthenticated: true,
    });
    renderLoginPage();
    expect(screen.getByText('Home Page')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('帳號')).not.toBeInTheDocument();
  });
});
