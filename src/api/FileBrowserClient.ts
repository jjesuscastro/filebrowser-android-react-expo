import ReactNativeBlobUtil from 'react-native-blob-util';
import { ApiError, AuthenticatedUser, FileResource, ServerCapabilities, Share } from '../types';
import { encodePath, normalizePath, normalizeServerUrl, safeFilename } from '../utils/path';

type RequestOptions = RequestInit & { timeoutMs?: number; authenticated?: boolean };
type JwtPayload = { id?: number; user?: { id?: number }; exp?: number };

function decodeJwtPayload(token: string): JwtPayload {
  try {
    const raw = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const binary = globalThis.atob(raw.padEnd(Math.ceil(raw.length / 4) * 4, '='));
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as JwtPayload;
  } catch {
    return {};
  }
}

function categoryForStatus(status: number) {
  if (status === 401) return 'unauthorized' as const;
  if (status === 403) return 'forbidden' as const;
  if (status === 404) return 'not-found' as const;
  if (status === 409) return 'conflict' as const;
  if (status >= 500) return 'server' as const;
  return 'unknown' as const;
}

export class FileBrowserClient {
  readonly baseUrl: string;
  private token: string | null;
  onUnauthorized?: () => void;

  constructor(baseUrl: string, token: string | null = null) {
    this.baseUrl = normalizeServerUrl(baseUrl);
    this.token = token;
  }

  setToken(token: string | null) { this.token = token; }
  getToken() { return this.token; }

