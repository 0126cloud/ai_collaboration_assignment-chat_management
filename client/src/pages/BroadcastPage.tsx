import { useCallback, useEffect, useState } from 'react';
import {
  Table,
  Card,
  Select,
  Button,
  Space,
  Modal,
  message,
  Tag,
  Form,
  Input,
  InputNumber,
  DatePicker,
  Tooltip,
} from 'antd';
import { SearchOutlined, ReloadOutlined, SendOutlined } from '@ant-design/icons';
import { createStyles } from 'antd-style';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { broadcastApi } from '../api/broadcast';
import { chatroomApi } from '../api/chatroom';
import type { TBroadcastItem, TBroadcastQuery, TBroadcastStatus } from '@shared/types/broadcast';
import type { TChatroomItem } from '@shared/types/chatroom';
import type { ColumnsType } from 'antd/es/table';

dayjs.extend(utc);
dayjs.extend(timezone);

const { Option } = Select;
const { TextArea } = Input;

const useStyles = createStyles(({ token }) => ({
  sendCard: {
    marginBottom: token.marginMD,
  },
  filterCard: {
    marginBottom: token.marginMD,
  },
  filterRow: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: token.marginSM,
    alignItems: 'center',
  },
  filterItem: {
    minWidth: 160,
  },
  messageCell: {
    maxWidth: 200,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    display: 'block',
  },
}));

const STATUS_COLOR: Record<TBroadcastStatus, string> = {
  scheduled: 'blue',
  active: 'green',
  expired: 'default',
};

const STATUS_LABEL: Record<TBroadcastStatus, string> = {
  scheduled: '未開始',
  active: '廣播中',
  expired: '已過期',
};

const formatTime = (value: string): string =>
  dayjs.utc(value).utcOffset(8).format('YYYY-MM-DD HH:mm:ss');

const formatDuration = (seconds: number): string => {
  if (seconds >= 3600) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return m > 0 ? `${h} 小時 ${m} 分鐘` : `${h} 小時`;
  }
  if (seconds >= 60) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s > 0 ? `${m} 分鐘 ${s} 秒` : `${m} 分鐘`;
  }
  return `${seconds} 秒`;
};

type TFilterValues = {
  status?: TBroadcastStatus;
  chatroom_id?: string;
};

type TSendFormValues = {
  message: string;
  chatroom_id: string;
  duration: number;
  start_at: ReturnType<typeof dayjs>;
};

