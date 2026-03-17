import { createStyles } from 'antd-style';
import { Layout, Menu, Typography, Button } from 'antd';
import {
  MessageOutlined,
  StopOutlined,
  TeamOutlined,
  SoundOutlined,
  FileTextOutlined,
  WarningOutlined,
  UserOutlined,
  SettingOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const { Header, Sider, Content } = Layout;

const useStyles = createStyles(({ token }) => ({
  layout: {
    minHeight: '100vh',
  },
  siderTitle: {
    color: token.colorTextLightSolid,
    padding: token.padding,
    display: 'block',
  },
  header: {
    padding: `0 ${token.paddingLG}px`,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerText: {
    color: token.colorTextLightSolid,
  },
  logoutButton: {
    color: token.colorTextLightSolid,
  },
  content: {
    padding: token.paddingLG,
  },
}));

const allMenuItems = [
  {
    key: '/chat',
    label: '聊天監控',
    icon: <MessageOutlined />,
    permission: 'chat:read',
  },
  {
    key: '/blacklist',
    label: '黑名單管理 (IP, Player)',
    icon: <StopOutlined />,
    permission: 'blacklist:read',
  },
  {
    key: '/chatrooms',
    label: '聊天室',
    icon: <TeamOutlined />,
    permission: 'chatroom:read',
  },
  {
    key: '/broadcasts',
    label: '系統廣播',
    icon: <SoundOutlined />,
    permission: 'broadcast:read',
  },
  {
    key: '/operation-logs',
    label: '操作紀錄',
    icon: <FileTextOutlined />,
    permission: 'operation_log:read',
  },
  {
    key: '/reports',
    label: '玩家檢舉',
    icon: <WarningOutlined />,
    permission: 'report:read',
  },
  {
    key: '/nickname-requests',
    label: '暱稱審核',
    icon: <UserOutlined />,
    permission: 'nickname:read',
  },
  {
    key: '/admins',
    label: '帳號管理',
    icon: <SettingOutlined />,
    permission: 'admin:read',
  },
];

const AdminLayout = () => {
  const { styles } = useStyles();
  const { user, logout, hasPermission } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = allMenuItems.filter((item) => hasPermission(item.permission));

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <Layout className={styles.layout}>
      <Sider>
        <Typography.Text className={styles.siderTitle}>聊天管理後台</Typography.Text>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={handleMenuClick}
        />
      </Sider>
      <Layout>
        <Header className={styles.header}>
          <Typography.Text className={styles.headerText}>{user?.username}</Typography.Text>
          <Button
            type="text"
            icon={<LogoutOutlined />}
            onClick={handleLogout}
            className={styles.logoutButton}
          >
            登出
          </Button>
        </Header>
        <Content className={styles.content}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default AdminLayout;
