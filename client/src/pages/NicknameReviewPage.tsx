import { useCallback, useEffect, useState } from 'react';
import { Table, Card, Select, Input, DatePicker, Button, Space, Modal, message, Tag } from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { createStyles } from 'antd-style';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { nicknameReviewApi } from '../api/nicknameReview';
import type {
  TNicknameReviewItem,
  TNicknameReviewQuery,
  TNicknameReviewStatus,
} from '@shared/types/nicknameReview';
import type { ColumnsType } from 'antd/es/table';

dayjs.extend(utc);
dayjs.extend(timezone);

const { RangePicker } = DatePicker;
const { Option } = Select;

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
    minWidth: 180,
  },
}));

const STATUS_COLOR: Record<TNicknameReviewStatus, string> = {
  pending: 'orange',
  approved: 'green',
  rejected: 'red',
};

const STATUS_LABEL: Record<TNicknameReviewStatus, string> = {
  pending: '待審核',
  approved: '已核准',
  rejected: '已駁回',
};

const formatTime = (value: string): string =>
  dayjs.utc(value).utcOffset(8).format('YYYY-MM-DD HH:mm:ss');

const NicknameReviewPage = () => {
  const { styles } = useStyles();

  const [data, setData] = useState<TNicknameReviewItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingUsername, setLoadingUsername] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 });

  const [statusFilter, setStatusFilter] = useState<TNicknameReviewStatus>('pending');
  const [username, setUsername] = useState<string | undefined>();
  const [nickname, setNickname] = useState<string | undefined>();
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);

  const fetchData = useCallback(
    async (page = pagination.page, pageSize = pagination.pageSize) => {
      setLoading(true);
      try {
        const params: TNicknameReviewQuery = { page, pageSize };
        params.status = statusFilter;
        if (username) params.username = username;
        if (nickname) params.nickname = nickname;
        if (dateRange?.[0]) params.applyStartDate = dateRange[0].toISOString();
        if (dateRange?.[1]) params.applyEndDate = dateRange[1].toISOString();

        const res = await nicknameReviewApi.list(params);
        setData(res.data.data);
        setPagination((prev) => ({ ...prev, page, pageSize, total: res.data.pagination.total }));
      } catch {
        message.error('載入資料失敗');
      } finally {
        setLoading(false);
      }
    },
    [statusFilter, username, nickname, dateRange, pagination.page, pagination.pageSize],
  );

  useEffect(() => {
    fetchData(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = () => fetchData(1);

  const handleReset = () => {
    setStatusFilter('pending');
    setUsername(undefined);
    setNickname(undefined);
    setDateRange(null);
  };

  const handleApprove = (record: TNicknameReviewItem) => {
    Modal.confirm({
      title: '確認核准',
      content: `確定核准玩家 ${record.username} 的暱稱申請「${record.nickname}」嗎？`,
      okText: '核准',
      cancelText: '取消',
      onOk: async () => {
        setLoadingUsername(record.username);
        try {
          await nicknameReviewApi.approve(record.username);
          message.success('暱稱申請已核准');
          fetchData(1);
        } catch {
          message.error('操作失敗');
        } finally {
          setLoadingUsername(null);
        }
      },
    });
  };

  const handleReject = (record: TNicknameReviewItem) => {
    Modal.confirm({
      title: '確認駁回',
      content: `確定駁回玩家 ${record.username} 的暱稱申請「${record.nickname}」嗎？暱稱將重設為帳號名稱。`,
      okText: '駁回',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        setLoadingUsername(record.username);
        try {
          await nicknameReviewApi.reject(record.username);
          message.success('暱稱申請已駁回');
          fetchData(1);
        } catch {
          message.error('操作失敗');
        } finally {
          setLoadingUsername(null);
        }
      },
    });
  };

  const columns: ColumnsType<TNicknameReviewItem> = [
    {
      title: '申請時間',
      dataIndex: 'nickname_apply_at',
      key: 'nickname_apply_at',
      render: (val: string) => formatTime(val),
    },
    {
      title: '玩家帳號',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: '申請暱稱',
      dataIndex: 'nickname',
      key: 'nickname',
    },
    {
      title: '狀態',
      dataIndex: 'nickname_review_status',
      key: 'nickname_review_status',
      render: (val: TNicknameReviewStatus | null) =>
        val ? <Tag color={STATUS_COLOR[val]}>{STATUS_LABEL[val]}</Tag> : '—',
    },
    {
      title: '審核者',
      dataIndex: 'nickname_reviewed_by',
      key: 'nickname_reviewed_by',
      render: (val: string | null) => val ?? '—',
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => {
        const isPending = record.nickname_review_status === 'pending';
        return (
          <Space>
            <Button
              type="primary"
              size="small"
              loading={loadingUsername === record.username}
              disabled={
                !isPending || (loadingUsername !== null && loadingUsername !== record.username)
              }
              onClick={() => handleApprove(record)}
            >
              核准
            </Button>
            <Button
              danger
              size="small"
              loading={loadingUsername === record.username}
              disabled={
                !isPending || (loadingUsername !== null && loadingUsername !== record.username)
              }
              onClick={() => handleReject(record)}
            >
              駁回
            </Button>
          </Space>
        );
      },
    },
  ];

  return (
    <>
      <Card className={styles.filterCard}>
        <div className={styles.filterRow}>
          <Select
            className={styles.filterItem}
            value={statusFilter}
            onChange={(v) => setStatusFilter(v)}
          >
            <Option value="pending">待審核</Option>
            <Option value="approved">已核准</Option>
            <Option value="rejected">已駁回</Option>
          </Select>
          <Input
            className={styles.filterItem}
            placeholder="玩家帳號"
            value={username}
            onChange={(e) => setUsername(e.target.value || undefined)}
            allowClear
          />
          <Input
            className={styles.filterItem}
            placeholder="申請暱稱"
            value={nickname}
            onChange={(e) => setNickname(e.target.value || undefined)}
            allowClear
          />
          <RangePicker
            value={dateRange}
            onChange={(v) => setDateRange(v as [dayjs.Dayjs | null, dayjs.Dayjs | null] | null)}
            showTime
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
            查詢
          </Button>
          <Button icon={<ReloadOutlined />} onClick={handleReset}>
            重置
          </Button>
        </div>
      </Card>

      <Table
        rowKey="username"
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={{
          current: pagination.page,
          pageSize: pagination.pageSize,
          total: pagination.total,
          onChange: (page, pageSize) => fetchData(page, pageSize),
        }}
      />
    </>
  );
};

export default NicknameReviewPage;
