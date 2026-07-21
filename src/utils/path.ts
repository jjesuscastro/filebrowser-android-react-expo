export function normalizeServerUrl(value: string): string {
  const parsed = new URL(value.trim());
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only HTTP and HTTPS addresses are supported.');
  }
  parsed.hash = '';
  parsed.search = '';
  return parsed.toString().replace(/\/$/, '');
}

export function normalizePath(value: string): string {
  const parts = value.split('/').filter(Boolean);
  return `/${parts.join('/')}`;
}

export function joinPath(parent: string, name: string): string {
  return normalizePath(`${parent}/${name}`);
}

export function encodePath(path: string): string {
  const normalized = normalizePath(path);
  return normalized.split('/').map((part, index) => index === 0 ? '' : encodeURIComponent(part)).join('/');
}

export function parentPath(path: string): string {
  const parts = normalizePath(path).split('/').filter(Boolean);
  parts.pop();
  return `/${parts.join('/')}`;
}

export function safeFilename(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, '_') || 'download';
}
