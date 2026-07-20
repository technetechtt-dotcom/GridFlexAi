import React, { useEffect, useState, createContext, useContext, type ReactNode } from 'react';
import { auditLogger } from '../lib/auditLogger';
import {
  clearAuthToken,
  getAuthToken,
  getRefreshToken,
  getSessionUserFromToken,
  loginWithPassword,
  logoutSession,
  registerWithPassword,
  tryRefreshAccessToken } from
'../services/api';
interface User {
  id: string;
  name: string;
  role: 'operator' | 'manager' | 'admin' | 'developer';
  email: string;
}
interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
}
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: {children: ReactNode;}) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => getAuthToken());
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    const hydrateSession = async () => {
      if (!token) {
        if (!getRefreshToken()) {
          setUser(null);
          setIsLoading(false);
          return;
        }
        const refreshed = await tryRefreshAccessToken();
        if (!refreshed) {
          setUser(null);
          setIsLoading(false);
          return;
        }
      }

      const resolvedToken = getAuthToken();
      if (!resolvedToken) {
        setUser(null);
        setToken(null);
        setIsLoading(false);
        return;
      }

      const sessionUser = getSessionUserFromToken(resolvedToken);
      if (!sessionUser) {
        const refreshed = await tryRefreshAccessToken();
        if (!refreshed) {
          clearAuthToken();
          setToken(null);
          setUser(null);
          setIsLoading(false);
          return;
        }
        const retriedToken = getAuthToken();
        const retriedUser = retriedToken ? getSessionUserFromToken(retriedToken) : null;
        if (!retriedToken || !retriedUser) {
          setToken(null);
          setUser(null);
          setIsLoading(false);
          return;
        }
        setToken(retriedToken);
        setUser({
          id: retriedUser.id,
          name: retriedUser.name,
          role: retriedUser.role,
          email: retriedUser.email
        });
        setIsLoading(false);
        return;
      }

      setToken(resolvedToken);
      setUser({
        id: sessionUser.id,
        name: sessionUser.name,
        role: sessionUser.role,
        email: sessionUser.email
      });
      setIsLoading(false);
    };

    void hydrateSession();
  }, []);
  useEffect(() => {
    if (!token) return;

    const interval = setInterval(() => {
      void tryRefreshAccessToken().then((ok) => {
        if (!ok) {
          setUser(null);
          setToken(null);
          return;
        }
        const refreshed = getAuthToken();
        if (!refreshed) return;
        setToken(refreshed);
        const refreshedUser = getSessionUserFromToken(refreshed);
        if (refreshedUser) {
          setUser((prev) => ({
            id: refreshedUser.id,
            name: refreshedUser.name,
            role: refreshedUser.role,
            email: refreshedUser.email
          }));
        }
      });
    }, 10 * 60 * 1000);

    return () => clearInterval(interval);
  }, [token]);
  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const auth = await loginWithPassword(email, password);
      const apiUser: User = {
        id: auth.user.id,
        name: auth.user.name,
        role: auth.user.role,
        email: auth.user.email
      };
      setUser(apiUser);
      setToken(auth.token);
      auditLogger.log('USER_LOGIN', apiUser.id, {
        email
      });
    } finally {
      setIsLoading(false);
    }
  };
  const register = async (name: string, email: string, password: string) => {
    setIsLoading(true);
    try {
      const auth = await registerWithPassword(name, email, password);
      const apiUser: User = {
        id: auth.user.id,
        name: auth.user.name,
        role: auth.user.role,
        email: auth.user.email
      };
      setUser(apiUser);
      setToken(auth.token);
      auditLogger.log('USER_REGISTER', apiUser.id, {
        email
      });
    } finally {
      setIsLoading(false);
    }
  };
  const logout = async () => {
    if (user) {
      auditLogger.log('USER_LOGOUT', user.id);
    }
    await logoutSession();
    setUser(null);
    setToken(null);
  };
  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user && !!token,
        login,
        register,
        logout,
        isLoading
      }}>

      {children}
    </AuthContext.Provider>);

}
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
