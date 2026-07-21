import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { FileBrowserClient } from '../api/FileBrowserClient';
import { ApiError, AuthenticatedUser, ServerConnection } from '../types';
import { normalizeServerUrl } from '../utils/path';

const SERVER_KEY = 'filebrowser.serverUrl';
const TOKEN_KEY = 'filebrowser.jwt';

type SessionContextValue = {
  booting: boolean;
  client: FileBrowserClient | null;
  connection: ServerConnection | null;
  user: AuthenticatedUser | null;
  savedServerUrl: string;
  connect: (baseUrl: string, username: string, password: string) => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  forgetServer: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [booting, setBooting] = useState(true);
  const [client, setClient] = useState<FileBrowserClient | null>(null);
  const [connection, setConnection] = useState<ServerConnection | null>(null);
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [savedServerUrl, setSavedServerUrl] = useState('');

  const configureClient = useCallback((next: FileBrowserClient) => {
    next.onUnauthorized = () => {
      setUser(null);
      void SecureStore.deleteItemAsync(TOKEN_KEY);
    };
    setClient(next);
  }, []);

  useEffect(() => {
    Promise.all([AsyncStorage.getItem(SERVER_KEY), SecureStore.getItemAsync(TOKEN_KEY)])
      .then(async ([url, token]) => {
        if (!url) return;
        setSavedServerUrl(url);
        const next = new FileBrowserClient(url, token);
        configureClient(next);
        if (!token) return;
        try {
          const [currentUser, capabilities] = await Promise.all([next.currentUser(), next.detectCapabilities()]);
          setUser(currentUser);
          setConnection({ baseUrl: next.baseUrl, capabilities });
        } catch {
          await SecureStore.deleteItemAsync(TOKEN_KEY);
          next.setToken(null);
        }
      })
      .finally(() => setBooting(false));
  }, [configureClient]);

  const establish = useCallback(async (next: FileBrowserClient, username: string, password: string) => {
    await next.probe();
    const token = await next.login(username, password);
    try {
      const [currentUser, capabilities] = await Promise.all([next.currentUser(), next.detectCapabilities()]);
      await Promise.all([
        AsyncStorage.setItem(SERVER_KEY, next.baseUrl),
        SecureStore.setItemAsync(TOKEN_KEY, token),
      ]);
      configureClient(next);
      setSavedServerUrl(next.baseUrl);
      setUser(currentUser);
      setConnection({ baseUrl: next.baseUrl, capabilities });
    } catch (error) {
      next.setToken(null);
      if (error instanceof ApiError && error.category === 'not-found') {
        throw new ApiError('This server does not expose the required modern File Browser API.', 'unsupported');
      }
      throw error;
    }
  }, [configureClient]);

  const connect = useCallback(async (baseUrl: string, username: string, password: string) => {
    await establish(new FileBrowserClient(normalizeServerUrl(baseUrl)), username, password);
  }, [establish]);

  const login = useCallback(async (username: string, password: string) => {
    if (!client) throw new ApiError('Configure a server first.', 'unsupported');
    await establish(client, username, password);
  }, [client, establish]);

  const logout = useCallback(async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    client?.setToken(null);
    setUser(null);
    setConnection(null);
  }, [client]);

  const forgetServer = useCallback(async () => {
    await Promise.all([AsyncStorage.removeItem(SERVER_KEY), SecureStore.deleteItemAsync(TOKEN_KEY)]);
    setClient(null); setConnection(null); setUser(null); setSavedServerUrl('');
  }, []);

  const value = useMemo(() => ({ booting, client, connection, user, savedServerUrl, connect, login, logout, forgetServer }),
    [booting, client, connection, user, savedServerUrl, connect, login, logout, forgetServer]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider.');
  return value;
}
