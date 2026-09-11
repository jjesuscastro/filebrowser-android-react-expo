import ReactNativeBlobUtil from 'react-native-blob-util';
import { Platform } from 'react-native';
import { ApiError, AuthenticatedUser, FileResource, ServerCapabilities, Share } from '../types';
import { joinPath, normalizePath, normalizeServerUrl, safeFilename } from '../utils/path';

type RequestOptions = RequestInit & { timeoutMs?: number; authenticated?: boolean; retryAuthentication?: boolean };
type JwtPayload = { exp?: number };
type QuantumPermissionShape = Partial<AuthenticatedUser> & {
  permissions?: Record<string, boolean>;
  scopes?: Array<{ source?: string; name?: string; path?: string; permissions?: Record<string, boolean>; perm?: Record<string, boolean> }>;
};
type QuantumResourceShape = Partial<FileResource> & {
  item?: Partial<FileResource>;
  resource?: Partial<FileResource>;
  files?: FileResource[];
  folders?: FileResource[];
  children?: FileResource[];
  items?: FileResource[];
};
type QuantumItemShape = Partial<FileResource> & {
  dir?: boolean;
  directory?: boolean;
  isDirectory?: boolean;
  kind?: string;
};

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

function normalizeUser(raw: QuantumPermissionShape, sourceName: string): AuthenticatedUser {
  const global = raw.permissions ?? {};
  const sourceScope = raw.scopes?.find(scope => scope.source === sourceName || scope.name === sourceName) ?? raw.scopes?.[0];
  const source = sourceScope?.permissions ?? sourceScope?.perm ?? {};
  const perm = {
    admin: Boolean(raw.perm?.admin ?? global.admin),
    execute: false,
    create: Boolean(raw.perm?.create ?? source.create),
    rename: Boolean(raw.perm?.rename ?? source.modify ?? source.create),
    modify: Boolean(raw.perm?.modify ?? source.modify),
    delete: Boolean(raw.perm?.delete ?? source.delete),
    share: Boolean(raw.perm?.share ?? global.share),
    download: Boolean(raw.perm?.download ?? source.download),
  };
  return {
    ...raw,
    id: raw.id ?? 0,
    username: raw.username ?? 'user',
    scope: raw.scope ?? '/',
    perm,
  };
}

function normalizeItem(raw: QuantumItemShape, parentPath: string, forceDir = false): FileResource {
  const name = raw.name ?? normalizePath(raw.path ?? '').split('/').filter(Boolean).at(-1) ?? '';
  const path = raw.path
    ? raw.path.startsWith('/') ? raw.path : joinPath(parentPath, raw.path)
    : joinPath(parentPath, name);
  const type = raw.type?.toLowerCase();
  const kind = raw.kind?.toLowerCase();
  const isDir = forceDir
    || raw.isDir
    || raw.dir
    || raw.directory
    || raw.isDirectory
    || type === 'directory'
    || type === 'folder'
    || kind === 'directory'
    || kind === 'folder'
    || raw.mode === 2147484141;
  return {
    name,
    path,
    size: raw.size ?? 0,
    extension: raw.extension,
    modified: raw.modified ?? new Date().toISOString(),
    mode: raw.mode,
    isDir: Boolean(isDir),
    isSymlink: raw.isSymlink,
    type: raw.type,
    content: raw.content,
    items: raw.items,
  };
}

function normalizeResource(raw: QuantumResourceShape, fallbackPath: string): FileResource {
  const resource = raw.resource ?? raw.item ?? raw;
  const parentPath = resource.path ?? normalizePath(fallbackPath);
  const items = raw.items?.map(item => normalizeItem(item, parentPath))
    ?? raw.children?.map(item => normalizeItem(item, parentPath))
    ?? [
      ...(raw.folders ?? []).map(item => normalizeItem(item, parentPath, true)),
      ...(raw.files ?? []).map(item => normalizeItem(item, parentPath)),
    ];
  return {
    name: resource.name ?? normalizePath(fallbackPath).split('/').filter(Boolean).at(-1) ?? '',
    path: resource.path ?? normalizePath(fallbackPath),
    size: resource.size ?? 0,
    extension: resource.extension,
    modified: resource.modified ?? new Date().toISOString(),
    mode: resource.mode,
    isDir: resource.isDir ?? true,
    isSymlink: resource.isSymlink,
    type: resource.type,
    content: resource.content,
    items,
  };
}

