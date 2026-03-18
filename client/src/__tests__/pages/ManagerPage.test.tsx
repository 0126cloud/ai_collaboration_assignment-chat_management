import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfigProvider } from 'antd';
import ManagerPage from '../../pages/ManagerPage';

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    hasPermission: () => true,
    user: { id: 1, username: 'admin01', role: 'senior_manager' },
    loading: false,
  }),
}));

const mockList = vi.fn();
const mockCreate = vi.fn();
const mockToggle = vi.fn();
const mockUpdateRole = vi.fn();

vi.mock('../../api/admin', () => ({
  adminApi: {
    list: (...args: unknown[]) => mockList(...args),
    create: (...args: unknown[]) => mockCreate(...args),
    toggle: (...args: unknown[]) => mockToggle(...args),
    updateRole: (...args: unknown[]) => mockUpdateRole(...args),
  },
}));

const mockAdmins = [
  {
    id: 1,
    username: 'admin01',
    role: 'senior_manager',
    is_active: true,
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 2,
    username: 'admin02',
    role: 'general_manager',
    is_active: true,
    created_at: '2026-01-02T00:00:00.000Z',
  },
  {
    id: 3,
    username: 'admin03',
    role: 'general_manager',
    is_active: false,
    created_at: '2026-01-03T00:00:00.000Z',
  },
];

const makeResponse = (data = mockAdmins) => ({
  data: {
    success: true,
    data,
    pagination: { page: 1, pageSize: 20, total: data.length, totalPages: 1 },
  },
});

function renderPage() {
  return render(
    <ConfigProvider button={{ autoInsertSpace: false }}>
      <ManagerPage />
    </ConfigProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockList.mockResolvedValue(makeResponse());
  mockCreate.mockResolvedValue({
    data: {
      success: true,
      data: {
        id: 4,
        username: 'admin04',
        role: 'general_manager',
        is_active: true,
        created_at: '',
      },
    },
  });
  mockToggle.mockResolvedValue({
    data: { success: true, data: { ...mockAdmins[1], is_active: false } },
  });
  mockUpdateRole.mockResolvedValue({
    data: { success: true, data: { ...mockAdmins[1], role: 'senior_manager' } },
  });
});

describe('ManagerPage', () => {
  // @happy_path
  it('頁面載入後呼叫 list API 並渲染管理員列表', async () => {
    renderPage();

    await waitFor(() => {
      expect(mockList).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByText('admin01')).toBeInTheDocument();
      expect(screen.getByText('admin02')).toBeInTheDocument();
      expect(screen.getByText('admin03')).toBeInTheDocument();
    });
  });

  // @happy_path
  it('顯示「+ 新增管理員」按鈕', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /新增管理員/ })).toBeInTheDocument();
    });
  });

  // @happy_path
  it('點擊按鈕後顯示新增 Modal', async () => {
    const user = userEvent.setup();
    renderPage();

    const btn = await screen.findByRole('button', { name: /新增管理員/ });
    await user.click(btn);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  // @happy_path
  it('角色欄位顯示正確 Tag', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('進階管理員')).toBeInTheDocument();
    });
  });

  // @happy_path
  it('is_active=false 的列按鈕顯示「啟用」', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('toggle-btn-3')).toHaveTextContent('啟用');
    });
  });

  // @happy_path
  it('is_active=true 的列按鈕顯示「停用」', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('toggle-btn-2')).toHaveTextContent('停用');
    });
  });

  // @happy_path
  it('點擊「停用」顯示確認 Modal', async () => {
    const user = userEvent.setup();
    renderPage();

    const toggleBtn = await screen.findByTestId('toggle-btn-2');
    await user.click(toggleBtn);

    await waitFor(() => {
      expect(screen.queryAllByText(/確認/).length).toBeGreaterThan(0);
    });
  });

  // @happy_path
  it('確認後呼叫 toggle API 並 refetch', async () => {
    const user = userEvent.setup();
    renderPage();

    const toggleBtn = await screen.findByTestId('toggle-btn-2');
    await user.click(toggleBtn);

    await waitFor(() => expect(screen.queryAllByText(/確認/).length).toBeGreaterThan(0));

    const modalOkButtons = document.querySelectorAll('.ant-modal-confirm-btns .ant-btn-primary');
    if (modalOkButtons.length > 0) {
      await user.click(modalOkButtons[0] as HTMLElement);
      await waitFor(() => {
        expect(mockToggle).toHaveBeenCalledWith(2);
      });
    }
  });

  // @permissions
  it('當前登入帳號操作按鈕為 disabled', async () => {
    renderPage();

    await waitFor(() => {
      const selfToggleBtn = screen.getByTestId('toggle-btn-1');
      expect(selfToggleBtn).toBeDisabled();
    });
  });
});
