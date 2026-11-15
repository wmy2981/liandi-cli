import { describe, expect, it, vi } from 'vitest';
import { execute, type IO } from '../src/runtime.js';

const write = { write: true, auth: true };
const globals = { baseUrl: 'http://127.0.0.1:1', token: 'secret' };
function testIO(confirm = 'y'): IO & { output: string } {
  const io = {
    output: '',
    stdout: { isTTY: true, write(text: string) { io.output += text; return true; } },
    stderr: { isTTY: true, write: vi.fn() },
    stdin: { isTTY: true },
    confirm: vi.fn(async () => confirm),
  };
  return io;
}

describe('upstream business codes', () => {
  const read = { method: 'GET' as const, path: '/api/v2/articles/latest' };
  it('turns a non-zero code into a failure with its own code', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ code: 1, msg: 'bad', data: null }))));
    try {
      await expect(execute('articles.list', read, globals, testIO(), '1', {}))
        .rejects.toMatchObject({ code: 'API_CODE_1', message: 'bad', exitCode: 1 });
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it('keeps code 10 of login as a successful intermediate step', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ code: 10, msg: 'need 2fa', token: 'session' }))));
    try {
      const result = await execute('auth.login', { method: 'POST', path: '/api/v2/login', body: {} }, globals, testIO(), '1', {}, write);
      expect(result.status).toBe('success');
      expect(result.hint).toContain('auth 2fa');
      expect(result.data).toMatchObject({ token: 'session' });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('write safety', () => {
  const request = { method: 'POST' as const, path: '/api/v2/comment', body: { commentContent: 'hello' } };
  it('dry-run does not make a network request', async () => {
    const io = testIO();
    const result = await execute('comments.create', request, { token: 'secret', dryRun: true }, io, '1', {}, write);
    expect(result).toMatchObject({ status: 'dry-run', data: { method: 'POST' } });
    expect(io.confirm).not.toHaveBeenCalled();
    expect(io.output).toBe('');
  });
  it('previews and allows interactive cancellation', async () => {
    const io = testIO('n');
    const result = await execute('comments.create', request, globals, io, '1', {}, write);
    expect(result.status).toBe('cancelled');
    expect(io.output).toContain('hello');
    expect(io.output).not.toContain('secret');
  });
  it('refuses silent writes in non-interactive terminals', async () => {
    const io = testIO();
    io.stdin.isTTY = false;
    await expect(execute('comments.create', request, globals, io, '1', {}, write)).rejects.toMatchObject({ code: 'CONFIRMATION_REQUIRED' });
  });
  it('previews without a token so users can review before configuring one', async () => {
    const result = await execute('comments.create', request, { dryRun: true }, testIO(), '1', {}, write);
    expect(result.status).toBe('dry-run');
  });
  it('refuses to send a confirmed write without a token', async () => {
    await expect(execute('comments.create', request, { yes: true }, testIO(), '1', {}, write)).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
  });
});
