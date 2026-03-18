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
import { SearchOutlined, ReloadOutlined, SendOutlined, PlusOutlined } from '@ant-design/icons';
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
  filterCard: {
    marginBottom: token.marginMD,
  },
  filterRow: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: token.marginSM,
    alignItems: 'center',
    marginBottom: token.marginMD,
  },
  filterItem: {
    width: 250,
  },
  messageCell: {
    maxWidth: 200,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    display: 'block',
  },
  formControl: {
    width: '100%',
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
  const [modalOpen, setModalOpen] = useState(false);
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

  // 只在 mount 時自動查詢，篩選條件需點擊查詢按鈕
  useEffect(() => {
    fetchData(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    chatroomApi
      .list({ pageSize: 100 })
      .then((res) => setChatrooms(res.data.data))
      .catch(() => {});
  }, []);

  const handleSend = (values: TSendFormValues) => {
    Modal.confirm({
      title: '確認發送廣播',
      content: `確定要發送此廣播訊息嗎？`,
      okText: '確認發送',
      cancelText: '取消',
      onOk: async () => {
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
          setModalOpen(false);
          fetchData(1);
        } catch {
          message.error('廣播發送失敗');
        } finally {
          setSending(false);
        }
      },
    });
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
      <Card
        title="廣播列表"
        className={styles.filterCard}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
            新增廣播
          </Button>
        }
      >
        <div className={styles.filterRow}>
          <Select
            placeholder="狀態篩選"
            allowClear
            className={styles.filterItem}
            value={filters.status}
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
            value={filters.chatroom_id}
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

      <Modal
        title="新增廣播"
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          form.resetFields();
        }}
        footer={null}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSend}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.preventDefault();
          }}
        >
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
            <InputNumber min={1} max={86400} className={styles.formControl} placeholder="例：60" />
          </Form.Item>
          <Form.Item
            label="開始時間"
            name="start_at"
            rules={[{ required: true, message: '請選擇開始時間' }]}
          >
            <DatePicker showTime className={styles.formControl} placeholder="請選擇廣播開始時間" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" icon={<SendOutlined />} loading={sending}>
                發送廣播
              </Button>
              <Button
                onClick={() => {
                  setModalOpen(false);
                  form.resetFields();
                }}
              >
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default BroadcastPage;
