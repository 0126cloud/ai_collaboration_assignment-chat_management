import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfigProvider } from 'antd';
import CreateBlacklistModal from '../../components/CreateBlacklistModal';

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
const mockBlockPlayer = vi.fn();
const mockBlockIp = vi.fn();
vi.mock('../../api/blacklist', () => ({
  blacklistApi: {
    listPlayers: vi.fn(),
    listIps: vi.fn(),
    blockPlayer: (...args: unknown[]) => mockBlockPlayer(...args),
    blockIp: (...args: unknown[]) => mockBlockIp(...args),
    unblockPlayer: vi.fn(),
    unblockIp: vi.fn(),
  },
}));

// Mock chatroom API
vi.mock('../../api/chatroom', () => ({
  chatroomApi: {
    list: vi.fn().mockResolvedValue({
      data: {
        success: true,
        data: [{ id: 'baccarat_001', name: 'Baccarat Room 1', online_user_count: 120 }],
        pagination: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
      },
    }),
  },
}));

const mockOnClose = vi.fn();
const mockOnSuccess = vi.fn();

function renderModal(props?: Partial<Parameters<typeof CreateBlacklistModal>[0]>) {
  return render(
    <ConfigProvider>
      <CreateBlacklistModal
        open={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
        {...props}
      />
    </ConfigProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockBlockPlayer.mockResolvedValue({
    data: {
      success: true,
      data: {
        id: 1,
        block_type: 'player',
        target: 'player01',
        reason: 'spam',
        operator: 'admin01',
        chatroom_id: 'all',
        created_at: '2026-03-17',
      },
    },
  });
  mockBlockIp.mockResolvedValue({
    data: {
      success: true,
      data: {
        id: 2,
        block_type: 'ip',
        target: '10.0.0.1',
        reason: 'spam',
        operator: 'admin01',
        chatroom_id: 'all',
        created_at: '2026-03-17',
      },
    },
  });
});

// 等待並取得 Modal OK 按鈕（使用 data-testid 以避免直接使用 .ant-xxx class）
async function waitForOkButton(): Promise<HTMLElement> {
  return await waitFor(() => {
    return screen.getByTestId('blacklist__modal__submit-btn');
  });
}

describe('CreateBlacklistModal', () => {
  // @ui_only
  it('Modal 渲染後顯示 type、target、reason 欄位', async () => {
    renderModal();

    await waitFor(() => {
      expect(screen.getByText('新增封鎖')).toBeInTheDocument();
      expect(screen.getByText('類型')).toBeInTheDocument();
      expect(screen.getByText('目標')).toBeInTheDocument();
      expect(screen.getByText('封鎖原因')).toBeInTheDocument();
    });
  });

  // @ui_only
  it('切換 type 為 IP → target 欄位清空', async () => {
    renderModal({ initialValues: { blockType: 'player', target: 'player01' } });
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByDisplayValue('player01')).toBeInTheDocument();
    });

    // 切換到 IP 類型
    const typeSelects = screen.getAllByRole('combobox');
    await user.click(typeSelects[0]);

    await waitFor(() => {
      const ipOption = screen.getAllByText('IP');
      expect(ipOption.length).toBeGreaterThan(0);
    });

    const ipOptions = screen.getAllByText('IP');
    await user.click(ipOptions[ipOptions.length - 1]);

    await waitFor(() => {
      expect(screen.queryByDisplayValue('player01')).toBeNull();
    });
  });

  // @validation
  it('Player 模式下提交空白 target → 顯示驗證錯誤', async () => {
    renderModal({ initialValues: { blockType: 'player' } });

    const okBtn = await waitForOkButton();
    fireEvent.click(okBtn);

    await waitFor(() => {
      expect(screen.getByText('請輸入玩家帳號')).toBeInTheDocument();
    });
  });

  // @validation
  it('IP 模式下提交非法 IP → 顯示驗證錯誤', async () => {
    renderModal({ initialValues: { blockType: 'ip' } });
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('新增封鎖')).toBeInTheDocument();
    });

    const targetInput = screen.getByPlaceholderText('如 192.168.1.1 或 116.62.238.*');
    await user.type(targetInput, 'not-ip');

    // 選擇 reason
    const reasonSelect = screen.getAllByRole('combobox')[1];
    await user.click(reasonSelect);
    await waitFor(() => {
      expect(screen.getAllByText('spam').length).toBeGreaterThan(0);
    });
    const spamOptions = screen.getAllByText('spam');
    await user.click(spamOptions[spamOptions.length - 1]);

    const okBtn = await waitForOkButton();
    fireEvent.click(okBtn);

    await waitFor(() => {
      expect(
        screen.getByText('IP 格式不正確，支援精確 IP 或萬用字元（如 116.62.238.*）'),
      ).toBeInTheDocument();
    });
  });

  // @happy_path
  it('提交成功 → 呼叫 onSuccess callback', async () => {
    renderModal({ initialValues: { blockType: 'player', target: 'player01' } });
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByDisplayValue('player01')).toBeInTheDocument();
    });

    // 選擇 reason
    const reasonSelect = screen.getAllByRole('combobox')[1];
    await user.click(reasonSelect);
    await waitFor(() => {
      expect(screen.getAllByText('spam').length).toBeGreaterThan(0);
    });
    const spamOptions = screen.getAllByText('spam');
    await user.click(spamOptions[spamOptions.length - 1]);

    const okBtn = await waitForOkButton();
    fireEvent.click(okBtn);

    // 等待確認對話框並確認（使用 getByRole 查找確認按鈕）
    await waitFor(() => {
      const dialogs = screen.getAllByRole('dialog');
      // 確認對話框是第二個 dialog
      const confirmDialog = dialogs[dialogs.length - 1];
      const confirmBtn = within(confirmDialog).getByRole('button', { name: /確認封鎖/ });
      fireEvent.click(confirmBtn);
    });

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });

  // @ui_only
  it('initialValues 有值時預填對應欄位', async () => {
    renderModal({
      initialValues: {
        blockType: 'player',
        target: 'prefilled_player',
        chatroomId: 'baccarat_001',
      },
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue('prefilled_player')).toBeInTheDocument();
    });
  });
});
