import { describe, expect, it, vi } from 'vitest';
import { run } from '../src/program.js';
import type { IO } from '../src/runtime.js';

function harness() {
  const io = {
    out: '', err: '',
    stdout: { isTTY: true, write(text: string) { io.out += text; return true; } },
    stderr: { isTTY: true, write(text: string) { io.err += text; return true; } },
    stdin: { isTTY: true }, confirm: vi.fn(async () => 'n'),
  } satisfies IO & { out: string; err: string };
  return { io, env: { LIANDI_TOKEN: 'fake-token' } };
}

describe('CLI integration', () => {
  it('rejects --dry-run on a read even when global flags come last', async () => {
    const { io, env } = harness();
    expect(await run(['article', 'list', '--sort', 'hot', '-p', '2', '-j', '--dry-run'], { io, env })).toBe(2);
    const value = JSON.parse(io.err);
    expect(value).toMatchObject({ ok: false, status: 'error', error: { code: 'INVALID_INPUT' } });
  });
  it('previews an article from a file without a token in output', async () => {
    const { io, env } = harness();
    const code = await run(['article', 'post', '--title', '测试', '--tags', 'CLI,Markdown', '--content', '# Hello', '--reward-point', '5', '--dry-run', '--json'], { io, env });
    expect(code).toBe(0);
    const value = JSON.parse(io.out);
    expect(value.data.body).toMatchObject({ articleTitle: '测试', articleContent: '# Hello', articleContentType: 'markdown', articleRewardPoint: 5 });
    expect(io.out).not.toContain('fake-token');
  });
  it('protects notification reads because upstream GET mutates state', async () => {
    const { io, env } = harness();
    expect(await run(['notice', 'read', 'at', '-d', '-j'], { io, env })).toBe(0);
    expect(JSON.parse(io.out).data.url).toBe('https://ld246.com/api/v2/notifications/make-read/at');
    expect(JSON.parse(io.out).status).toBe('dry-run');
  });
  it('redacts login credentials and returned session tokens', async () => {
    const { io, env } = harness();
    expect(await run(['auth', 'login', '-u', 'alice', '--password', 'password', '-d', '-j'], { io, env })).toBe(0);
    const value = JSON.parse(io.out);
    expect(value.data.body.userPassword).toBe('[REDACTED]');
    expect(io.out).not.toContain('5f4dcc3b5aa765d61d8327deb882cf99');
  });
  it('reports invalid arguments as JSON and returns exit code 2', async () => {
    const { io, env } = harness();
    expect(await run(['comment', 'post', '123', '-c', 'x', '-f', 'x.md', '-d', '-j'], { io, env })).toBe(2);
    expect(JSON.parse(io.err)).toMatchObject({ ok: false, status: 'error', error: { code: 'INVALID_INPUT' } });
  });
  it('rejects invalid notification types before sending', async () => {
    const { io, env } = harness();
    expect(await run(['notice', 'read', 'wallet', '-d', '-j'], { io, env })).toBe(2);
    expect(JSON.parse(io.err).error.code).toBe('INVALID_INPUT');
  });
  it('never reports an unexpected internal failure as success', async () => {
    const { io, env } = harness();
    const failing: IO = {
      stdout: { isTTY: true, write() { throw new Error('stdout is gone'); } },
      stderr: io.stderr,
      stdin: io.stdin,
    };
    expect(await run(['article', 'post', '--title', 't', '--tags', 'a', '-c', 'x', '-d', '-j'], { io: failing, env })).toBe(1);
    expect(JSON.parse(io.err)).toMatchObject({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'stdout is gone' } });
  });
  it('labels usage errors with the same command name as successful runs', async () => {
    const { io, env } = harness();
    expect(await run(['article', 'list', '-y', '-j'], { io, env })).toBe(2);
    expect(JSON.parse(io.err).command).toBe('articles.list');
  });
  it('documents the global flags in subcommand help', async () => {
    const { io, env } = harness();
    expect(await run(['article', 'post', '--help'], { io, env })).toBe(0);
    for (const flag of ['--token', '--base-url', '--json', '--dry-run', '--yes']) expect(io.out).toContain(flag);
  });
  it('supports short global and help flags', async () => {
    const { io, env } = harness();
    expect(await run(['user', 'me', '-h'], { io, env })).toBe(0);
    expect(io.out).toContain('Usage:');
  });
});