const BroadcastPage = () => {
  const { styles } = useStyles();
  const [form] = Form.useForm<TSendFormValues>();

  const [data, setData] = useState<TBroadcastItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [filters, setFilters] = useState<TFilterValues>({});
  const [chatrooms, setChatrooms] = useState<TChatroomItem[]>([]);

  const fetchData = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const params: TBroadcastQuery = { ...filters, page, pageSize: pagination.pageSize };
        const res = await broadcastApi.list(params);
        setData(res.data.data);
        setPagination(res.data.pagination);
      } catch {
        message.error('載入廣播列表失敗');
      } finally {
        setLoading(false);
      }
    },
    [filters, pagination.pageSize],
  );

  useEffect(() => {
    fetchData(1);
  }, [fetchData]);

  useEffect(() => {
    chatroomApi
      .list({ pageSize: 100 })
      .then((res) => setChatrooms(res.data.data))
      .catch(() => {});
  }, []);

  const handleSend = async (values: TSendFormValues) => {
    setSending(true);
    try {
      await broadcastApi.create({
        message: values.message,
        chatroom_id: values.chatroom_id,
        duration: values.duration,
        start_at: values.start_at.utc().toISOString(),
      });
      message.success('廣播發送成功');
      form.resetFields();
      fetchData(1);
    } catch {
      message.error('廣播發送失敗');
    } finally {
      setSending(false);
    }
  };

  const handleRemove = (record: TBroadcastItem) => {
    Modal.confirm({
      title: '確認下架廣播',
      content: `確定要下架此廣播訊息嗎？\n「${record.message}」`,
      okText: '確認下架',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          await broadcastApi.remove(record.id);
          message.success('廣播已下架');
          fetchData(pagination.page);
        } catch {
          message.error('下架失敗');
        }
      },
    });
  };

  const columns: ColumnsType<TBroadcastItem> = [
    {
      title: '廣播內容',
      dataIndex: 'message',
      render: (text: string) => (
        <Tooltip title={text}>
          <span className={styles.messageCell}>{text}</span>
        </Tooltip>
      ),
    },
    {
      title: '目標聊天室',
      dataIndex: 'chatroom_id',
      render: (id: string) => (id === 'all' ? '全部聊天室' : id),
    },
    {
      title: '開始時間',
      dataIndex: 'start_at',
      render: (val: string) => formatTime(val),
    },
    {
      title: '時長',
      dataIndex: 'duration',
      render: (val: number) => formatDuration(val),
    },
    {
      title: '狀態',
      dataIndex: 'status',
      render: (status: TBroadcastStatus) => (
        <Tag color={STATUS_COLOR[status]}>{STATUS_LABEL[status]}</Tag>
      ),
    },
    {
      title: '發送者',
      dataIndex: 'operator',
    },
    {
      title: '操作',
      render: (_: unknown, record: TBroadcastItem) =>
        record.status === 'scheduled' || record.status === 'active' ? (
          <Button type="link" danger onClick={() => handleRemove(record)}>
            下架
          </Button>
        ) : null,
    },
  ];

  return (
    <>
      <Card title="發送廣播" className={styles.sendCard}>
        <Form form={form} layout="vertical" onFinish={handleSend}>
          <Form.Item
            label="廣播訊息內容"
            name="message"
            rules={[
              { required: true, message: '請輸入廣播訊息' },
              { max: 500, message: '廣播訊息最多 500 字' },
            ]}
          >
            <TextArea rows={3} showCount maxLength={500} placeholder="請輸入廣播訊息內容" />
          </Form.Item>
          <Form.Item
            label="目標聊天室"
            name="chatroom_id"
            rules={[{ required: true, message: '請選擇目標聊天室' }]}
          >
            <Select placeholder="請選擇目標聊天室">
              <Option value="all">全部聊天室</Option>
              {chatrooms.map((room) => (
                <Option key={room.id} value={room.id}>
                  {room.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            label="顯示時長（秒）"
            name="duration"
            rules={[
              { required: true, message: '請輸入顯示時長' },
              { type: 'number', min: 1, message: '顯示時長至少 1 秒' },
              { type: 'number', max: 86400, message: '顯示時長最多 86400 秒（24 小時）' },
            ]}
          >
            <InputNumber min={1} max={86400} style={{ width: '100%' }} placeholder="例：60" />
          </Form.Item>
          <Form.Item
            label="開始時間"
            name="start_at"
            rules={[{ required: true, message: '請選擇開始時間' }]}
          >
            <DatePicker showTime style={{ width: '100%' }} placeholder="請選擇廣播開始時間" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" icon={<SendOutlined />} loading={sending}>
              發送廣播
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Card title="廣播列表" className={styles.filterCard}>
        <div className={styles.filterRow} style={{ marginBottom: 16 }}>
          <Select
            placeholder="狀態篩選"
            allowClear
            className={styles.filterItem}
            onChange={(val) => setFilters((f) => ({ ...f, status: val }))}
          >
            <Option value="scheduled">未開始</Option>
            <Option value="active">廣播中</Option>
            <Option value="expired">已過期</Option>
          </Select>
          <Select
            placeholder="聊天室篩選"
            allowClear
            className={styles.filterItem}
            onChange={(val) => setFilters((f) => ({ ...f, chatroom_id: val }))}
          >
            <Option value="all">全部聊天室</Option>
            {chatrooms.map((room) => (
              <Option key={room.id} value={room.id}>
                {room.name}
              </Option>
            ))}
          </Select>
          <Space>
            <Button icon={<SearchOutlined />} type="primary" onClick={() => fetchData(1)}>
              查詢
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                setFilters({});
              }}
            >
              重置
            </Button>
          </Space>
        </div>

        <Table
          rowKey="id"
          columns={columns}
          dataSource={data}
          loading={loading}
          pagination={{
            current: pagination.page,
            pageSize: pagination.pageSize,
            total: pagination.total,
            onChange: (page) => fetchData(page),
          }}
        />
      </Card>
    </>
  );
};

export default BroadcastPage;
