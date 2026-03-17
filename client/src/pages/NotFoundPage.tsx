import { Button, Result } from 'antd';
import { createStyles } from 'antd-style';
import { useNavigate } from 'react-router-dom';

const useStyles = createStyles(({ token }) => ({
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: token.paddingXL,
  },
}));

const NotFoundPage = () => {
  const { styles } = useStyles();
  const navigate = useNavigate();

  return (
    <div className={styles.container}>
      <Result
        status="404"
        title="404"
        subTitle="抱歉，您訪問的頁面不存在"
        extra={
          <Button type="primary" onClick={() => navigate('/')}>
            返回首頁
          </Button>
        }
      />
    </div>
  );
};

export default NotFoundPage;
