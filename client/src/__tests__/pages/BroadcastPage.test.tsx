import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfigProvider } from 'antd';
import BroadcastPage from '../../pages/BroadcastPage';

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
const mockRemove = vi.fn();
const mockChatroomList = vi.fn();

vi.mock('../../api/broadcast', () => ({
  broadcastApi: {
    list: (...args: unknown[]) => mockList(...args),
    create: (...args: unknown[]) => mockCreate(...args),
    remove: (...args: unknown[]) => mockRemove(...args),
  },
}));

vi.mock('../../api/chatroom', () => ({
  chatroomApi: {
    list: (...args: unknown[]) => mockChatroomList(...args),
  },
}));

const mockBroadcasts = [
  {
    id: 1,
    message: 'System maintenance in 10 minutes',
    chatroom_id: 'all',
    duration: 600,
    start_at: '2099-01-01T00:00:00.000Z',
    operator: 'admin01',
    created_at: '2026-03-18T07:50:00.000Z',
    status: 'scheduled',
  },
  {
    id: 2,
    message: 'Welcome bonus event is now live!',
    chatroom_id: 'baccarat_001',
    duration: 3600,
    start_at: '2026-03-17T12:00:00.000Z',
    operator: 'admin01',
    created_at: '2026-03-17T11:50:00.000Z',
    status: 'active',
  },
  {
    id: 3,
    message: 'Server update completed successfully',
    chatroom_id: 'all',
    duration: 300,
    start_at: '2026-03-16T00:00:00.000Z',
    operator: 'admin01',
    created_at: '2026-03-16T00:00:00.000Z',
    status: 'expired',
  },
];

const mockChatrooms = [
  { id: 'baccarat_001', name: '百家樂 001', online_user_count: 10, created_at: '', updated_at: '' },
];

const makeResponse = (data = mockBroadcasts) => ({
  data: {
    success: true,
    data,
    pagination: { page: 1, pageSize: 20, total: data.length, totalPages: 1 },
  },
});

const makeChatroomResponse = () => ({
  data: {
    success: true,
    data: mockChatrooms,
    pagination: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
  },
});

function renderPage() {
  return render(
    <ConfigProvider button={{ autoInsertSpace: false }}>
      <BroadcastPage />
    </ConfigProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockList.mockResolvedValue(makeResponse());
  mockChatroomList.mockResolvedValue(makeChatroomResponse());
  mockCreate.mockResolvedValue({
    data: { success: true, data: { ...mockBroadcasts[0], id: 4 } },
  });
  mockRemove.mockResolvedValue({
    data: { success: true, data: { message: '廣播已下架' } },
  });
});

describe('BroadcastPage', () => {
  // @happy_path
  it('頁面載入後呼叫 list API 並渲染廣播列表', async () => {
    renderPage();

    await waitFor(() => {
      expect(mockList).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByText('System maintenance in 10 minutes')).toBeInTheDocument();
      expect(screen.getByText('Welcome bonus event is now live!')).toBeInTheDocument();
      expect(screen.getByText('Server update completed successfully')).toBeInTheDocument();
    });
  });

  // @happy_path — 狀態 Tag 顏色對應
  it('scheduled 狀態顯示「未開始」Tag', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('未開始')).toBeInTheDocument();
    });
  });

  it('active 狀態顯示「廣播中」Tag', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('廣播中')).toBeInTheDocument();
    });
  });

  it('expired 狀態顯示「已過期」Tag', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('已過期')).toBeInTheDocument();
    });
  });

  // @happy_path — 下架按鈕顯示邏輯
  it('scheduled / active 廣播顯示下架按鈕，expired 不顯示', async () => {
    renderPage();

    await waitFor(() => {
      const removeButtons = screen.getAllByText('下架');
      // scheduled + active 各 1 個 = 2 個
      expect(removeButtons).toHaveLength(2);
    });
  });

  // @happy_path — 下架確認 Modal
  it('點擊下架按鈕後顯示確認 Modal', async () => {
    const user = userEvent.setup();
    renderPage();

    const removeButtons = await screen.findAllByText('下架');
    await user.click(removeButtons[0]);

    await waitFor(() => {
      expect(screen.queryAllByText('確認下架廣播').length).toBeGreaterThan(0);
    });
  });

  // @happy_path — 確認下架後呼叫 API
  it('確認下架後呼叫 remove API 並重新整理列表', async () => {
    const user = userEvent.setup();
    renderPage();

    const removeButtons = await screen.findAllByText('下架');
    await user.click(removeButtons[0]);

    await waitFor(() => expect(screen.queryAllByText('確認下架廣播').length).toBeGreaterThan(0));

    // 取最後一個確認對話框，避免前次測試殘留的 dialog 干擾
    const dialogs = screen.getAllByRole('dialog', { name: /確認下架廣播/ });
    const confirmDialog = dialogs[dialogs.length - 1];
    const okBtn = within(confirmDialog).getByRole('button', { name: /確認下架/ });
    await user.click(okBtn);
    await waitFor(() => {
      expect(mockRemove).toHaveBeenCalledWith(expect.any(Number));
    });
  });

  // @happy_path — chatroom_id = 'all' 顯示為「全部聊天室」
  it("chatroom_id 為 'all' 顯示「全部聊天室」", async () => {
    renderPage();

    await waitFor(() => {
      const cells = screen.getAllByText('全部聊天室');
      expect(cells.length).toBeGreaterThanOrEqual(1);
    });
  });

  // @happy_path — 篩選功能
  it('點擊查詢按鈕後重新呼叫 list API', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(mockList).toHaveBeenCalledTimes(1));

    const searchBtn = screen.getByRole('button', { name: /查詢/ });
    await user.click(searchBtn);

    await waitFor(() => {
      expect(mockList).toHaveBeenCalledTimes(2);
    });
  });

  // @happy_path — 發送廣播表單 validation
  it('未填寫表單欄位直接送出 → 顯示驗證錯誤', async () => {
    const user = userEvent.setup({ delay: null });
    renderPage();

    await waitFor(() => expect(mockList).toHaveBeenCalled(), { timeout: 5000 });

    // 開啟新增廣播 Modal
    const addBtn = screen.getByRole('button', { name: /新增廣播/ });
    await user.click(addBtn);

    await waitFor(
      () => {
        expect(screen.getByPlaceholderText('請輸入廣播訊息內容')).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    const submitBtn = screen.getByRole('button', { name: /發送廣播/ });
    await user.click(submitBtn);

    await waitFor(
      () => {
        expect(screen.getByText('請輸入廣播訊息')).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  }, 20000);
});
