import { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth.store.js';

export function AuthGuard() {
  const storeToken = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const loadUser = useAuthStore((s) => s.loadUser);
  const localToken =
    typeof window !== 'undefined' ? sessionStorage.getItem('token') : null;
  const hasToken = storeToken || localToken;

  if (!hasToken) return <Navigate to="/login" replace />;

  // Sync store if they diverge
  if (localToken && !storeToken) {
    useAuthStore.setState({ token: localToken });
  }

  // Load user info if we have a token but no user
  useEffect(() => {
    if (hasToken && !user) {
      loadUser();
    }
  }, [hasToken, user, loadUser]);

  return <Outlet />;
}
