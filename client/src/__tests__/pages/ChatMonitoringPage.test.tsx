import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfigProvider } from 'antd';
import ChatMonitoringPage from '../../pages/ChatMonitoringPage';

// Mock useAuth
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    hasPermission: () => true,
    user: { id: 1, username: 'admin01', role: 'senior_manager' },
    loading: false,
  }),
}));

// Mock chatMessage API
const mockMessageList = vi.fn();
const mockMessageRemove = vi.fn();
vi.mock('../../api/chatMessage', () => ({
  chatMessageApi: {
    list: (...args: unknown[]) => mockMessageList(...args),
    remove: (...args: unknown[]) => mockMessageRemove(...args),
  },
}));

// Mock chatroom API
const mockChatroomList = vi.fn();
vi.mock('../../api/chatroom', () => ({
  chatroomApi: {
    list: (...args: unknown[]) => mockChatroomList(...args),
  },
}));

const mockMessageData = [
  {
    id: 1,
    chatroom_id: 'baccarat_001',
    player_username: 'player001',
    player_nickname: 'LuckyBoy',
    message: '大家好',
    created_at: '2026-03-16 08:30:00',
  },
  {
    id: 2,
    chatroom_id: 'blackjack_001',
    player_username: 'player002',
    player_nickname: 'BigWinner',
    message: '恭喜贏了',
    created_at: '2026-03-15 10:00:00',
  },
];

const mockMessageApiResponse = {
  data: {
    success: true,
    data: mockMessageData,
    pagination: { page: 1, pageSize: 30, total: 2, totalPages: 1 },
  },
};

const mockChatroomApiResponse = {
  data: {
    success: true,
    data: [
      { id: 'baccarat_001', name: 'Baccarat Room 1', online_user_count: 120 },
      { id: 'blackjack_001', name: 'Blackjack Room 1', online_user_count: 64 },
    ],
    pagination: { page: 1, pageSize: 100, total: 2, totalPages: 1 },
  },
};

function renderPage() {
  return render(
    <ConfigProvider>
      <ChatMonitoringPage />
    </ConfigProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockMessageList.mockResolvedValue(mockMessageApiResponse);
  mockChatroomList.mockResolvedValue(mockChatroomApiResponse);
  mockMessageRemove.mockResolvedValue({ data: { success: true, data: { message: '訊息已刪除' } } });
});

describe('ChatMonitoringPage', () => {
  it('頁面載入後呼叫 API 並渲染表格', async () => {
    renderPage();

    await waitFor(() => {
      expect(mockMessageList).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByText('LuckyBoy')).toBeInTheDocument();
      expect(screen.getByText('BigWinner')).toBeInTheDocument();
    });
  });

  it('表格包含聊天室、玩家帳號、玩家暱稱、訊息內容、發送時間、操作欄位', async () => {
    renderPage();

    await waitFor(() => {
      expect(mockMessageList).toHaveBeenCalled();
    });

    const table = screen.getByRole('table');
    const thead = within(table).getAllByRole('columnheader');
    const headerTexts = thead.map((th) => th.textContent);

    expect(headerTexts).toContain('聊天室');
    expect(headerTexts).toContain('玩家帳號');
    expect(headerTexts).toContain('玩家暱稱');
    expect(headerTexts).toContain('訊息內容');
    expect(headerTexts).toContain('發送時間');
    expect(headerTexts).toContain('操作');
  });

  it('時間顯示為 UTC+8 格式', async () => {
    renderPage();

    await waitFor(() => {
      // 2026-03-16 08:30:00 UTC → 2026-03-16 16:30:00 UTC+8
      expect(screen.getByText('2026-03-16 16:30:00')).toBeInTheDocument();
    });
  });

  it('封鎖玩家按鈕為 disabled 狀態', async () => {
    renderPage();

    await waitFor(() => {
      expect(mockMessageList).toHaveBeenCalled();
    });

    await waitFor(() => {
      const blockButtons = screen.getAllByText('封鎖');
      blockButtons.forEach((btn) => {
        expect(btn.closest('button')).toBeDisabled();
      });
    });
  });

  it('重設暱稱按鈕為 disabled 狀態', async () => {
    renderPage();

    await waitFor(() => {
      expect(mockMessageList).toHaveBeenCalled();
    });

    await waitFor(() => {
      const resetButtons = screen.getAllByText('重設暱稱');
      resetButtons.forEach((btn) => {
        expect(btn.closest('button')).toBeDisabled();
      });
    });
  });

  it('點擊刪除按鈕 → 顯示確認 Modal', async () => {
    renderPage();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(mockMessageList).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getAllByText('刪除').length).toBeGreaterThanOrEqual(1);
    });

    const deleteButtons = screen.getAllByText('刪除');
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(screen.getAllByText('確認刪除').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('點擊查詢後重新呼叫 API', async () => {
    renderPage();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(mockMessageList).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByText('查詢'));

    await waitFor(() => {
      expect(mockMessageList).toHaveBeenCalledTimes(2);
    });
  });

  it('點擊重置 → 清除篩選條件', async () => {
    renderPage();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(mockMessageList).toHaveBeenCalledTimes(1);
    });

    const usernameInput = screen.getByPlaceholderText('玩家帳號');
    await user.type(usernameInput, 'player001');
    expect(usernameInput).toHaveValue('player001');

    await user.click(screen.getByText('重置'));

    await waitFor(() => {
      expect(usernameInput).toHaveValue('');
    });
  });

  it('分頁元件顯示正確的 total', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('共 2 筆')).toBeInTheDocument();
    });
  });

  // @ui_only
  it('載入聊天室選項', async () => {
    renderPage();

    await waitFor(() => {
      expect(mockChatroomList).toHaveBeenCalled();
    });
  });
});
