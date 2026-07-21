import { encodePath, joinPath, normalizePath, normalizeServerUrl, parentPath, safeFilename } from './path';

describe('server URL handling', () => {
  it('preserves installations hosted below a subpath', () => {
    expect(normalizeServerUrl('https://example.test/tools/files/')).toBe('https://example.test/tools/files');
  });

  it('removes query strings and fragments', () => {
    expect(normalizeServerUrl('https://example.test/files?x=1#top')).toBe('https://example.test/files');
  });

  it('rejects non-http protocols', () => {
    expect(() => normalizeServerUrl('ftp://example.test')).toThrow('Only HTTP and HTTPS');
  });
});

describe('remote paths', () => {
  it('normalizes and joins without duplicate separators', () => {
    expect(normalizePath('//photos///summer/')).toBe('/photos/summer');
    expect(joinPath('/photos/', 'my image.jpg')).toBe('/photos/my image.jpg');
  });

  it('encodes every segment without encoding separators', () => {
    expect(encodePath('/photos/my image #1.jpg')).toBe('/photos/my%20image%20%231.jpg');
  });

  it('returns root when finding the parent of a root item', () => {
    expect(parentPath('/photo.jpg')).toBe('/');
  });

  it('sanitizes Android download names', () => {
    expect(safeFilename('report:2026?.pdf')).toBe('report_2026_.pdf');
  });
});
