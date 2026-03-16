import { createStyles } from 'antd-style';
import { Layout, Typography } from 'antd';
import { Outlet } from 'react-router-dom';

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
  headerText: {
    color: token.colorTextLightSolid,
  },
  header: {
    padding: `0 ${token.paddingLG}px`,
  },
  content: {
    padding: token.paddingLG,
  },
}));

const AdminLayout = () => {
  const { styles } = useStyles();
  return (
    <Layout className={styles.layout}>
      <Sider>
        <Typography.Text className={styles.siderTitle}>聊天管理後台</Typography.Text>
      </Sider>
      <Layout>
        <Header className={styles.header}>
          <Typography.Text className={styles.headerText}>Header</Typography.Text>
        </Header>
        <Content className={styles.content}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default AdminLayout;