  url(endpoint: string) {
    return `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  }

  private async request(endpoint: string, options: RequestOptions = {}): Promise<Response> {
    const controller = new AbortController();
    const externalSignal = options.signal;
    const abort = () => controller.abort();
    externalSignal?.addEventListener('abort', abort);
    const timer = setTimeout(abort, options.timeoutMs ?? 20_000);
    const headers = new Headers(options.headers);
    if (options.authenticated !== false && this.token) headers.set('X-Auth', this.token);
    try {
      const response = await fetch(this.url(endpoint), { ...options, headers, signal: controller.signal });
      if (!response.ok) {
        const message = (await response.text()).trim() || `Server returned ${response.status}.`;
        const error = new ApiError(message, categoryForStatus(response.status), response.status, response.status >= 500);
        if (response.status === 401 && options.authenticated !== false) this.onUnauthorized?.();
        throw error;
      }
      return response;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (controller.signal.aborted) {
        if (externalSignal?.aborted) throw new ApiError('Request cancelled.', 'unknown');
        throw new ApiError('The server did not respond in time.', 'timeout', undefined, true);
      }
      const message = error instanceof Error ? error.message : 'Could not reach the server.';
      const certificate = /certificate|ssl|tls/i.test(message);
      throw new ApiError(
        certificate ? 'The server certificate could not be verified.' : 'Could not reach the server.',
        certificate ? 'certificate' : 'offline', undefined, !certificate,
      );
    } finally {
      clearTimeout(timer);
      externalSignal?.removeEventListener('abort', abort);
    }
  }

  async probe(): Promise<void> {
    await this.request('/health', { authenticated: false, timeoutMs: 10_000 });
  }

  async login(username: string, password: string): Promise<string> {
    const response = await this.request('/api/login', {
      method: 'POST', authenticated: false,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, recaptcha: '' }),
    });
    const token = (await response.text()).trim();
    if (!token || token.split('.').length !== 3) throw new ApiError('The server returned an invalid login token.', 'unsupported');
    this.token = token;
    return token;
  }

  async currentUser(): Promise<AuthenticatedUser> {
    if (!this.token) throw new ApiError('Sign in is required.', 'unauthorized', 401);
    const payload = decodeJwtPayload(this.token);
    const id = payload.id ?? payload.user?.id;
    if (!id) throw new ApiError('This server uses an unsupported token format.', 'unsupported');
    const response = await this.request(`/api/users/${id}`);
    return response.json() as Promise<AuthenticatedUser>;
  }

  async detectCapabilities(): Promise<ServerCapabilities> {
    await this.list('/');
    const probe = async (endpoint: string) => {
      try { await this.request(endpoint, { timeoutMs: 8_000 }); return true; }
      catch (error) { return error instanceof ApiError && !['not-found', 'unsupported'].includes(error.category); }
    };
    const [search, preview, shares] = await Promise.all([
      probe('/api/search/?query=__native_capability_probe__'),
      probe('/api/preview/small/'),
      probe('/api/shares'),
    ]);
    return { search, preview, shares, directUpload: true };
  }

  async list(path: string, signal?: AbortSignal): Promise<FileResource> {
    const response = await this.request(`/api/resources${encodePath(path)}`, { signal });
    return response.json() as Promise<FileResource>;
  }

  async readText(path: string): Promise<string> {
    const response = await this.request(`/api/resources${encodePath(path)}`, { headers: { 'X-Encoding': 'true' } });
    if (response.headers.get('Content-Type')?.includes('application/octet-stream')) return response.text();
    const resource = await response.json() as FileResource;
    return resource.content ?? '';
  }

  async search(path: string, query: string, signal?: AbortSignal): Promise<FileResource[]> {
    const base = encodePath(path).replace(/\/$/, '') + '/';
    const response = await this.request(`/api/search${base}?query=${encodeURIComponent(query)}`, { signal });
    const body = await response.text();
    return body.split('\n').filter(Boolean).map(line => JSON.parse(line) as FileResource);
  }

  async createFolder(path: string): Promise<void> {
    await this.request(`/api/resources${encodePath(path)}/`, { method: 'POST' });
  }

  async saveText(path: string, content: string): Promise<void> {
    await this.request(`/api/resources${encodePath(path)}`, { method: 'PUT', body: content });
  }

  async remove(path: string): Promise<void> {
    await this.request(`/api/resources${encodePath(path)}`, { method: 'DELETE' });
  }

  async move(source: string, destination: string, options: { copy?: boolean; overwrite?: boolean; rename?: boolean } = {}) {
    const params = new URLSearchParams({
      action: options.copy ? 'copy' : 'rename', destination: normalizePath(destination),
      override: String(Boolean(options.overwrite)), rename: String(Boolean(options.rename)),
    });
    await this.request(`/api/resources${encodePath(source)}?${params}`, { method: 'PATCH' });
  }

  upload(localUri: string, remotePath: string, overwrite: boolean, onProgress: (sent: number, total: number) => void) {
    if (!this.token) throw new ApiError('Sign in is required.', 'unauthorized', 401);
    const path = localUri.startsWith('file://') ? localUri.slice(7) : localUri;
    return ReactNativeBlobUtil.fetch(
      'POST', this.url(`/api/resources${encodePath(remotePath)}?override=${overwrite}`),
      { 'X-Auth': this.token, 'Content-Type': 'application/octet-stream' },
      ReactNativeBlobUtil.wrap(path),
    ).uploadProgress({ interval: 250 }, onProgress);
  }

  download(remotePath: string, onProgress: (received: number, total: number) => void, cacheOnly = false) {
    if (!this.token) throw new ApiError('Sign in is required.', 'unauthorized', 401);
    const filename = safeFilename(normalizePath(remotePath).split('/').pop() ?? 'download');
    const directory = cacheOnly ? ReactNativeBlobUtil.fs.dirs.CacheDir : ReactNativeBlobUtil.fs.dirs.DownloadDir;
    const destination = `${directory}/${Date.now()}-${filename}`;
    const config = cacheOnly ? { path: destination } : {
      addAndroidDownloads: {
        useDownloadManager: true, notification: true, mediaScannable: true,
        path: destination, title: filename, description: 'Downloading from File Browser',
      },
    };
    return ReactNativeBlobUtil.config(config).fetch(
      'GET', this.url(`/api/raw${encodePath(remotePath)}`), { 'X-Auth': this.token },
    ).progress({ interval: 250 }, onProgress);
  }

  previewUrl(path: string, size = 'big') { return this.url(`/api/preview/${size}${encodePath(path)}`); }
  rawUrl(path: string) { return this.url(`/api/raw${encodePath(path)}`); }

  async createShare(path: string): Promise<Share> {
    const response = await this.request(`/api/share${encodePath(path)}`, { method: 'POST', body: '{}' });
    return response.json() as Promise<Share>;
  }

  shareUrl(hash: string) { return this.url(`/share/${encodeURIComponent(hash)}`); }
}
