import { useCallback, useEffect, useState } from 'react';
import { Table, Card, Select, Input, DatePicker, Button, Space, Modal, message } from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  DeleteOutlined,
  StopOutlined,
  EditOutlined,
} from '@ant-design/icons';
import { createStyles } from 'antd-style';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { chatMessageApi } from '../api/chatMessage';
import { chatroomApi } from '../api/chatroom';
import { playerApi } from '../api/player';
import CreateBlacklistModal from '../components/CreateBlacklistModal';
import type { TChatMessageItem, TChatMessageQuery } from '@shared/types/chatMessage';
import type { ColumnsType } from 'antd/es/table';

dayjs.extend(utc);
dayjs.extend(timezone);

const { RangePicker } = DatePicker;

const useStyles = createStyles(({ token }) => ({
  filterCard: {
    marginBottom: token.marginMD,
  },
  filterRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: token.marginSM,
    alignItems: 'center',
  },
  filterItem: {
    width: 250,
  },
  filterInput: {
    maxWidth: 300,
  },
}));

const formatTime = (value: string): string =>
  dayjs.utc(value).tz('Asia/Taipei').format('YYYY-MM-DD HH:mm:ss');

const ChatMonitoringPage = () => {
  const { styles } = useStyles();

  const [data, setData] = useState<TChatMessageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 30, total: 0 });

  // 聊天室選項
  const [chatroomOptions, setChatroomOptions] = useState<{ label: string; value: string }[]>([]);

  // 封鎖玩家 Modal 狀態
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [blockModalInitialValues, setBlockModalInitialValues] = useState<{
    blockType?: 'player' | 'ip';
    target?: string;
    chatroomId?: string;
  }>({});

  // 篩選狀態
  const [chatroomId, setChatroomId] = useState<string | undefined>();
  const [playerUsername, setPlayerUsername] = useState<string | undefined>();
  const [playerNickname, setPlayerNickname] = useState<string | undefined>();
  const [messageKeyword, setMessageKeyword] = useState<string | undefined>();
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);

  // 載入聊天室選項
  useEffect(() => {
    const loadChatrooms = async () => {
      try {
        const res = await chatroomApi.list({ pageSize: 100 });
        setChatroomOptions(
          res.data.data.map((room) => ({
            label: `${room.name} (${room.id})`,
            value: room.id,
          })),
        );
      } catch {
        // 靜默處理
      }
    };
    loadChatrooms();
  }, []);

  const fetchData = useCallback(
    async (page = 1, pageSize = 30) => {
      setLoading(true);
      try {
        const params: TChatMessageQuery = { page, pageSize };
        if (chatroomId) params.chatroomId = chatroomId;
        if (playerUsername) params.playerUsername = playerUsername;
        if (playerNickname) params.playerNickname = playerNickname;
        if (messageKeyword) params.message = messageKeyword;
        if (dateRange?.[0]) params.startDate = dateRange[0].format('YYYY-MM-DD 00:00:00');
        if (dateRange?.[1]) params.endDate = dateRange[1].format('YYYY-MM-DD 23:59:59');

        const res = await chatMessageApi.list(params);
        setData(res.data.data);
        setPagination({
          page: res.data.pagination.page,
          pageSize: res.data.pagination.pageSize,
          total: res.data.pagination.total,
        });
      } finally {
        setLoading(false);
      }
    },
    [chatroomId, playerUsername, playerNickname, messageKeyword, dateRange],
  );

  // 只在 mount 時自動查詢，其他篩選條件需點擊查詢按鈕
  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = () => {
    fetchData(1, pagination.pageSize);
  };

  const handleReset = () => {
    setChatroomId(undefined);
    setPlayerUsername(undefined);
    setPlayerNickname(undefined);
    setMessageKeyword(undefined);
    setDateRange(null);
  };

  const handleTableChange = (paginationConfig: { current?: number; pageSize?: number }) => {
    fetchData(paginationConfig.current || 1, paginationConfig.pageSize || 30);
  };

  const handleBlock = (record: TChatMessageItem) => {
    setBlockModalInitialValues({
      blockType: 'player',
      target: record.player_username,
      chatroomId: record.chatroom_id,
    });
    setBlockModalOpen(true);
  };

  const handleResetNickname = (record: TChatMessageItem) => {
    Modal.confirm({
      title: '確認重設暱稱',
      content: `確定要將玩家「${record.player_username}」的暱稱重設為帳號名稱嗎？`,
      okText: '確認重設',
      cancelText: '取消',
      onOk: async () => {
        try {
          await playerApi.resetNickname(record.player_username);
          message.success('暱稱已重設');
          fetchData(pagination.page, pagination.pageSize);
        } catch {
          message.error('重設暱稱失敗');
        }
      },
    });
  };

  const handleDelete = (record: TChatMessageItem) => {
    Modal.confirm({
      title: '確認刪除',
      content: `確定要刪除這則訊息嗎？\n「${record.message}」`,
      okText: '確定刪除',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          await chatMessageApi.remove(record.id);
          message.success('訊息已刪除');
          fetchData(pagination.page, pagination.pageSize);
        } catch {
          message.error('刪除失敗');
        }
      },
    });
  };

  const columns: ColumnsType<TChatMessageItem> = [
    {
      title: '聊天室',
      dataIndex: 'chatroom_id',
      key: 'chatroom_id',
      width: 150,
    },
    {
      title: '玩家帳號',
      dataIndex: 'player_username',
      key: 'player_username',
      width: 130,
    },
    {
      title: '玩家暱稱',
      dataIndex: 'player_nickname',
      key: 'player_nickname',
      width: 130,
    },
    {
      title: '訊息內容',
      dataIndex: 'message',
      key: 'message',
    },
    {
      title: '發送時間',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (value: string) => formatTime(value),
    },
    {
      title: '操作',
      key: 'action',
      width: 220,
      render: (_: unknown, record: TChatMessageItem) => (
        <Space>
          <Button
            type="link"
            danger
            size="small"
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
          >
            刪除
          </Button>
          <Button
            type="link"
            size="small"
            icon={<StopOutlined />}
            onClick={() => handleBlock(record)}
          >
            封鎖
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleResetNickname(record)}
          >
            重設暱稱
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Card className={styles.filterCard}>
        <div className={styles.filterRow}>
          <Select
            className={styles.filterItem}
            placeholder="聊天室"
            allowClear
            showSearch
            optionFilterProp="label"
            options={chatroomOptions}
            value={chatroomId}
            onChange={setChatroomId}
          />
          <Input
            className={styles.filterInput}
            placeholder="玩家帳號"
            allowClear
            value={playerUsername}
            onChange={(e) => setPlayerUsername(e.target.value || undefined)}
          />
          <Input
            className={styles.filterInput}
            placeholder="玩家暱稱"
            allowClear
            value={playerNickname}
            onChange={(e) => setPlayerNickname(e.target.value || undefined)}
          />
          <Input
            className={styles.filterInput}
            placeholder="訊息關鍵字"
            allowClear
            value={messageKeyword}
            onChange={(e) => setMessageKeyword(e.target.value || undefined)}
          />
          <RangePicker
            value={dateRange as [dayjs.Dayjs, dayjs.Dayjs] | null}
            onChange={(dates) => setDateRange(dates)}
          />
          <Space>
            <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
              查詢
            </Button>
            <Button icon={<ReloadOutlined />} onClick={handleReset}>
              重置
            </Button>
          </Space>
        </div>
      </Card>
      <CreateBlacklistModal
        open={blockModalOpen}
        onClose={() => setBlockModalOpen(false)}
        onSuccess={() => {
          message.success('已成功封鎖玩家');
        }}
        initialValues={blockModalInitialValues}
      />
      <Table<TChatMessageItem>
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={{
          current: pagination.page,
          pageSize: pagination.pageSize,
          total: pagination.total,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 筆`,
        }}
        onChange={handleTableChange}
      />
    </>
  );
};

export default ChatMonitoringPage;
