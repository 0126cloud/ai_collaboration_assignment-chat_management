import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfigProvider } from 'antd';
import BlacklistPage from '../../pages/BlacklistPage';

// Mock useAuth
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    hasPermission: () => true,
    user: { id: 1, username: 'admin01', role: 'senior_manager' },
    loading: false,
  }),
}));

// Mock blacklist API
const mockListPlayers = vi.fn();
const mockListIps = vi.fn();
const mockUnblockPlayer = vi.fn();
const mockUnblockIp = vi.fn();
vi.mock('../../api/blacklist', () => ({
  blacklistApi: {
    listPlayers: (...args: unknown[]) => mockListPlayers(...args),
    listIps: (...args: unknown[]) => mockListIps(...args),
    blockPlayer: vi.fn(),
    blockIp: vi.fn(),
    unblockPlayer: (...args: unknown[]) => mockUnblockPlayer(...args),
    unblockIp: (...args: unknown[]) => mockUnblockIp(...args),
  },
}));

// Mock chatroom API (for CreateBlacklistModal)
vi.mock('../../api/chatroom', () => ({
  chatroomApi: {
    list: vi.fn().mockResolvedValue({
      data: {
        success: true,
        data: [],
        pagination: { page: 1, pageSize: 100, total: 0, totalPages: 1 },
      },
    }),
  },
}));

const mockPlayerData = [
  {
    id: 1,
    block_type: 'player',
    target: 'player03',
    reason: 'spam',
    operator: 'admin01',
    chatroom_id: 'baccarat_001',
    is_blocked: true,
    created_at: '2026-03-16 10:00:00',
  },
  {
    id: 2,
    block_type: 'player',
    target: 'player07',
    reason: 'abuse',
    operator: 'admin01',
    chatroom_id: '*',
    is_blocked: true,
    created_at: '2026-03-15 08:00:00',
  },
];

const mockUnblockedPlayerData = [
  {
    id: 5,
    block_type: 'player',
    target: 'player_unblocked',
    reason: 'spam',
    operator: 'admin01',
    chatroom_id: '*',
    is_blocked: false,
    created_at: '2026-03-10 06:00:00',
  },
];

const mockIpData = [
  {
    id: 3,
    block_type: 'ip',
    target: '116.62.238.199',
    reason: 'spam',
    operator: 'admin01',
    chatroom_id: '*',
    is_blocked: true,
    created_at: '2026-03-14 06:00:00',
  },
];

const makePlayerResponse = (data = mockPlayerData, total = mockPlayerData.length) => ({
  data: {
    success: true,
    data,
    pagination: { page: 1, pageSize: 30, total, totalPages: 1 },
  },
});

const makeIpResponse = (data = mockIpData, total = mockIpData.length) => ({
  data: {
    success: true,
    data,
    pagination: { page: 1, pageSize: 30, total, totalPages: 1 },
  },
});

function renderPage() {
  return render(
    <ConfigProvider>
      <BlacklistPage />
    </ConfigProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockListPlayers.mockResolvedValue(makePlayerResponse());
  mockListIps.mockResolvedValue(makeIpResponse());
  mockUnblockPlayer.mockResolvedValue({ data: { success: true, data: { message: '已成功解封' } } });
  mockUnblockIp.mockResolvedValue({ data: { success: true, data: { message: '已成功解封' } } });
});

