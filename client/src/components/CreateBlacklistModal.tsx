import { useEffect, useState } from 'react';
import { Modal, Form, Select, Input, message } from 'antd';
import { createStyles } from 'antd-style';
import { blacklistApi } from '../api/blacklist';
import { chatroomApi } from '../api/chatroom';

const { Option } = Select;

type TCreateBlacklistModalProps = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialValues?: {
    blockType?: 'player' | 'ip';
    target?: string;
    chatroomId?: string;
  };
};

const useStyles = createStyles(({ token }) => ({
  form: {
    marginTop: token.marginMD,
  },
}));

const IP_PATTERN = /^(\d{1,3}\.){3}(\d{1,3}|\*)$/;

const CreateBlacklistModal = ({
  open,
  onClose,
  onSuccess,
  initialValues,
}: TCreateBlacklistModalProps) => {
  const { styles } = useStyles();
  const [form] = Form.useForm();
  const [blockType, setBlockType] = useState<'player' | 'ip'>(initialValues?.blockType ?? 'player');
  const [loading, setLoading] = useState(false);
  const [chatroomOptions, setChatroomOptions] = useState<{ label: string; value: string }[]>([]);

  useEffect(() => {
    const loadChatrooms = async () => {
      try {
        const res = await chatroomApi.list({ pageSize: 100 });
        setChatroomOptions(
          res.data.data.map((room) => ({ label: `${room.name} (${room.id})`, value: room.id })),
        );
      } catch {
        // 靜默處理
      }
    };
    loadChatrooms();
  }, []);

  useEffect(() => {
    if (open) {
      const initType = initialValues?.blockType ?? 'player';
      setBlockType(initType);
      form.setFieldsValue({
        blockType: initType,
        target: initialValues?.target ?? '',
        chatroom_id: initialValues?.chatroomId ?? '*',
        reason: undefined,
      });
    }
  }, [open, initialValues, form]);

  const handleBlockTypeChange = (value: 'player' | 'ip') => {
    setBlockType(value);
    form.setFieldValue('target', '');
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const payload = {
        target: values.target,
        reason: values.reason,
        chatroom_id: values.chatroom_id || '*',
      };

      if (blockType === 'ip') {
        await blacklistApi.blockIp(payload);
      } else {
        await blacklistApi.blockPlayer(payload);
      }

      message.success('封鎖成功');
      form.resetFields();
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      if (axiosErr?.response?.data?.error?.message) {
        message.error(axiosErr.response.data.error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onClose();
  };

  return (
    <Modal
      title="新增封鎖"
      open={open}
      onOk={handleSubmit}
      onCancel={handleCancel}
      okText="確認"
      cancelText="取消"
      confirmLoading={loading}
    >
      <Form form={form} layout="vertical" className={styles.form}>
        <Form.Item name="blockType" label="類型" initialValue="player">
          <Select onChange={handleBlockTypeChange}>
            <Option value="player">Player</Option>
            <Option value="ip">IP</Option>
          </Select>
        </Form.Item>

        <Form.Item
          name="target"
          label="目標"
          rules={[
            { required: true, message: blockType === 'ip' ? '請輸入 IP 位址' : '請輸入玩家帳號' },
            ...(blockType === 'ip'
              ? [
                  {
                    pattern: IP_PATTERN,
                    message: 'IP 格式不正確，支援精確 IP 或萬用字元（如 116.62.238.*）',
                  },
                ]
              : []),
          ]}
        >
          <Input placeholder={blockType === 'ip' ? '如 192.168.1.1 或 116.62.238.*' : '玩家帳號'} />
        </Form.Item>

        <Form.Item
          name="reason"
          label="封鎖原因"
          rules={[{ required: true, message: '請選擇封鎖原因' }]}
        >
          <Select placeholder="選擇原因">
            <Option value="spam">spam</Option>
            <Option value="abuse">abuse</Option>
            <Option value="advertisement">advertisement</Option>
          </Select>
        </Form.Item>

        <Form.Item name="chatroom_id" label="聊天室（選填）">
          <Select placeholder="全域（*）" allowClear defaultValue="*">
            <Option value="*">全域（*）</Option>
            {chatroomOptions.map((opt) => (
              <Option key={opt.value} value={opt.value}>
                {opt.label}
              </Option>
            ))}
          </Select>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default CreateBlacklistModal;
