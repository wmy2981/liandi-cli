import { describe, expect, it, vi } from 'vitest';
import { LiandiClient } from '../src/client.js';

function client(fetchMock: typeof fetch) {
  return new LiandiClient({ baseUrl: 'https://example.com', version: '1.2.3', token: 'secret', fetch: fetchMock });
}

describe('HTTP client', () => {
  it('uses the documented API token header and custom UA', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('{"code":0}'));
    await client(fetchMock).call({ method: 'GET', path: '/api/v2/user' }, { auth: true });
    const [, init] = fetchMock.mock.calls[0]!;
    expect(init?.headers).toMatchObject({ Authorization: 'token secret', 'User-Agent': 'liandi/1.2.3 (+https://github.com/wmy2981/liandi-cli)' });
  });
  it('sends the token even for endpoints that allow anonymous access', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}'));
    await client(fetchMock).call({ method: 'GET', path: '/api/v2/articles/latest', query: { p: 2 } });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://example.com/api/v2/articles/latest?p=2');
    expect(init?.headers).toMatchObject({ Authorization: 'token secret' });
  });
  it('omits Authorization when no token is configured', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}'));
    const anonymous = new LiandiClient({ baseUrl: 'https://example.com', version: '1', fetch: fetchMock });
    await anonymous.call({ method: 'GET', path: '/api/v2/tags' });
    expect(fetchMock.mock.calls[0]![1]?.headers).not.toHaveProperty('Authorization');
  });
  it('serializes JSON bodies and preserves UTF-8', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}'));
    await client(fetchMock).call({ method: 'POST', path: '/api/v2/article', body: { articleTitle: '链滴' } });
    const [, init] = fetchMock.mock.calls[0]!;
    expect(init?.body).toBe('{"articleTitle":"链滴"}');
    expect(init?.headers).toMatchObject({ 'Content-Type': 'application/json; charset=utf-8' });
  });
  it('rejects missing auth before any request', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const unauthenticated = new LiandiClient({ baseUrl: 'https://example.com', version: '1', fetch: fetchMock });
    await expect(unauthenticated.call({ method: 'GET', path: '/api/v2/user' }, { auth: true })).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('surfaces HTTP and non-JSON errors', async () => {
    const unauthorized = vi.fn<typeof fetch>().mockResolvedValue(new Response('{"code":-1}', { status: 401 }));
    await expect(client(unauthorized).call({ method: 'GET', path: '/' })).rejects.toMatchObject({ code: 'UNAUTHORIZED', status: 401 });
    const html = vi.fn<typeof fetch>().mockResolvedValue(new Response('<html></html>', { status: 502 }));
    await expect(client(html).call({ method: 'GET', path: '/' })).rejects.toMatchObject({ code: 'API_ERROR', status: 502 });
  });
});
