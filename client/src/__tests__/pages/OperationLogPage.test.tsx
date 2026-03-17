import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfigProvider } from 'antd';
import OperationLogPage from '../../pages/OperationLogPage';

// Mock useAuth
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    hasPermission: () => true,
    user: { id: 1, username: 'admin01', role: 'senior_manager' },
    loading: false,
  }),
}));

// Mock API
const mockList = vi.fn();
vi.mock('../../api/operationLog', () => ({
  operationLogApi: {
    list: (...args: unknown[]) => mockList(...args),
  },
}));

const mockData = [
  {
    id: 1,
    operation_type: 'CREATE_ADMIN',
    operator_id: 1,
    operator: 'admin01',
    request: { url: '/api/admins', method: 'POST', payload: { username: 'admin04' } },
    created_at: '2026-03-16 08:30:00',
  },
  {
    id: 2,
    operation_type: 'DELETE_MESSAGE',
    operator_id: 2,
    operator: 'admin02',
    request: { url: '/api/messages/101', method: 'DELETE', payload: {} },
    created_at: '2026-03-15 10:00:00',
  },
  {
    id: 3,
    operation_type: 'BLOCK_PLAYER',
    operator_id: 2,
    operator: 'admin02',
    request: { url: '/api/blacklist', method: 'POST', payload: { playerId: 'player001' } },
    created_at: '2026-03-14 14:20:00',
  },
];

const mockApiResponse = {
  data: {
    success: true,
    data: mockData,
    pagination: { page: 1, pageSize: 20, total: 3, totalPages: 1 },
  },
};

function renderPage() {
  return render(
    <ConfigProvider>
      <OperationLogPage />
    </ConfigProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockList.mockResolvedValue(mockApiResponse);
});

describe('OperationLogPage', () => {
  it('頁面載入後呼叫 API 並渲染表格', async () => {
    renderPage();

    await waitFor(() => {
      expect(mockList).toHaveBeenCalled();
    });

    // 表格應顯示資料
    await waitFor(() => {
      expect(screen.getByText('admin01')).toBeInTheDocument();
      expect(screen.getAllByText('admin02').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('表格包含操作類型、操作者、請求資訊、操作時間欄位', async () => {
    renderPage();

    await waitFor(() => {
      expect(mockList).toHaveBeenCalled();
    });

    // 使用 table header 來確認欄位（在 thead 中尋找）
    const table = screen.getByRole('table');
    const thead = within(table).getAllByRole('columnheader');
    const headerTexts = thead.map((th) => th.textContent);

    expect(headerTexts).toContain('操作類型');
    expect(headerTexts).toContain('操作者');
    expect(headerTexts).toContain('請求資訊');
    expect(headerTexts).toContain('操作時間');
  });

  it('時間顯示為 UTC+8 格式', async () => {
    renderPage();

    await waitFor(() => {
      // 2026-03-16 08:30:00 UTC → 2026-03-16 16:30:00 UTC+8
      expect(screen.getByText('2026-03-16 16:30:00')).toBeInTheDocument();
    });
  });

  it('選擇操作類型篩選 → 點擊查詢後重新呼叫 API', async () => {
    renderPage();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(mockList).toHaveBeenCalledTimes(1);
    });

    // 點擊查詢按鈕
    await user.click(screen.getByText('查詢'));

    await waitFor(() => {
      expect(mockList).toHaveBeenCalledTimes(2);
    });
  });

  it('點擊重置 → 清除篩選條件', async () => {
    renderPage();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(mockList).toHaveBeenCalledTimes(1);
    });

    // 先在搜尋框輸入文字
    const operatorInput = screen.getByPlaceholderText('操作者');
    await user.type(operatorInput, 'admin01');
    expect(operatorInput).toHaveValue('admin01');

    // 點擊重置
    await user.click(screen.getByText('重置'));

    // 輸入框應被清空
    await waitFor(() => {
      expect(operatorInput).toHaveValue('');
    });
  });

  it('分頁元件顯示正確的 total', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('共 3 筆')).toBeInTheDocument();
    });
  });
});
