import { ConfigProvider } from 'antd';
import { RouterProvider } from 'react-router-dom';
import theme from './theme';
import router from './router';

const App = () => {
  return (
    <ConfigProvider theme={theme}>
      {/* AuthProvider 預留位置（Phase 2 加入） */}
      <RouterProvider router={router} />
    </ConfigProvider>
  );
};

export default App;
