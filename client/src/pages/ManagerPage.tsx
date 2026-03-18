import { useCallback, useEffect, useState } from 'react';
import { Table, Card, Button, Space, Modal, message, Tag, Form, Input, Select } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { createStyles } from 'antd-style';
import { adminApi } from '../api/admin';
import { useAuth } from '../context/AuthContext';
import type { TAdminItem } from '@shared/types/admin';
import type { ColumnsType } from 'antd/es/table';

const { Option } = Select;

const useStyles = createStyles(({ token }) => ({
  filterRow: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: token.marginSM,
    alignItems: 'center',
    marginBottom: token.marginMD,
  },
  filterItem: {
    minWidth: 160,
  },
}));

const ROLE_LABEL: Record<string, string> = {
  senior_manager: '進階管理員',
  general_manager: '一般管理員',
};

const ROLE_COLOR: Record<string, string> = {
  senior_manager: 'blue',
  general_manager: 'default',
};

type TFormValues = {
  username: string;
  password: string;
  role: 'general_manager' | 'senior_manager';
};

const ManagerPage = () => {
  const { styles } = useStyles();
  const { user } = useAuth();
  const [form] = Form.useForm<TFormValues>();

  const [data, setData] = useState<TAdminItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const res = await adminApi.list({ page, pageSize: pagination.pageSize });
        setData(res.data.data);
        setPagination(res.data.pagination);
      } catch {
        message.error('載入管理員列表失敗');
      } finally {
        setLoading(false);
      }
    },
    [pagination.pageSize],
  );

  useEffect(() => {
    fetchData(1);
  }, [fetchData]);

  const handleCreate = async (values: TFormValues) => {
    setSubmitting(true);
    try {
      await adminApi.create(values);
      message.success('新增管理員成功');
      form.resetFields();
      setModalOpen(false);
      fetchData(1);
    } catch {
      message.error('新增管理員失敗');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = (record: TAdminItem) => {
    const action = record.is_active ? '停用' : '啟用';
    Modal.confirm({
      title: `確認${action}帳號`,
      content: `確定要${action} ${record.username} 嗎？`,
      okText: `確認${action}`,
      cancelText: '取消',
      okType: record.is_active ? 'danger' : 'primary',
      onOk: async () => {
        try {
          await adminApi.toggle(record.id);
          message.success(`已${action} ${record.username}`);
          fetchData(pagination.page);
        } catch {
          message.error(`${action}失敗`);
        }
      },
    });
  };

  const handleRoleChange = async (record: TAdminItem, role: string) => {
    try {
      await adminApi.updateRole(record.id, { role: role as 'general_manager' | 'senior_manager' });
      message.success('角色更新成功');
      fetchData(pagination.page);
    } catch {
      message.error('角色更新失敗');
    }
  };

  const columns: ColumnsType<TAdminItem> = [
    {
      title: '帳號',
      dataIndex: 'username',
    },
    {
      title: '角色',
      dataIndex: 'role',
      render: (role: string, record: TAdminItem) => {
        const isSelf = record.id === user?.id;
        return isSelf ? (
          <Tag color={ROLE_COLOR[role]}>{ROLE_LABEL[role]}</Tag>
        ) : (
          <Select
            value={role}
            size="small"
            style={{ minWidth: 120 }}
            onChange={(val) => handleRoleChange(record, val)}
          >
            <Option value="senior_manager">進階管理員</Option>
            <Option value="general_manager">一般管理員</Option>
          </Select>
        );
      },
    },
    {
      title: '狀態',
      dataIndex: 'is_active',
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'green' : 'default'}>{isActive ? '啟用中' : '已停用'}</Tag>
      ),
    },
    {
      title: '建立時間',
      dataIndex: 'created_at',
      render: (val: string) => new Date(val).toLocaleDateString('zh-TW'),
    },
    {
      title: '操作',
      render: (_: unknown, record: TAdminItem) => {
        const isSelf = record.id === user?.id;
        const label = record.is_active ? '停用' : '啟用';
        return (
          <Button
            type="link"
            danger={record.is_active}
            disabled={isSelf}
            data-testid={`toggle-btn-${record.id}`}
            onClick={() => handleToggle(record)}
          >
            {label}
          </Button>
        );
      },
    },
  ];

  return (
    <>
      <Card
        title="帳號管理"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
            新增管理員
          </Button>
        }
      >
        <div className={styles.filterRow} />
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
        title="新增管理員"
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          form.resetFields();
        }}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item
            label="帳號"
            name="username"
            rules={[
              { required: true, message: '請輸入帳號' },
              { min: 3, message: '帳號至少 3 個字元' },
              { max: 50, message: '帳號最多 50 個字元' },
            ]}
          >
            <Input placeholder="請輸入帳號（至少 3 個字元）" />
          </Form.Item>
          <Form.Item
            label="密碼"
            name="password"
            rules={[
              { required: true, message: '請輸入密碼' },
              { min: 6, message: '密碼至少 6 個字元' },
            ]}
          >
            <Input.Password placeholder="請輸入密碼（至少 6 個字元）" />
          </Form.Item>
          <Form.Item label="角色" name="role" rules={[{ required: true, message: '請選擇角色' }]}>
            <Select placeholder="請選擇角色">
              <Option value="senior_manager">進階管理員</Option>
              <Option value="general_manager">一般管理員</Option>
            </Select>
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={submitting}>
                新增
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

export default ManagerPage;