export class FileBrowserClient {
  readonly baseUrl: string;
  private token: string | null;
  private sourceName: string;
  onUnauthorized?: () => Promise<boolean>;

  constructor(baseUrl: string, token: string | null = null, sourceName = 'srv') {
    this.baseUrl = normalizeServerUrl(baseUrl);
    this.token = token;
    this.sourceName = sourceName;
  }

  setToken(token: string | null) { this.token = token; }
  getToken() { return this.token; }
  setSourceName(sourceName: string) { this.sourceName = sourceName.trim() || 'srv'; }
  getSourceName() { return this.sourceName; }
  authHeaders(): Record<string, string> { return this.token ? { Authorization: `Bearer ${this.token}` } : {}; }

  url(endpoint: string) {
    return `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  }

  private resourceParams(path: string, extra: Record<string, string> = {}) {
    return new URLSearchParams({ path: normalizePath(path), source: this.sourceName, ...extra });
  }

  private async request(endpoint: string, options: RequestOptions = {}): Promise<Response> {
    const controller = new AbortController();
    const externalSignal = options.signal;
    const abort = () => controller.abort();
    externalSignal?.addEventListener('abort', abort);
    const timer = setTimeout(abort, options.timeoutMs ?? 20_000);
    const headers = new Headers(options.headers);
    if (options.authenticated !== false && this.token) headers.set('Authorization', `Bearer ${this.token}`);
    try {
      const response = await fetch(this.url(endpoint), { ...options, headers, signal: controller.signal });
      if (!response.ok) {
        const message = (await response.text()).trim() || `Server returned ${response.status}.`;
        const error = new ApiError(message, categoryForStatus(response.status), response.status, response.status >= 500);
        if (response.status === 401 && options.authenticated !== false && options.retryAuthentication !== false && this.onUnauthorized) {
          const reauthenticated = await this.onUnauthorized();
          if (reauthenticated) return this.request(endpoint, { ...options, retryAuthentication: false });
        }
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
    const params = new URLSearchParams({ username, recaptcha: '' });
    const response = await this.request(`/api/auth/login?${params}`, {
      method: 'POST', authenticated: false,
      headers: { 'X-Password': password },
    });
    const token = (await response.text()).trim().replace(/^"|"$/g, '');
    if (!token || token.split('.').length !== 3) throw new ApiError('The server returned an invalid login token.', 'unsupported');
    this.token = token;
    return token;
  }

  async currentUser(): Promise<AuthenticatedUser> {
    if (!this.token) throw new ApiError('Sign in is required.', 'unauthorized', 401);
    decodeJwtPayload(this.token);
    const response = await this.request('/api/users?id=self');
    const raw = await response.json() as QuantumPermissionShape;
    const firstScopeSource = raw.scopes?.map(scope => scope.source ?? scope.name).find(Boolean);
    const hasSavedSource = raw.scopes?.some(scope => scope.source === this.sourceName || scope.name === this.sourceName);
    if (firstScopeSource && hasSavedSource === false) this.setSourceName(firstScopeSource);
    return normalizeUser(raw, this.sourceName);
  }

  async detectCapabilities(): Promise<ServerCapabilities> {
    await this.list('/');
    const probe = async (endpoint: string) => {
      try { await this.request(endpoint, { timeoutMs: 8_000 }); return true; }
      catch (error) { return error instanceof ApiError && !['not-found', 'unsupported'].includes(error.category); }
    };
    const [search, preview, shares] = await Promise.all([
      probe(`/api/search?${new URLSearchParams({ scope: '/', source: this.sourceName, query: '__native_capability_probe__' })}`),
      probe(`/api/preview?${this.resourceParams('/', { size: 'small', inline: 'true' })}`),
      probe('/api/shares'),
    ]);
    return { search, preview, shares, directUpload: true };
  }

  async list(path: string, signal?: AbortSignal): Promise<FileResource> {
    const response = await this.request(`/api/resources?${this.resourceParams(path)}`, { signal });
    return normalizeResource(await response.json() as QuantumResourceShape, path);
  }

  async readText(path: string): Promise<string> {
    const response = await this.request(`/api/resources?${this.resourceParams(path, { content: 'true' })}`);
    if (response.headers.get('Content-Type')?.includes('application/octet-stream')) return response.text();
    const resource = await response.json() as FileResource;
    return resource.content ?? '';
  }

  async search(path: string, query: string, signal?: AbortSignal): Promise<FileResource[]> {
    const response = await this.request(`/api/search?${new URLSearchParams({ scope: normalizePath(path), source: this.sourceName, query })}`, { signal });
    const body = await response.text();
    return body.split('\n').filter(Boolean).map(line => JSON.parse(line) as FileResource);
  }

  async createFolder(path: string): Promise<void> {
    await this.request(`/api/resources?${this.resourceParams(path)}`, { method: 'POST' });
  }

  async saveText(path: string, content: string): Promise<void> {
    await this.request(`/api/resources?${this.resourceParams(path)}`, { method: 'PUT', body: content });
  }

  async remove(path: string): Promise<void> {
    await this.request(`/api/resources?${this.resourceParams(path)}`, { method: 'DELETE' });
  }

  async move(source: string, destination: string, options: { copy?: boolean; overwrite?: boolean; rename?: boolean } = {}) {
    const params = new URLSearchParams({
      path: normalizePath(source), source: this.sourceName, action: options.copy ? 'copy' : 'rename', destination: normalizePath(destination),
      override: String(Boolean(options.overwrite)), rename: String(Boolean(options.rename)),
    });
    await this.request(`/api/resources?${params}`, { method: 'PATCH' });
  }

  upload(localUri: string, remotePath: string, overwrite: boolean, onProgress: (sent: number, total: number) => void) {
    if (!this.token) throw new ApiError('Sign in is required.', 'unauthorized', 401);
    const path = localUri.startsWith('file://') ? localUri.slice(7) : localUri;
    return ReactNativeBlobUtil.fetch(
      'POST', this.url(`/api/resources?${this.resourceParams(remotePath, { override: String(overwrite) })}`),
      { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/octet-stream' },
      ReactNativeBlobUtil.wrap(path),
    ).uploadProgress({ interval: 250 }, onProgress);
  }

  download(remotePath: string, onProgress: (received: number, total: number) => void, cacheOnly = false) {
    if (!this.token) throw new ApiError('Sign in is required.', 'unauthorized', 401);
    const filename = safeFilename(normalizePath(remotePath).split('/').pop() ?? 'download');
    const directory = cacheOnly ? ReactNativeBlobUtil.fs.dirs.CacheDir : ReactNativeBlobUtil.fs.dirs.DownloadDir;
    const destination = `${directory}/${Date.now()}-${filename}`;
    const modernAndroid = Platform.OS === 'android' && Number(Platform.Version) >= 29;
    const config = cacheOnly ? { path: destination } : {
      addAndroidDownloads: {
        useDownloadManager: true, notification: true, mediaScannable: true,
        title: filename, description: 'Downloading from File Browser',
        // Android 10+ uses scoped storage. Registering the download in the
        // public Downloads collection makes it visible to Files/Downloads apps.
        ...(modernAndroid ? { storeInDownloads: true } : { path: destination }),
      },
    };
    return ReactNativeBlobUtil.config(config).fetch(
      'GET', this.url(`/api/resources/download?${this.resourceParams(remotePath)}`), { Authorization: `Bearer ${this.token}` },
    ).progress({ interval: 250 }, onProgress);
  }

  previewUrl(path: string, size = 'large') { return this.url(`/api/preview?${this.resourceParams(path, { size, inline: 'true' })}`); }
  rawUrl(path: string) { return this.url(`/api/resources/view?${this.resourceParams(path, { inline: 'true' })}`); }

  async createShare(path: string): Promise<Share> {
    const response = await this.request(`/api/shares?${this.resourceParams(path)}`, { method: 'POST', body: '{}' });
    return response.json() as Promise<Share>;
  }

  shareUrl(hash: string) { return this.url(`/public/share/${encodeURIComponent(hash)}`); }
}
