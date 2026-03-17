import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import AdminLayout from '../../layouts/AdminLayout';

// Mock useAuth
const mockUseAuth = vi.fn();
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

const seniorPermissions = [
  'chat:read',
  'blacklist:read',
  'chatroom:read',
  'broadcast:read',
  'operation_log:read',
  'report:read',
  'nickname:read',
  'admin:read',
];

const generalPermissions = [
  'chat:read',
  'blacklist:read',
  'chatroom:read',
  'operation_log:read',
  'report:read',
  'nickname:read',
];

function renderLayout(permissions: string[]) {
  mockUseAuth.mockReturnValue({
    user: { id: 1, username: 'admin01', role: 'test' },
    hasPermission: (code: string) => permissions.includes(code),
    logout: vi.fn(),
  });

  return render(
    <ConfigProvider>
      <MemoryRouter>
        <AdminLayout />
      </MemoryRouter>
    </ConfigProvider>,
  );
}

describe('AdminLayout Sidebar', () => {
  it('senior_manager → 顯示 8 個選單項目', () => {
    renderLayout(seniorPermissions);

    expect(screen.getByText('聊天監控')).toBeInTheDocument();
    expect(screen.getByText('黑名單管理')).toBeInTheDocument();
    expect(screen.getByText('聊天室')).toBeInTheDocument();
    expect(screen.getByText('系統廣播')).toBeInTheDocument();
    expect(screen.getByText('操作紀錄')).toBeInTheDocument();
    expect(screen.getByText('玩家檢舉')).toBeInTheDocument();
    expect(screen.getByText('暱稱審核')).toBeInTheDocument();
    expect(screen.getByText('帳號管理')).toBeInTheDocument();
  });

  it('general_manager → 顯示 6 個選單項目（不含 broadcast、admin）', () => {
    renderLayout(generalPermissions);

    expect(screen.getByText('聊天監控')).toBeInTheDocument();
    expect(screen.getByText('黑名單管理')).toBeInTheDocument();
    expect(screen.getByText('聊天室')).toBeInTheDocument();
    expect(screen.queryByText('系統廣播')).not.toBeInTheDocument();
    expect(screen.getByText('操作紀錄')).toBeInTheDocument();
    expect(screen.getByText('玩家檢舉')).toBeInTheDocument();
    expect(screen.getByText('暱稱審核')).toBeInTheDocument();
    expect(screen.queryByText('帳號管理')).not.toBeInTheDocument();
  });
});
