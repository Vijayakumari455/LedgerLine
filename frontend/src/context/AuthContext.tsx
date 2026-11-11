import { createContext, useContext, useState, useEffect, ReactNode, FC } from 'react';
import { User, Account } from '../types/index.js';
import { authApi, setCsrfToken } from '../api/client.js';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (data: { email: string; password: string }) => Promise<void>;
  register: (data: { email: string; fullName: string; password: string }) => Promise<{
    message: string;
    user: User;
    account?: Account;
  }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Restore session from HttpOnly cookie on initial mount
  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      try {
        const response = await authApi.getMe();
        if (isMounted && response?.user) {
          setUser(response.user);
          if (response.csrfToken) {
            setCsrfToken(response.csrfToken);
          }
        }
      } catch {
        if (isMounted) {
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (data: { email: string; password: string }): Promise<void> => {
    const res = await authApi.login(data);
    setUser(res.user);
    if (res.csrfToken) {
      setCsrfToken(res.csrfToken);
    }
  };

  const register = async (data: { email: string; fullName: string; password: string }) => {
    const res = await authApi.register(data);
    return res;
  };

  const logout = async (): Promise<void> => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
      setCsrfToken(null);
    }
  };

  const refreshUser = async (): Promise<void> => {
    try {
      const response = await authApi.getMe();
      if (response?.user) {
        setUser(response.user);
      }
    } catch {
      // If fetching me fails (e.g. session expired or revoked), clear user
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