describe('BlacklistPage', () => {
  // @happy_path
  it('頁面載入後呼叫 listPlayers API 並渲染表格', async () => {
    renderPage();

    await waitFor(() => {
      expect(mockListPlayers).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByText('player03')).toBeInTheDocument();
      expect(screen.getByText('player07')).toBeInTheDocument();
    });
  });

  // @happy_path
  it('表格包含類型、目標、原因、操作者、聊天室、時間、操作欄位', async () => {
    renderPage();

    await waitFor(() => {
      expect(mockListPlayers).toHaveBeenCalled();
    });

    const table = screen.getByRole('table');
    const thead = within(table).getAllByRole('columnheader');
    const headerTexts = thead.map((th) => th.textContent);

    expect(headerTexts).toContain('類型');
    expect(headerTexts).toContain('目標');
    expect(headerTexts).toContain('封鎖原因');
    expect(headerTexts).toContain('操作者');
    expect(headerTexts).toContain('聊天室');
    expect(headerTexts).toContain('封鎖時間');
    expect(headerTexts).toContain('狀態');
    expect(headerTexts).toContain('操作');
  });

  // @happy_path
  it('時間顯示為 UTC+8 格式', async () => {
    renderPage();

    await waitFor(() => {
      // 2026-03-16 10:00:00 UTC → 2026-03-16 18:00:00 UTC+8
      expect(screen.getByText('2026-03-16 18:00:00')).toBeInTheDocument();
    });
  });

  // @happy_path
  it("chatroom_id='*' 顯示為「全域」", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('player07')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('全域')).toBeInTheDocument();
    });
  });

  // @ui_only
  it('切換 type 為 IP → 呼叫 listIps API', async () => {
    renderPage();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(mockListPlayers).toHaveBeenCalled();
    });

    // 找到類型 Select 並切換
    const typeSelect = screen.getAllByRole('combobox')[0];
    await user.click(typeSelect);

    await waitFor(() => {
      expect(screen.getByText('IP')).toBeInTheDocument();
    });

    await user.click(screen.getByText('IP'));

    await waitFor(() => {
      expect(mockListIps).toHaveBeenCalled();
    });
  });

  // @happy_path
  it('點擊查詢按鈕 → 重新查詢', async () => {
    renderPage();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(mockListPlayers).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByText('查詢'));

    await waitFor(() => {
      expect(mockListPlayers).toHaveBeenCalledTimes(2);
    });
  });

  // @happy_path
  it('點擊重置 → 清除篩選條件', async () => {
    renderPage();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(mockListPlayers).toHaveBeenCalled();
    });

    const targetInput = screen.getByPlaceholderText('目標（模糊搜尋）');
    await user.type(targetInput, 'player03');
    expect(targetInput).toHaveValue('player03');

    await user.click(screen.getByText('重置'));

    await waitFor(() => {
      expect(targetInput).toHaveValue('');
    });
  });

  // @happy_path
  it('點擊解封按鈕 → 顯示確認 Modal', async () => {
    renderPage();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(mockListPlayers).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getAllByText('解封').length).toBeGreaterThanOrEqual(1);
    });

    const unblockButtons = screen.getAllByText('解封');
    await user.click(unblockButtons[0]);

    await waitFor(() => {
      expect(screen.getAllByText('確認解封').length).toBeGreaterThanOrEqual(1);
    });
  });

  // @happy_path
  it('分頁元件顯示正確的 total', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(`共 ${mockPlayerData.length} 筆`)).toBeInTheDocument();
    });
  });

  // @ui_only
  it('切換狀態篩選為「已解封」→ API 帶 status=unblocked', async () => {
    mockListPlayers.mockResolvedValue({
      data: {
        success: true,
        data: mockUnblockedPlayerData,
        pagination: { page: 1, pageSize: 30, total: 1, totalPages: 1 },
      },
    });
    renderPage();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(mockListPlayers).toHaveBeenCalled();
    });

    // 找到狀態 Select（第二個 combobox）
    const statusSelect = screen.getAllByRole('combobox')[1];
    await user.click(statusSelect);

    await waitFor(() => {
      expect(screen.getAllByText('已解封').length).toBeGreaterThan(0);
    });

    const unblocked = screen.getAllByText('已解封');
    await user.click(unblocked[unblocked.length - 1]);

    await waitFor(() => {
      const lastCall = mockListPlayers.mock.calls[mockListPlayers.mock.calls.length - 1][0];
      expect(lastCall.status).toBe('unblocked');
    });
  });

  // @ui_only
  it('is_blocked=false 的紀錄不顯示解封按鈕', async () => {
    mockListPlayers.mockResolvedValue({
      data: {
        success: true,
        data: mockUnblockedPlayerData,
        pagination: { page: 1, pageSize: 30, total: 1, totalPages: 1 },
      },
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('player_unblocked')).toBeInTheDocument();
    });

    expect(screen.queryByText('解封')).toBeNull();
  });
});
