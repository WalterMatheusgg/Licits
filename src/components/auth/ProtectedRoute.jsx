import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import AccountBlocked from '@/components/auth/AccountBlocked';
import LoadingScreen from '@/components/auth/LoadingScreen';

export default function ProtectedRoute() {
  const location = useLocation();
  const { isAuthenticated, isLoadingAuth, authChecked, authError } = useAuth();

  if (isLoadingAuth || !authChecked) return <LoadingScreen />;

  if (authError?.type === 'user_blocked' || authError?.type === 'user_inactive') {
    return <AccountBlocked message={authError.message} />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
