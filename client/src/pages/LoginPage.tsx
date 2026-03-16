import { createStyles } from 'antd-style';
import { Typography } from 'antd';

const useStyles = createStyles(() => ({
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
  },
}));

const LoginPage = () => {
  const { styles } = useStyles();
  return (
    <div className={styles.container}>
      <Typography.Title level={2}>登入頁面</Typography.Title>
    </div>
  );
};

export default LoginPage;
