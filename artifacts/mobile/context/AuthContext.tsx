import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getCurrentUser,
  login,
  logout,
  refreshSession,
  signUp,
  type AuthResponse,
  type AuthSession,
  type AuthUser,
} from '@workspace/api-client-react';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

import { getApiBase } from '@/constants/config';
import { setAuthTokenGetter, setBaseUrl } from '@workspace/api-client-react';

const ACCESS_TOKEN_KEY = 'cc_auth_access_token';
const REFRESH_TOKEN_KEY = 'cc_auth_refresh_token';

setBaseUrl(getApiBase() || null);
setAuthTokenGetter(() => AsyncStorage.getItem(ACCESS_TOKEN_KEY));

interface AuthContextValue {
  user: AuthUser | null;
  session: AuthSession | null;
  isLoaded: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<AuthResponse>;
  signUp: (email: string, password: string) => Promise<AuthResponse>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function storeSession(next: AuthSession | null): Promise<void> {
  if (!next) {
    await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY]);
    return;
  }
  await AsyncStorage.multiSet([
    [ACCESS_TOKEN_KEY, next.accessToken],
    [REFRESH_TOKEN_KEY, next.refreshToken],
  ]);
}

export function getStoredAccessTokenKey(): string {
  return ACCESS_TOKEN_KEY;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const applyResponse = useCallback(async (response: AuthResponse) => {
    if (response.session) {
      await storeSession(response.session);
      setSession(response.session);
      setUser(response.session.user);
    } else {
      setSession(null);
      setUser(response.user ?? null);
    }
    return response;
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [accessToken, refreshToken] = await Promise.all([
          AsyncStorage.getItem(ACCESS_TOKEN_KEY),
          AsyncStorage.getItem(REFRESH_TOKEN_KEY),
        ]);
        if (!accessToken || !refreshToken) return;

        try {
          const currentUser = await getCurrentUser();
          if (active) setUser(currentUser);
        } catch {
          const refreshed = await refreshSession({ refreshToken });
          if (active) await applyResponse(refreshed);
        }
      } catch {
        await storeSession(null);
        if (active) {
          setSession(null);
          setUser(null);
        }
      } finally {
        if (active) setIsLoaded(true);
      }
    })();

    return () => {
      active = false;
    };
  }, [applyResponse]);

  const signIn = useCallback(async (email: string, password: string) => {
    return applyResponse(await login({ email: email.trim(), password }));
  }, [applyResponse]);

  const signUpAccount = useCallback(async (email: string, password: string) => {
    return applyResponse(await signUp({ email: email.trim(), password }));
  }, [applyResponse]);

  const signOut = useCallback(async () => {
    try {
      if (session) await logout();
    } finally {
      await storeSession(null);
      setSession(null);
      setUser(null);
    }
  }, [session]);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoaded,
        isAuthenticated: Boolean(session && user),
        signIn,
        signUp: signUpAccount,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}