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
  SunOutlined,
  MoonOutlined,
  DesktopOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme/context/ThemeContext';

const { Header, Sider, Content } = Layout;

const useStyles = createStyles(({ token }) => ({
  layout: {
    minHeight: '100vh',
  },
  siderTitle: {
    color: token.colorText,
    padding: `20px ${token.padding}px 24px 28px`,
    display: 'block',
    marginBottom: `${token.paddingLG}px`,
  },
  header: {
    padding: `30px ${token.paddingLG}px`,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
  },
  logoutButton: {
    color: token.colorText,
  },
  themeButton: {
    color: token.colorText,
  },
  content: {
    padding: token.paddingMD,
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
    label: '黑名單管理',
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
    key: '/nickname-reviews',
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

const themeIcon = {
  light: <SunOutlined />,
  dark: <MoonOutlined />,
  system: <DesktopOutlined />,
};

const AdminLayout = () => {
  const { styles } = useStyles();
  const { user, logout, hasPermission } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { mode, toggleTheme } = useTheme();

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
      <Sider width={140}>
        <Typography.Title level={5} className={styles.siderTitle}>
          聊天管理後台
        </Typography.Title>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={handleMenuClick}
        />
      </Sider>
      <Layout>
        <Header className={styles.header}>
          <div></div>
          <div className={styles.headerRight}>
            <Button
              type="text"
              icon={themeIcon[mode]}
              onClick={toggleTheme}
              className={styles.themeButton}
            >
              主題
            </Button>
            <Button
              type="text"
              icon={<LogoutOutlined />}
              onClick={handleLogout}
              className={styles.logoutButton}
            >
              登出 {user?.username}
            </Button>
          </div>
        </Header>
        <Content className={styles.content}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default AdminLayout;
