import { useCallback, useEffect, useState } from 'react';
import { Table, Card, Input, Button, Space } from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { createStyles } from 'antd-style';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { chatroomApi } from '../api/chatroom';
import type { TChatroomItem } from '@shared/types/chatroom';
import type { ColumnsType } from 'antd/es/table';

dayjs.extend(utc);
dayjs.extend(timezone);

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
    minWidth: 220,
  },
  filterInput: {
    maxWidth: 300,
  },
}));

const formatTime = (value: string): string =>
  dayjs.utc(value).tz('Asia/Taipei').format('YYYY-MM-DD HH:mm:ss');

const columns: ColumnsType<TChatroomItem> = [
  {
    title: '聊天室 ID',
    dataIndex: 'id',
    key: 'id',
    width: 180,
  },
  {
    title: '聊天室名稱',
    dataIndex: 'name',
    key: 'name',
    width: 200,
  },
  {
    title: '線上人數',
    dataIndex: 'online_user_count',
    key: 'online_user_count',
    width: 120,
  },
  {
    title: '建立時間',
    dataIndex: 'created_at',
    key: 'created_at',
    width: 180,
    render: (value: string) => formatTime(value),
  },
];

const ChatroomPage = () => {
  const { styles } = useStyles();

  const [data, setData] = useState<TChatroomItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 30, total: 0 });

  // 篩選狀態
  const [name, setName] = useState<string | undefined>();

  const fetchData = useCallback(
    async (page = 1, pageSize = 30) => {
      setLoading(true);
      try {
        const params: { name?: string; page: number; pageSize: number } = { page, pageSize };
        if (name) params.name = name;

        const res = await chatroomApi.list(params);
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
    [name],
  );

  // 只在 mount 時自動查詢，篩選條件需點擊查詢按鈕
  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = () => {
    fetchData(1, pagination.pageSize);
  };

  const handleReset = () => {
    setName(undefined);
  };

  const handleTableChange = (paginationConfig: { current?: number; pageSize?: number }) => {
    fetchData(paginationConfig.current || 1, paginationConfig.pageSize || 30);
  };

  return (
    <>
      <Card className={styles.filterCard}>
        <div className={styles.filterRow}>
          <Input
            className={styles.filterInput}
            placeholder="名稱或 ID 搜尋"
            allowClear
            value={name}
            onChange={(e) => setName(e.target.value || undefined)}
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
      <Table<TChatroomItem>
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

export default ChatroomPage;
