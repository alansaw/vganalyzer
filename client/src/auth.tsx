import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api/client';
import { LoginPage } from './pages/Login';
import { Loading } from './components/States';
import type { AuthInfo } from './types';

interface AuthContextValue {
  auth: AuthInfo;
  logout: () => void;
}

// Default: admin with auth disabled — what the API reports when no passwords
// are configured (local dev). Also lets component tests render without a gate.
const AuthContext = createContext<AuthContextValue>({
  auth: { role: 'admin', authEnabled: false },
  logout: () => {},
});

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

export function useIsAdmin(): boolean {
  return useAuth().auth.role === 'admin';
}

// Wraps the app: shows the login page until there is a valid session (or auth
// is disabled), then provides { role, authEnabled } to the tree.
export function AuthGate({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ['auth', 'me'], queryFn: api.getMe, retry: false, staleTime: 5 * 60_000 });

  useEffect(() => {
    const onUnauthorized = () => qc.invalidateQueries({ queryKey: ['auth'] });
    window.addEventListener('vg:unauthorized', onUnauthorized);
    return () => window.removeEventListener('vg:unauthorized', onUnauthorized);
  }, [qc]);

  if (me.isLoading) return <Loading label="Loading…" />;

  if (me.isError || !me.data) {
    return (
      <LoginPage
        onSuccess={() => {
          qc.clear(); // drop any cached data from a previous session/role
          qc.invalidateQueries();
        }}
      />
    );
  }

  const logout = async () => {
    try {
      await api.logout();
    } finally {
      qc.clear();
      qc.invalidateQueries({ queryKey: ['auth'] });
    }
  };

  return <AuthContext.Provider value={{ auth: me.data, logout }}>{children}</AuthContext.Provider>;
}
