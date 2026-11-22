import { describe, expect, it, vi } from 'vitest';
import { LiandiError } from '../src/errors.js';
import { errorEnvelope, execute, type IO } from '../src/runtime.js';

const write = { write: true, auth: true };
const globals = { baseUrl: 'http://127.0.0.1:1', token: 'secret' };
function testIO(confirm = 'y'): IO & { output: string; errors: string } {
  const io = {
    output: '',
    errors: '',
    stdout: { isTTY: true, write(text: string) { io.output += text; return true; } },
    stderr: { isTTY: true, write(text: string) { io.errors += text; return true; } },
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
  it('carries the preview in the error instead of writing it when a write is refused', async () => {
    const io = testIO();
    io.stdin.isTTY = false;
    await expect(execute('comments.create', request, { ...globals, format: 'json' }, io, '1', {}, write))
      .rejects.toMatchObject({ code: 'CONFIRMATION_REQUIRED', details: { method: 'POST' } });
    expect(io.output).toBe('');
    expect(io.errors).toBe('');
  });
  it('keeps stdout to a single envelope in JSON mode', async () => {
    const io = testIO('n');
    const result = await execute('comments.create', request, { ...globals, format: 'json' }, io, '1', {}, write);
    expect(result.status).toBe('cancelled');
    expect(io.output).toBe('');
    expect(io.errors).toContain('dry-run');
    expect(io.errors).not.toContain('secret');
  });
  it('previews without a token so users can review before configuring one', async () => {
    const result = await execute('comments.create', request, { dryRun: true }, testIO(), '1', {}, write);
    expect(result.status).toBe('dry-run');
  });
  it('refuses to send a confirmed write without a token', async () => {
    await expect(execute('comments.create', request, { yes: true }, testIO(), '1', {}, write)).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
  });
});

describe('error envelope', () => {
  it('redacts credentials carried in error details', () => {
    const envelope = errorEnvelope(new LiandiError('bad', 'API_ERROR', 1, { userPassword: 'pw', nested: { cookie: 'c' }, keep: 1 }));
    expect(envelope.error?.details).toEqual({ userPassword: '[REDACTED]', nested: { cookie: '[REDACTED]' }, keep: 1 });
  });
  it('reports unexpected exceptions as INTERNAL_ERROR', () => {
    expect(errorEnvelope(new TypeError('boom'))).toMatchObject({ ok: false, status: 'error', error: { code: 'INTERNAL_ERROR', message: 'boom' } });
  });
});
