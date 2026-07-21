export type ApiErrorCategory =
  | 'offline' | 'timeout' | 'unauthorized' | 'forbidden' | 'not-found'
  | 'conflict' | 'certificate' | 'unsupported' | 'server' | 'unknown';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly category: ApiErrorCategory,
    public readonly status?: number,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export type Permissions = {
  admin: boolean;
  execute: boolean;
  create: boolean;
  rename: boolean;
  modify: boolean;
  delete: boolean;
  share: boolean;
  download: boolean;
};

export type AuthenticatedUser = {
  id: number;
  username: string;
  scope: string;
  perm: Permissions;
};

export type FileResource = {
  name: string;
  path: string;
  size: number;
  extension?: string;
  modified: string;
  mode?: number;
  isDir: boolean;
  isSymlink?: boolean;
  type?: string;
  content?: string;
  items?: FileResource[];
};

export type ServerCapabilities = {
  search: boolean;
  preview: boolean;
  shares: boolean;
  directUpload: boolean;
};

export type ServerConnection = {
  baseUrl: string;
  capabilities: ServerCapabilities;
};

export type TransferState = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export type TransferTask = {
  id: string;
  name: string;
  direction: 'upload' | 'download';
  state: TransferState;
  bytesTransferred: number;
  totalBytes?: number;
  error?: string;
};

export type Share = { hash: string; path: string; expire?: string };
