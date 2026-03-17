import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfigProvider } from 'antd';
import ChatroomPage from '../../pages/ChatroomPage';

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
vi.mock('../../api/chatroom', () => ({
  chatroomApi: {
    list: (...args: unknown[]) => mockList(...args),
  },
}));

const mockData = [
  {
    id: 'baccarat_001',
    name: 'Baccarat Room 1',
    online_user_count: 120,
    created_at: '2026-03-16 08:00:00',
    updated_at: '2026-03-16 08:00:00',
  },
  {
    id: 'blackjack_001',
    name: 'Blackjack Room 1',
    online_user_count: 64,
    created_at: '2026-03-15 10:00:00',
    updated_at: '2026-03-15 10:00:00',
  },
  {
    id: 'slots_001',
    name: 'Slots Room 1',
    online_user_count: 200,
    created_at: '2026-03-14 12:00:00',
    updated_at: '2026-03-14 12:00:00',
  },
];

const mockApiResponse = {
  data: {
    success: true,
    data: mockData,
    pagination: { page: 1, pageSize: 30, total: 3, totalPages: 1 },
  },
};

function renderPage() {
  return render(
    <ConfigProvider>
      <ChatroomPage />
    </ConfigProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockList.mockResolvedValue(mockApiResponse);
});

describe('ChatroomPage', () => {
  it('頁面載入後呼叫 API 並渲染表格', async () => {
    renderPage();

    await waitFor(() => {
      expect(mockList).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByText('Baccarat Room 1')).toBeInTheDocument();
      expect(screen.getByText('Blackjack Room 1')).toBeInTheDocument();
    });
  });

  it('表格包含聊天室 ID、名稱、線上人數、建立時間欄位', async () => {
    renderPage();

    await waitFor(() => {
      expect(mockList).toHaveBeenCalled();
    });

    const table = screen.getByRole('table');
    const thead = within(table).getAllByRole('columnheader');
    const headerTexts = thead.map((th) => th.textContent);

    expect(headerTexts).toContain('聊天室 ID');
    expect(headerTexts).toContain('聊天室名稱');
    expect(headerTexts).toContain('線上人數');
    expect(headerTexts).toContain('建立時間');
  });

  it('時間顯示為 UTC+8 格式', async () => {
    renderPage();

    await waitFor(() => {
      // 2026-03-16 08:00:00 UTC → 2026-03-16 16:00:00 UTC+8
      expect(screen.getByText('2026-03-16 16:00:00')).toBeInTheDocument();
    });
  });

  it('點擊查詢後重新呼叫 API', async () => {
    renderPage();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(mockList).toHaveBeenCalledTimes(1);
    });

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

    const nameInput = screen.getByPlaceholderText('名稱或 ID 搜尋');
    await user.type(nameInput, 'baccarat');
    expect(nameInput).toHaveValue('baccarat');

    await user.click(screen.getByText('重置'));

    await waitFor(() => {
      expect(nameInput).toHaveValue('');
    });
  });

  it('分頁元件顯示正確的 total', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('共 3 筆')).toBeInTheDocument();
    });
  });

  it('顯示線上人數', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('120')).toBeInTheDocument();
      expect(screen.getByText('200')).toBeInTheDocument();
    });
  });
});
