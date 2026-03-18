import { useCallback, useEffect, useState } from 'react';
import { Table, Card, Select, Input, DatePicker, Button, Space, Modal, message, Tag } from 'antd';
import { SearchOutlined, ReloadOutlined, PlusOutlined } from '@ant-design/icons';
import { createStyles } from 'antd-style';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { blacklistApi } from '../api/blacklist';
import CreateBlacklistModal from '../components/CreateBlacklistModal';
import type { TBlacklistItem } from '@shared/types/blacklist';
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
  toolbar: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginBottom: token.marginSM,
  },
}));

const formatTime = (value: string): string =>
  dayjs.utc(value).tz('Asia/Taipei').format('YYYY-MM-DD HH:mm:ss');

const BlacklistPage = () => {
  const { styles } = useStyles();

  const [blockTypeFilter, setBlockTypeFilter] = useState<'player' | 'ip'>('player');
  const [data, setData] = useState<TBlacklistItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 30, total: 0 });

  // 篩選狀態
  const [target, setTarget] = useState<string | undefined>();
  const [reason, setReason] = useState<string | undefined>();
  const [chatroomId, setChatroomId] = useState<string | undefined>();
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);
  const [statusFilter, setStatusFilter] = useState<'blocked' | 'unblocked' | 'all'>('blocked');

  // Modal 狀態
  const [modalOpen, setModalOpen] = useState(false);
  const [modalInitialValues, setModalInitialValues] = useState<{
    blockType?: 'player' | 'ip';
  }>({});

  const fetchData = useCallback(
    async (page = 1, pageSize = 30) => {
      setLoading(true);
      try {
        const params = {
          page,
          pageSize,
          target: target || undefined,
          reason: reason || undefined,
          chatroomId: chatroomId || undefined,
          startDate: dateRange?.[0] ? dateRange[0].format('YYYY-MM-DD 00:00:00') : undefined,
          endDate: dateRange?.[1] ? dateRange[1].format('YYYY-MM-DD 23:59:59') : undefined,
          status: statusFilter,
        };

        const res =
          blockTypeFilter === 'ip'
            ? await blacklistApi.listIps(params)
            : await blacklistApi.listPlayers(params);

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
    [blockTypeFilter, target, reason, chatroomId, dateRange, statusFilter],
  );

  // 只在 mount 時自動查詢，所有篩選條件需點擊查詢按鈕
  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBlockTypeChange = (value: 'player' | 'ip') => {
    setBlockTypeFilter(value);
    setTarget(undefined);
    setReason(undefined);
    setChatroomId(undefined);
    setDateRange(null);
    setStatusFilter('blocked');
  };

  const handleSearch = () => {
    fetchData(1, pagination.pageSize);
  };

  const handleReset = () => {
    setTarget(undefined);
    setReason(undefined);
    setChatroomId(undefined);
    setDateRange(null);
    setStatusFilter('blocked');
  };

  const handleTableChange = (paginationConfig: { current?: number; pageSize?: number }) => {
    fetchData(paginationConfig.current || 1, paginationConfig.pageSize || 30);
  };

  const handleUnblock = (record: TBlacklistItem) => {
    Modal.confirm({
      title: '確認解封',
      content: `確定要解封 ${record.block_type === 'ip' ? 'IP' : '玩家'} "${record.target}" 嗎？`,
      okText: '確定解封',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          if (record.block_type === 'ip') {
            await blacklistApi.unblockIp(record.id);
          } else {
            await blacklistApi.unblockPlayer(record.id);
          }
          message.success('解封成功');
          fetchData(pagination.page, pagination.pageSize);
        } catch {
          message.error('解封失敗');
        }
      },
    });
  };

  const handleOpenModal = () => {
    setModalInitialValues({ blockType: blockTypeFilter });
    setModalOpen(true);
  };

  const columns: ColumnsType<TBlacklistItem> = [
    {
      title: '類型',
      dataIndex: 'block_type',
      key: 'block_type',
      width: 80,
      render: (value: string) => (value === 'ip' ? 'IP' : 'Player'),
    },
    {
      title: '目標',
      dataIndex: 'target',
      key: 'target',
      width: 160,
    },
    {
      title: '封鎖原因',
      dataIndex: 'reason',
      key: 'reason',
      width: 130,
    },
    {
      title: '操作者',
      dataIndex: 'operator',
      key: 'operator',
      width: 110,
    },
    {
      title: '聊天室',
      dataIndex: 'chatroom_id',
      key: 'chatroom_id',
      width: 130,
      render: (value: string) => (value === '*' ? '全域' : value),
    },
    {
      title: '封鎖時間',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (value: string) => formatTime(value),
    },
    {
      title: '狀態',
      dataIndex: 'is_blocked',
      key: 'is_blocked',
      width: 90,
      render: (value: boolean) =>
        value ? <Tag color="error">封鎖中</Tag> : <Tag color="default">已解封</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_: unknown, record: TBlacklistItem) =>
        record.is_blocked ? (
          <Button type="link" danger size="small" onClick={() => handleUnblock(record)}>
            解封
          </Button>
        ) : null,
    },
  ];

  return (
    <>
      <Card className={styles.filterCard}>
        <div className={styles.filterRow}>
          <Select
            className={styles.filterItem}
            value={blockTypeFilter}
            onChange={handleBlockTypeChange}
          >
            <Option value="player">Player</Option>
            <Option value="ip">IP</Option>
          </Select>
          <Select className={styles.filterItem} value={statusFilter} onChange={setStatusFilter}>
            <Option value="blocked">封鎖中</Option>
            <Option value="unblocked">已解封</Option>
            <Option value="all">全部</Option>
          </Select>
          <Input
            className={styles.filterInput}
            placeholder="目標（模糊搜尋）"
            allowClear
            value={target}
            onChange={(e) => setTarget(e.target.value || undefined)}
          />
          <Select
            className={styles.filterItem}
            placeholder="封鎖原因"
            allowClear
            value={reason}
            onChange={setReason}
          >
            <Option value="spam">spam</Option>
            <Option value="abuse">abuse</Option>
            <Option value="advertisement">advertisement</Option>
          </Select>
          <Input
            className={styles.filterInput}
            placeholder="聊天室（含 * 全域）"
            allowClear
            value={chatroomId}
            onChange={(e) => setChatroomId(e.target.value || undefined)}
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

      <div className={styles.toolbar}>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenModal}>
          新增封鎖
        </Button>
      </div>

      <Table<TBlacklistItem>
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

      <CreateBlacklistModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => fetchData(1, pagination.pageSize)}
        initialValues={modalInitialValues}
      />
    </>
  );
};

export default BlacklistPage;
