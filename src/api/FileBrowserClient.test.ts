jest.mock('react-native-blob-util', () => ({
  __esModule: true,
  default: { fs: { dirs: { CacheDir: '/cache', DownloadDir: '/downloads' } } },
}));

import { FileBrowserClient } from './FileBrowserClient';

describe('FileBrowserClient requests', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock;
  });

  it('logs in with the Quantum auth endpoint and password header', async () => {
    const token = 'aaa.bbb.ccc';
    fetchMock.mockResolvedValue(new Response(token, { status: 200 }));
    const client = new FileBrowserClient('https://example.test');

    await expect(client.login('admin', 'secret')).resolves.toBe(token);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.test/api/auth/login?username=admin&recaptcha=',
      expect.objectContaining({ method: 'POST', headers: expect.any(Headers) }),
    );
    const options = fetchMock.mock.calls[0][1] as RequestInit;
    expect((options.headers as Headers).get('X-Password')).toBe('secret');
  });

  it('preserves a configured server subpath and sends Bearer auth', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ isDir: true, items: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const client = new FileBrowserClient('https://example.test/apps/files/', 'jwt-token');
    await client.list('/My Files');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.test/apps/files/api/resources?path=%2FMy+Files&source=srv',
      expect.objectContaining({ headers: expect.any(Headers) }),
    );
    const options = fetchMock.mock.calls[0][1] as RequestInit;
    expect((options.headers as Headers).get('Authorization')).toBe('Bearer jwt-token');
  });

  it('normalizes conflict responses', async () => {
    fetchMock.mockResolvedValue(new Response('already exists', { status: 409 }));
    const client = new FileBrowserClient('https://example.test', 'jwt-token');
    await expect(client.createFolder('/existing')).rejects.toMatchObject({ category: 'conflict', status: 409 });
  });

  it('notifies the session when authentication expires', async () => {
    fetchMock.mockResolvedValue(new Response('expired', { status: 401 }));
    const client = new FileBrowserClient('https://example.test', 'jwt-token');
    const onUnauthorized = jest.fn();
    client.onUnauthorized = onUnauthorized;
    await expect(client.list('/')).rejects.toMatchObject({ category: 'unauthorized' });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('retries an expired request once after reauthentication', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('expired', { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ isDir: true, items: [] }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      }));
    const client = new FileBrowserClient('https://example.test', 'expired-token');
    client.onUnauthorized = jest.fn(async () => {
      client.setToken('refreshed-token');
      return true;
    });

    await expect(client.list('/')).resolves.toMatchObject({ isDir: true });
    expect(client.onUnauthorized).toHaveBeenCalledTimes(1);
    const retryOptions = fetchMock.mock.calls[1][1] as RequestInit;
    expect((retryOptions.headers as Headers).get('Authorization')).toBe('Bearer refreshed-token');
  });
});
