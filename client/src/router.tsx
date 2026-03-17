import { createBrowserRouter } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import AdminLayout from './layouts/AdminLayout';
import ProtectedRoute from './components/ProtectedRoute';
import NotFoundPage from './pages/NotFoundPage';
import OperationLogPage from './pages/OperationLogPage';
import ChatroomPage from './pages/ChatroomPage';
import ChatMonitoringPage from './pages/ChatMonitoringPage';
import BlacklistPage from './pages/BlacklistPage';
import NicknameReviewPage from './pages/NicknameReviewPage';
import ReportReviewPage from './pages/ReportReviewPage';
import BroadcastPage from './pages/BroadcastPage';

const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AdminLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        path: 'operation-logs',
        element: (
          <ProtectedRoute permission="operation_log:read">
            <OperationLogPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'chatrooms',
        element: (
          <ProtectedRoute permission="chatroom:read">
            <ChatroomPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'chat',
        element: (
          <ProtectedRoute permission="chat:read">
            <ChatMonitoringPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'blacklist',
        element: (
          <ProtectedRoute permission="blacklist:read">
            <BlacklistPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'nickname-reviews',
        element: (
          <ProtectedRoute permission="nickname:read">
            <NicknameReviewPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'reports',
        element: (
          <ProtectedRoute permission="report:read">
            <ReportReviewPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'broadcasts',
        element: (
          <ProtectedRoute permission="broadcast:read">
            <BroadcastPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
]);

export default router;
