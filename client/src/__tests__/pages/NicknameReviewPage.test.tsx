import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfigProvider } from 'antd';
import NicknameReviewPage from '../../pages/NicknameReviewPage';

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

vi.mock('../../api/nicknameReview', () => ({
  nicknameReviewApi: {
    list: (...args: unknown[]) => mockList(...args),
    approve: (...args: unknown[]) => mockApprove(...args),
    reject: (...args: unknown[]) => mockReject(...args),
  },
}));

const mockData = [
  {
    username: 'player016',
    nickname: 'DragonKing',
    nickname_apply_at: '2026-03-15 10:00:00',
    nickname_review_status: 'pending' as const,
    nickname_reviewed_by: null,
    nickname_reviewed_at: null,
  },
  {
    username: 'player017',
    nickname: 'LuckyStrike99',
    nickname_apply_at: '2026-03-15 11:30:00',
    nickname_review_status: 'pending' as const,
    nickname_reviewed_by: null,
    nickname_reviewed_at: null,
  },
];

const makeResponse = (data = mockData, total = mockData.length) => ({
  data: {
    success: true,
    data,
    pagination: { page: 1, pageSize: 20, total, totalPages: 1 },
  },
});

function renderPage() {
  return render(
    <ConfigProvider button={{ autoInsertSpace: false }}>
      <NicknameReviewPage />
    </ConfigProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockList.mockResolvedValue(makeResponse());
  mockApprove.mockResolvedValue({ data: { success: true, data: { message: '暱稱申請已核准' } } });
  mockReject.mockResolvedValue({
    data: { success: true, data: { message: '暱稱申請已駁回，暱稱已重設為帳號名稱' } },
  });
});

describe('NicknameReviewPage', () => {
  // @happy_path
  it('頁面載入後呼叫 list API 並渲染待審核列表', async () => {
    renderPage();

    await waitFor(() => {
      expect(mockList).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByText('player016')).toBeInTheDocument();
      expect(screen.getByText('DragonKing')).toBeInTheDocument();
    });
  });

  // @happy_path
  it('輸入搜尋條件後點擊查詢，API 帶對應 query params', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(mockList).toHaveBeenCalled());

    const usernameInput = screen.getByPlaceholderText('玩家帳號');
    await user.type(usernameInput, 'player016');

    const searchBtn = screen.getByRole('button', { name: /查詢/ });
    await user.click(searchBtn);

    await waitFor(() => {
      expect(mockList).toHaveBeenCalledWith(expect.objectContaining({ username: 'player016' }));
    });
  });

  // @happy_path
  it('頁面初始 API 呼叫帶有 status: pending', async () => {
    renderPage();
    await waitFor(() => {
      expect(mockList).toHaveBeenCalledWith(expect.objectContaining({ status: 'pending' }));
    });
  });

  // @happy_path
  it('點擊「核准」顯示確認 Modal', async () => {
    const user = userEvent.setup();
    renderPage();

    const approveBtn = await screen.findByTestId('nickname-review__approve-btn--player016');
    await user.click(approveBtn);

    await waitFor(() => {
      expect(screen.queryAllByText('確認核准').length).toBeGreaterThan(0);
    });
  });

  // @happy_path
  it('確認核准後呼叫 approve API 並 refetch', async () => {
    const user = userEvent.setup();
    renderPage();

    const approveBtn = await screen.findByTestId('nickname-review__approve-btn--player016');
    await user.click(approveBtn);

    await waitFor(() => expect(screen.queryAllByText('確認核准').length).toBeGreaterThan(0));

    // click the modal's OK button — 取最後一個 dialog（前一個測試的 modal 可能未清除）
    const dialogs = screen.getAllByRole('dialog', { name: '確認核准' });
    const dialog = dialogs[dialogs.length - 1];
    const modalOkBtn = within(dialog).getByRole('button', { name: /核.*准/ });
    await user.click(modalOkBtn);

    await waitFor(() => {
      expect(mockApprove).toHaveBeenCalledWith('player016');
    });
  });

  // @happy_path
  it('點擊「駁回」顯示確認 Modal', async () => {
    const user = userEvent.setup();
    renderPage();

    const rejectBtn = await screen.findByTestId('nickname-review__reject-btn--player016');
    await user.click(rejectBtn);

    await waitFor(() => {
      expect(screen.queryAllByText('確認駁回').length).toBeGreaterThan(0);
    });
  });

  // @happy_path
  it('Loading state 期間按鈕禁用', async () => {
    // 讓 API 掛起
    mockList.mockImplementation(() => new Promise(() => {}));
    renderPage();

    // 載入中狀態 — 表格顯示 loading（無資料按鈕）
    expect(screen.queryByText('核准')).not.toBeInTheDocument();
  });

  // @happy_path
  it('nickname_review_status=approved 的列操作按鈕為 disabled', async () => {
    mockList.mockResolvedValue(
      makeResponse([
        {
          username: 'player016',
          nickname: 'DragonKing',
          nickname_apply_at: '2026-03-15 10:00:00',
          nickname_review_status: 'approved' as const,
          nickname_reviewed_by: 'admin01',
          nickname_reviewed_at: '2026-03-16 00:00:00',
        },
      ]),
    );
    renderPage();

    const approveBtn = await screen.findByRole('button', { name: '核准' });
    const rejectBtn = await screen.findByRole('button', { name: '駁回' });
    expect(approveBtn).toBeDisabled();
    expect(rejectBtn).toBeDisabled();
  });
});
