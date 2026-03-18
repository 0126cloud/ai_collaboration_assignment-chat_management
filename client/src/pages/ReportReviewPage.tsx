import { useCallback, useEffect, useState } from 'react';
import {
  Table,
  Card,
  Select,
  Input,
  DatePicker,
  Button,
  Space,
  Modal,
  message,
  Tag,
  Tooltip,
} from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { createStyles } from 'antd-style';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { reportApi } from '../api/report';
import type { TReportItem, TReportQuery, TReportStatus, TReportReason } from '@shared/types/report';
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
    width: 250,
  },
  filterInput: {
    maxWidth: 300,
  },
  messageCell: {
    maxWidth: 200,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    display: 'block',
  },
}));

const formatTime = (value: string): string =>
  dayjs.utc(value).utcOffset(8).format('YYYY-MM-DD HH:mm:ss');

const STATUS_COLOR: Record<TReportStatus, string> = {
  pending: 'orange',
  approved: 'green',
  rejected: 'red',
};

const STATUS_LABEL: Record<TReportStatus, string> = {
  pending: '待審核',
  approved: '已核准',
  rejected: '已駁回',
};

const REASON_COLOR: Record<TReportReason, string> = {
  spam: 'orange',
  abuse: 'red',
  advertisement: 'blue',
};

const REASON_LABEL: Record<TReportReason, string> = {
  spam: '垃圾訊息',
  abuse: '不當言論',
  advertisement: '廣告',
};

const ReportReviewPage = () => {
  const { styles } = useStyles();

  const [data, setData] = useState<TReportItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 });

  const [statusFilter, setStatusFilter] = useState<TReportStatus>('pending');
  const [reporterUsername, setReporterUsername] = useState<string | undefined>();
  const [targetUsername, setTargetUsername] = useState<string | undefined>();
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);

  const fetchData = useCallback(
    async (page = pagination.page, pageSize = pagination.pageSize) => {
      setLoading(true);
      try {
        const params: TReportQuery = { page, pageSize, status: statusFilter };
        if (reporterUsername) params.reporterUsername = reporterUsername;
        if (targetUsername) params.targetUsername = targetUsername;
        if (dateRange?.[0]) params.startDate = dateRange[0].toISOString();
        if (dateRange?.[1]) params.endDate = dateRange[1].toISOString();

        const res = await reportApi.list(params);
        setData(res.data.data);
        setPagination((prev) => ({ ...prev, page, pageSize, total: res.data.pagination.total }));
      } catch {
        message.error('載入資料失敗');
      } finally {
        setLoading(false);
      }
    },
    [
      statusFilter,
      reporterUsername,
      targetUsername,
      dateRange,
      pagination.page,
      pagination.pageSize,
    ],
  );

  useEffect(() => {
    fetchData(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = () => fetchData(1);

  const handleReset = () => {
    setStatusFilter('pending');
    setReporterUsername(undefined);
    setTargetUsername(undefined);
    setDateRange(null);
  };

  const handleApprove = (record: TReportItem) => {
    Modal.confirm({
      title: '確認核准',
      content: `確定核准此檢舉嗎？核准後將自動封鎖被檢舉玩家「${record.target_username}」。`,
      okText: '核准',
      cancelText: '取消',
      onOk: async () => {
        setLoadingId(record.id);
        try {
          await reportApi.approve(record.id);
          message.success('檢舉已核准，被檢舉玩家已封鎖');
          fetchData(1);
        } catch {
          message.error('操作失敗');
        } finally {
          setLoadingId(null);
        }
      },
    });
  };

  const handleReject = (record: TReportItem) => {
    Modal.confirm({
      title: '確認駁回',
      content: `確定駁回此檢舉嗎？`,
      okText: '駁回',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        setLoadingId(record.id);
        try {
          await reportApi.reject(record.id);
          message.success('檢舉已駁回');
          fetchData(1);
        } catch {
          message.error('操作失敗');
        } finally {
          setLoadingId(null);
        }
      },
    });
  };

  const columns: ColumnsType<TReportItem> = [
    {
      title: '舉報時間',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (val: string) => formatTime(val),
    },
    {
      title: '檢舉人',
      dataIndex: 'reporter_username',
      key: 'reporter_username',
    },
    {
      title: '被檢舉玩家',
      dataIndex: 'target_username',
      key: 'target_username',
    },
    {
      title: '聊天室',
      dataIndex: 'chatroom_id',
      key: 'chatroom_id',
    },
    {
      title: '原因',
      dataIndex: 'reason',
      key: 'reason',
      render: (val: TReportReason) => <Tag color={REASON_COLOR[val]}>{REASON_LABEL[val]}</Tag>,
    },
    {
      title: '訊息內容',
      dataIndex: 'chat_message',
      key: 'chat_message',
      render: (val: string) => (
        <Tooltip title={val}>
          <span className={styles.messageCell}>{val}</span>
        </Tooltip>
      ),
    },
    {
      title: '狀態',
      dataIndex: 'status',
      key: 'status',
      render: (val: TReportStatus) => <Tag color={STATUS_COLOR[val]}>{STATUS_LABEL[val]}</Tag>,
    },
    {
      title: '審核者',
      dataIndex: 'reviewed_by',
      key: 'reviewed_by',
      render: (val: string | null) => val ?? '—',
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => {
        const isPending = record.status === 'pending';
        return (
          <Space>
            <Button
              type="primary"
              size="small"
              loading={loadingId === record.id}
              disabled={!isPending || (loadingId !== null && loadingId !== record.id)}
              onClick={() => handleApprove(record)}
            >
              核准
            </Button>
            <Button
              danger
              size="small"
              loading={loadingId === record.id}
              disabled={!isPending || (loadingId !== null && loadingId !== record.id)}
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
            className={styles.filterInput}
            placeholder="檢舉人帳號"
            value={reporterUsername}
            onChange={(e) => setReporterUsername(e.target.value || undefined)}
            allowClear
          />
          <Input
            className={styles.filterInput}
            placeholder="被檢舉玩家帳號"
            value={targetUsername}
            onChange={(e) => setTargetUsername(e.target.value || undefined)}
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
        rowKey="id"
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

export default ReportReviewPage;
