import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth.store.js';

export function AuthGuard() {
  const storeToken = useAuthStore((s) => s.token);
  const localToken =
    typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const hasToken = storeToken || localToken;

  if (!hasToken) return <Navigate to="/login" replace />;

  // Sync store if they diverge
  if (localToken && !storeToken) {
    useAuthStore.setState({ token: localToken });
  }

  return <Outlet />;
}
