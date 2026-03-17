import { createStyles } from 'antd-style';
import { Card, Form, Input, Button, Typography, message } from 'antd';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { useNavigate, Navigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { zodToAntdRules } from '../utils/zodToAntdRules';
import { loginSchema } from '@shared/schemas/auth';
import type { TLoginPayload } from '@shared/types/auth';

const rules = zodToAntdRules(loginSchema);

const useStyles = createStyles(({ token }) => ({
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    background: token.colorBgLayout,
  },
  card: {
    width: 400,
  },
  title: {
    textAlign: 'center' as const,
    marginBottom: token.marginLG,
  },
}));

const LoginPage = () => {
  const { styles } = useStyles();
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const onFinish = async (values: TLoginPayload) => {
    setLoading(true);
    try {
      await login(values.username, values.password);
      navigate('/');
    } catch (err: unknown) {
      const errorMessage =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || '登入失敗';
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <Card className={styles.card}>
        <Typography.Title level={3} className={styles.title}>
          聊天管理後台
        </Typography.Title>
        <Form<TLoginPayload> onFinish={onFinish} autoComplete="off">
          <Form.Item name="username" rules={rules.username}>
            <Input prefix={<UserOutlined />} placeholder="帳號" size="large" />
          </Form.Item>
          <Form.Item name="password" rules={rules.password}>
            <Input.Password prefix={<LockOutlined />} placeholder="密碼" size="large" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block size="large">
              登入
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default LoginPage;
