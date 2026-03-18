import { ConfigProvider } from 'antd';
import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider, useTheme } from './theme/context/ThemeContext';
import { getTheme } from './theme';
import router from './router';

const AppContent = () => {
  const { resolvedMode } = useTheme();

  return (
    <ConfigProvider theme={getTheme(resolvedMode)}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ConfigProvider>
  );
};

const App = () => {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
};

export default App;
