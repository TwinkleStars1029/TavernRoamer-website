import { describe, expect, it } from 'vitest';
import { collectOAuthOrigins, toOAuthOrigin } from './origins';

describe('OAuth JavaScript origins', () => {
  it('removes path, query and fragment while retaining scheme, host and port', () => {
    expect(toOAuthOrigin('https://tavern.example.com:8443/room?a=1#chat')).toMatchObject({ ok: true, origin: 'https://tavern.example.com:8443' });
  });
  it('preserves localhost and 127.0.0.1 as separate origins', () => {
    expect(collectOAuthOrigins(['http://localhost:8000/a', 'http://127.0.0.1:8000/b']).origins)
      .toEqual(['http://localhost:8000', 'http://127.0.0.1:8000']);
  });
  it('deduplicates origins from different paths', () => {
    expect(collectOAuthOrigins(['https://t.example/a', 'https://t.example/b']).origins).toEqual(['https://t.example']);
  });
  it('requires an explicit HTTP scheme', () => {
    expect(toOAuthOrigin('tavern.example.com')).toMatchObject({ ok: false, reason: 'scheme' });
  });
  it('rejects credentials and non HTTP protocols', () => {
    expect(toOAuthOrigin('https://name:secret@t.example')).toMatchObject({ ok: false, reason: 'credentials' });
    expect(toOAuthOrigin('ftp://t.example')).toMatchObject({ ok: false, reason: 'scheme' });
    const result = collectOAuthOrigins(['https://name:secret@t.example']);
    expect(result.errors.join(' ')).not.toContain('name:secret');
    expect(result.errors.join(' ')).not.toContain('t.example');
  });
  it('reports malformed, blank and multiple invalid lines without echoing their text', () => {
    const result = collectOAuthOrigins(['', 'not a URL', 'https://user:pw@host.test', 'https://[bad']);
    expect(result.errors).toHaveLength(3);
    expect(result.errors.join(' ')).not.toContain('user:pw');
    expect(result.errors[0]).toContain('第 2 筆');
  });
  it('normalizes the default port and accepts IPv6 loopback', () => {
    expect(toOAuthOrigin('https://t.example:443/a')).toMatchObject({ ok: true, origin: 'https://t.example' });
    expect(toOAuthOrigin('http://[::1]:8080/path')).toMatchObject({ ok: true, origin: 'http://[::1]:8080', warning: null });
  });
  it('warns for non-local HTTP origins', () => {
    expect(toOAuthOrigin('http://tavern.example.com')).toMatchObject({ ok: true, warning: expect.stringContaining('非本機 HTTP') });
  });
});
