import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { FileBrowserClient } from '../api/FileBrowserClient';
import { ApiError, AuthenticatedUser, ServerConnection } from '../types';
import { normalizeServerUrl } from '../utils/path';

const SERVER_KEY = 'filebrowser.serverUrl';
const SOURCE_KEY = 'filebrowser.quantumSource';
const TOKEN_KEY = 'filebrowser.jwt';
const CREDENTIALS_KEY = 'filebrowser.keepSignedInCredentials';

type SavedCredentials = { username: string; password: string };

type SessionContextValue = {
  booting: boolean;
  client: FileBrowserClient | null;
  connection: ServerConnection | null;
  user: AuthenticatedUser | null;
  savedServerUrl: string;
  savedSourceName: string;
  connect: (baseUrl: string, sourceName: string, username: string, password: string, keepSignedIn: boolean) => Promise<void>;
  login: (username: string, password: string, keepSignedIn: boolean) => Promise<void>;
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
  const [savedSourceName, setSavedSourceName] = useState('srv');

  const configureClient = useCallback((next: FileBrowserClient) => {
    let reauthentication: Promise<boolean> | null = null;
    next.onUnauthorized = () => {
      if (reauthentication) return reauthentication;
      reauthentication = (async () => {
        try {
          const saved = await SecureStore.getItemAsync(CREDENTIALS_KEY);
          if (!saved) throw new Error('No saved credentials.');
          const { username, password } = JSON.parse(saved) as SavedCredentials;
          if (!username || !password) throw new Error('Invalid saved credentials.');
          const token = await next.login(username, password);
          await SecureStore.setItemAsync(TOKEN_KEY, token);
          return true;
        } catch {
          next.setToken(null);
          setUser(null);
          setConnection(null);
          await Promise.all([
            SecureStore.deleteItemAsync(TOKEN_KEY),
            SecureStore.deleteItemAsync(CREDENTIALS_KEY),
          ]);
          return false;
        } finally {
          reauthentication = null;
        }
      })();
      return reauthentication;
    };
    setClient(next);
  }, []);

  useEffect(() => {
    Promise.all([AsyncStorage.getItem(SERVER_KEY), AsyncStorage.getItem(SOURCE_KEY), SecureStore.getItemAsync(TOKEN_KEY), SecureStore.getItemAsync(CREDENTIALS_KEY)])
      .then(async ([url, sourceName, token, savedCredentials]) => {
        if (!url) return;
        setSavedServerUrl(url);
        setSavedSourceName(sourceName || 'srv');
        const next = new FileBrowserClient(url, token, sourceName || 'srv');
        configureClient(next);
        if (!token && savedCredentials) {
          try {
            const { username, password } = JSON.parse(savedCredentials) as SavedCredentials;
            token = await next.login(username, password);
            await SecureStore.setItemAsync(TOKEN_KEY, token);
          } catch {
            await SecureStore.deleteItemAsync(CREDENTIALS_KEY);
          }
        }
        if (!next.getToken()) return;
        try {
          const currentUser = await next.currentUser();
          const capabilities = await next.detectCapabilities();
          setUser(currentUser);
          setConnection({ baseUrl: next.baseUrl, sourceName: next.getSourceName(), capabilities });
        } catch {
          await SecureStore.deleteItemAsync(TOKEN_KEY);
          next.setToken(null);
        }
      })
      .finally(() => setBooting(false));
  }, [configureClient]);

  const establish = useCallback(async (next: FileBrowserClient, username: string, password: string, keepSignedIn: boolean) => {
    const token = await next.login(username, password);
    try {
      const currentUser = await next.currentUser();
      const capabilities = await next.detectCapabilities();
      await Promise.all([
        AsyncStorage.setItem(SERVER_KEY, next.baseUrl),
        AsyncStorage.setItem(SOURCE_KEY, next.getSourceName()),
        SecureStore.setItemAsync(TOKEN_KEY, token),
        keepSignedIn
          ? SecureStore.setItemAsync(CREDENTIALS_KEY, JSON.stringify({ username, password } satisfies SavedCredentials))
          : SecureStore.deleteItemAsync(CREDENTIALS_KEY),
      ]);
      configureClient(next);
      setSavedServerUrl(next.baseUrl);
      setSavedSourceName(next.getSourceName());
      setUser(currentUser);
      setConnection({ baseUrl: next.baseUrl, sourceName: next.getSourceName(), capabilities });
    } catch (error) {
      next.setToken(null);
      if (error instanceof ApiError && error.category === 'not-found') {
        throw new ApiError('This server does not expose the required modern File Browser API.', 'unsupported');
      }
      throw error;
    }
  }, [configureClient]);

  const connect = useCallback(async (baseUrl: string, sourceName: string, username: string, password: string, keepSignedIn: boolean) => {
    await establish(new FileBrowserClient(normalizeServerUrl(baseUrl), null, sourceName), username, password, keepSignedIn);
  }, [establish]);

  const login = useCallback(async (username: string, password: string, keepSignedIn: boolean) => {
    if (!client) throw new ApiError('Configure a server first.', 'unsupported');
    await establish(client, username, password, keepSignedIn);
  }, [client, establish]);

  const logout = useCallback(async () => {
    await Promise.all([SecureStore.deleteItemAsync(TOKEN_KEY), SecureStore.deleteItemAsync(CREDENTIALS_KEY)]);
    client?.setToken(null);
    setUser(null);
    setConnection(null);
  }, [client]);

  const forgetServer = useCallback(async () => {
    await Promise.all([AsyncStorage.removeItem(SERVER_KEY), AsyncStorage.removeItem(SOURCE_KEY), SecureStore.deleteItemAsync(TOKEN_KEY), SecureStore.deleteItemAsync(CREDENTIALS_KEY)]);
    setClient(null); setConnection(null); setUser(null); setSavedServerUrl(''); setSavedSourceName('srv');
  }, []);

  const value = useMemo(() => ({ booting, client, connection, user, savedServerUrl, savedSourceName, connect, login, logout, forgetServer }),
    [booting, client, connection, user, savedServerUrl, savedSourceName, connect, login, logout, forgetServer]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider.');
  return value;
}
