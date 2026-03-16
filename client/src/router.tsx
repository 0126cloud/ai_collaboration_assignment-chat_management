import { createBrowserRouter } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import AdminLayout from './layouts/AdminLayout';

const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: <AdminLayout />,
    children: [
      // Phase 2+ 逐步加入各頁面路由
    ],
  },
]);

export default router;
