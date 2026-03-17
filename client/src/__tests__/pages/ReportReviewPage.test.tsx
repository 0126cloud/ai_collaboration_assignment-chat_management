import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfigProvider } from 'antd';
import ReportReviewPage from '../../pages/ReportReviewPage';

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    hasPermission: () => true,
    user: { id: 1, username: 'admin01', role: 'senior_manager' },
    loading: false,
  }),
}));

const mockList = vi.fn();
const mockApprove = vi.fn();
const mockReject = vi.fn();

vi.mock('../../api/report', () => ({
  reportApi: {
    list: (...args: unknown[]) => mockList(...args),
    approve: (...args: unknown[]) => mockApprove(...args),
    reject: (...args: unknown[]) => mockReject(...args),
  },
}));

const mockPendingData = [
  {
    id: 1,
    reporter_username: 'player001',
    target_username: 'player003',
    chatroom_id: 'baccarat_001',
    chat_message_id: null,
    chat_message: '你這個混蛋！',
    reason: 'abuse',
    status: 'pending',
    reviewed_by: null,
    reviewed_at: null,
    created_at: '2026-03-16 14:30:00',
  },
  {
    id: 2,
    reporter_username: 'player002',
    target_username: 'player007',
    chatroom_id: 'blackjack_001',
    chat_message_id: null,
    chat_message: '廣告訊息',
    reason: 'spam',
    status: 'pending',
    reviewed_by: null,
    reviewed_at: null,
    created_at: '2026-03-16 15:00:00',
  },
];

const mockApprovedData = [
  {
    id: 3,
    reporter_username: 'player004',
    target_username: 'player010',
    chatroom_id: 'roulette_001',
    chat_message_id: null,
    chat_message: '廣告內容',
    reason: 'advertisement',
    status: 'approved',
    reviewed_by: 'admin01',
    reviewed_at: '2026-03-16 10:00:00',
    created_at: '2026-03-15 09:00:00',
  },
];

const makeResponse = (data = mockPendingData, total = mockPendingData.length) => ({
  data: {
    success: true,
    data,
    pagination: { page: 1, pageSize: 20, total, totalPages: 1 },
  },
});

function renderPage() {
  return render(
    <ConfigProvider button={{ autoInsertSpace: false }}>
      <ReportReviewPage />
    </ConfigProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockList.mockResolvedValue(makeResponse());
  mockApprove.mockResolvedValue({
    data: { success: true, data: { message: '檢舉已核准，被檢舉玩家已封鎖' } },
  });
  mockReject.mockResolvedValue({ data: { success: true, data: { message: '檢舉已駁回' } } });
});

describe('ReportReviewPage', () => {
  // @happy_path
  it('頁面載入後呼叫 list API（預設 status=pending）並渲染列表', async () => {
    renderPage();

    await waitFor(() => {
      expect(mockList).toHaveBeenCalledWith(expect.objectContaining({ status: 'pending' }));
    });

    await waitFor(() => {
      expect(screen.getByText('player001')).toBeInTheDocument();
      expect(screen.getByText('player003')).toBeInTheDocument();
    });
  });

  // @happy_path
  it('切換狀態 Select → API 帶對應 status', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(mockList).toHaveBeenCalled());

    mockList.mockResolvedValue(makeResponse(mockApprovedData, 1));

    const select = screen.getByRole('combobox');
    await user.click(select);

    const approvedOption = await screen.findByText('已核准');
    await user.click(approvedOption);

    const searchBtn = screen.getByRole('button', { name: /查詢/ });
    await user.click(searchBtn);

    await waitFor(() => {
      expect(mockList).toHaveBeenCalledWith(expect.objectContaining({ status: 'approved' }));
    });
  });

  // @happy_path
  it('非 pending 紀錄的操作按鈕應 disabled', async () => {
    mockList.mockResolvedValue(makeResponse(mockApprovedData, 1));
    renderPage();

    await waitFor(async () => {
      const approveButtons = screen.getAllByText('核准');
      expect(approveButtons[0].closest('button')).toBeDisabled();
      const rejectButtons = screen.getAllByText('駁回');
      expect(rejectButtons[0].closest('button')).toBeDisabled();
    });
  });

  // @happy_path
  it('點擊「核准」顯示包含封鎖提示的確認 Modal', async () => {
    const user = userEvent.setup();
    renderPage();

    const approveButtons = await screen.findAllByText('核准');
    await user.click(approveButtons[0]);

    await waitFor(() => {
      expect(screen.queryAllByText('確認核准').length).toBeGreaterThan(0);
      // 確認 Modal 包含「封鎖」提示文字
      expect(screen.getByText(/自動封鎖/)).toBeInTheDocument();
    });
  });

  // @happy_path
  it('確認核准後呼叫 approve API', async () => {
    const user = userEvent.setup();
    renderPage();

    const approveButtons = await screen.findAllByText('核准');
    await user.click(approveButtons[0]);

    await waitFor(() => expect(screen.queryAllByText('確認核准').length).toBeGreaterThan(0));

    const modalOkButtons = document.querySelectorAll('.ant-modal-confirm-btns .ant-btn-primary');
    if (modalOkButtons.length > 0) {
      await user.click(modalOkButtons[0] as HTMLElement);
    }

    await waitFor(() => {
      expect(mockApprove).toHaveBeenCalledWith(1);
    });
  });

  // @happy_path
  it('Loading state 期間按鈕禁用', async () => {
    mockList.mockImplementation(() => new Promise(() => {}));
    renderPage();

    expect(screen.queryByText('核准')).not.toBeInTheDocument();
  });
});
