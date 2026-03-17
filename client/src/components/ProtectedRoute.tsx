import { Navigate } from 'react-router-dom';
import { Spin } from 'antd';
import { createStyles } from 'antd-style';
import { useAuth } from '../context/AuthContext';
import type { ReactNode } from 'react';

interface IProtectedRouteProps {
  children: ReactNode;
  permission?: string;
}

const useStyles = createStyles(() => ({
  spinContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
  },
}));

const ProtectedRoute = ({ children, permission }: IProtectedRouteProps) => {
  const { styles } = useStyles();
  const { isAuthenticated, hasPermission, loading } = useAuth();

  if (loading) {
    return (
      <div className={styles.spinContainer}>
        <Spin size="large" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (permission && !hasPermission(permission)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
