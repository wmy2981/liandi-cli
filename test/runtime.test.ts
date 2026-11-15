import { describe, expect, it, vi } from 'vitest';
import { execute, type IO } from '../src/runtime.js';

const write = { write: true, auth: true };
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

describe('write safety', () => {
  const request = { method: 'POST' as const, path: '/api/v2/comment', body: { commentContent: 'hello' } };
  const globals = { baseUrl: 'http://127.0.0.1:1', token: 'secret' };
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
