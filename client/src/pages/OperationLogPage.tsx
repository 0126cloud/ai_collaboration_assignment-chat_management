import { useCallback, useEffect, useState } from 'react';
import { Table, Card, Select, Input, DatePicker, Button, Space, Tag, Tooltip } from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { createStyles } from 'antd-style';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { operationLogApi } from '../api/operationLog';
import { OPERATION_TYPES, OPERATION_TYPE_LABELS } from '@shared/types/operationLog';
import type {
  TOperationLogItem,
  TOperationLogQuery,
  TOperationLogRequest,
} from '@shared/types/operationLog';
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
    minWidth: 180,
  },
  requestDetail: {
    fontSize: token.fontSizeSM,
    lineHeight: 1.6,
  },
}));

const operationTypeOptions = OPERATION_TYPES.map((type) => ({
  label: OPERATION_TYPE_LABELS[type],
  value: type,
}));

const formatTime = (value: string): string =>
  dayjs.utc(value).tz('Asia/Taipei').format('YYYY-MM-DD HH:mm:ss');

const renderRequest = (request: TOperationLogRequest) => {
  const payloadStr = JSON.stringify(request.payload, null, 2);
  return (
    <Tooltip
      title={
        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 12 }}>
          {`${request.method} ${request.url}\n\n${payloadStr}`}
        </pre>
      }
    >
      <span>
        <Tag>{request.method}</Tag>
        {request.url}
      </span>
    </Tooltip>
  );
};

const columns: ColumnsType<TOperationLogItem> = [
  {
    title: '操作類型',
    dataIndex: 'operation_type',
    key: 'operation_type',
    width: 160,
    render: (type: TOperationLogItem['operation_type']) => (
      <Tag color="blue">{OPERATION_TYPE_LABELS[type] || type}</Tag>
    ),
  },
  {
    title: '操作者',
    dataIndex: 'operator',
    key: 'operator',
    width: 120,
  },
  {
    title: '請求資訊',
    dataIndex: 'request',
    key: 'request',
    render: (request: TOperationLogRequest) => renderRequest(request),
  },
  {
    title: '操作時間',
    dataIndex: 'created_at',
    key: 'created_at',
    width: 180,
    render: (value: string) => formatTime(value),
  },
];

const OperationLogPage = () => {
  const { styles } = useStyles();

  const [data, setData] = useState<TOperationLogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 });

  // 篩選狀態
  const [operationType, setOperationType] = useState<string | undefined>();
  const [operator, setOperator] = useState<string | undefined>();
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);

  const fetchData = useCallback(
    async (page = 1, pageSize = 20) => {
      setLoading(true);
      try {
        const params: TOperationLogQuery = { page, pageSize };
        if (operationType)
          params.operationType = operationType as TOperationLogQuery['operationType'];
        if (operator) params.operator = operator;
        if (dateRange?.[0]) params.startDate = dateRange[0].format('YYYY-MM-DD 00:00:00');
        if (dateRange?.[1]) params.endDate = dateRange[1].format('YYYY-MM-DD 23:59:59');

        const res = await operationLogApi.list(params);
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
    [operationType, operator, dateRange],
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSearch = () => {
    fetchData(1, pagination.pageSize);
  };

  const handleReset = () => {
    setOperationType(undefined);
    setOperator(undefined);
    setDateRange(null);
  };

  const handleTableChange = (paginationConfig: { current?: number; pageSize?: number }) => {
    fetchData(paginationConfig.current || 1, paginationConfig.pageSize || 20);
  };

  return (
    <>
      <Card className={styles.filterCard}>
        <div className={styles.filterRow}>
          <Select
            className={styles.filterItem}
            placeholder="操作類型"
            allowClear
            options={operationTypeOptions}
            value={operationType}
            onChange={setOperationType}
          />
          <Input
            className={styles.filterItem}
            placeholder="操作者"
            allowClear
            value={operator}
            onChange={(e) => setOperator(e.target.value || undefined)}
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
      <Table<TOperationLogItem>
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

export default OperationLogPage;
