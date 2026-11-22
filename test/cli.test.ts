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
  return { io, env: { LIANDI_TOKEN: 'fake-token', LIANDI_LANG: 'en' } };
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
  it('dropped the auth group', async () => {
    const { io, env } = harness();
    expect(await run(['auth', 'login', '-u', 'alice'], { io, env })).toBe(2);
    expect(io.err).toContain('unknown command');
    expect(io.out).toBe('');
  });
  it('rejects conflicting or unknown formats', async () => {
    const { io, env } = harness();
    expect(await run(['user', 'me', '-j', '--format', 'human'], { io, env })).toBe(2);
    expect(io.err).toContain('Use either --json or --format human');
    io.err = '';
    expect(await run(['user', 'me', '--format', 'xml'], { io, env })).toBe(2);
    expect(io.err).toContain('--format must be human or json');
  });
  it('renders human output by default and the envelope for --format json', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      code: 0, msg: '', data: { user: { userName: 'wmy2981', userNickname: 'W', userNo: 1, userArticleCount: 2 } },
    }))));
    try {
      const { io, env } = harness();
      expect(await run(['user', 'me'], { io, env })).toBe(0);
      expect(io.out).toContain('Username');
      expect(io.out).toContain('wmy2981');
      io.out = '';
      expect(await run(['user', 'me', '--lang', 'zh-CN'], { io, env })).toBe(0);
      expect(io.out).toContain('用户名');
      io.out = '';
      expect(await run(['user', 'me', '--lang', 'zh-TW'], { io, env })).toBe(0);
      expect(io.out).toContain('使用者名稱');
      io.out = '';
      expect(await run(['user', 'me', '--format', 'json'], { io, env })).toBe(0);
      expect(JSON.parse(io.out)).toMatchObject({ ok: true, status: 'success', command: 'users.me' });
    } finally {
      vi.unstubAllGlobals();
    }
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
    for (const flag of ['--token', '--base-url', '--format', '--json', '--dry-run', '--yes', '--color', '--no-color']) expect(io.out).toContain(flag);
  });
  it('colors status lines only when the flag or the terminal asks for it', async () => {
    const { io, env } = harness();
    expect(await run(['bogus', '--color', 'always'], { io, env })).toBe(2);
    expect(io.err).toBe('\u001B[31mError [INVALID_INPUT]: unknown command \'bogus\'\u001B[39m\n');
    io.err = '';
    expect(await run(['bogus', '--no-color'], { io, env })).toBe(2);
    expect(io.err).not.toContain('\u001B');
    io.err = '';
    const piped: IO = { ...io, stderr: { ...io.stderr, isTTY: false } };
    expect(await run(['bogus'], { io: piped, env })).toBe(2);
    expect(io.err).not.toContain('\u001B');
  });
  it('colors a dry-run status line but leaves the preview plain', async () => {
    const { io, env } = harness();
    const piped: IO = { ...io, stdout: { ...io.stdout, isTTY: false } };
    expect(await run(['article', 'post', '--title', 't', '--tags', 'a', '-c', 'x', '-d', '--color', 'always'], { io: piped, env })).toBe(0);
    expect(io.out).toContain('\u001B[33mDry run: no request was sent.\u001B[39m');
    expect(io.out.split('\n').slice(1).join('\n')).not.toContain('\u001B');
  });
  it('rejects an invalid --color value', async () => {
    const { io, env } = harness();
    expect(await run(['time', '--color', 'sometimes'], { io, env })).toBe(2);
    expect(io.err).toContain('--color must be auto, always or never');
  });
  it('supports short global and help flags', async () => {
    const { io, env } = harness();
    expect(await run(['user', 'me', '-h'], { io, env })).toBe(0);
    expect(io.out).toContain('Usage:');
  });
  it('localizes help, dry-run and human errors for zh-CN and zh-TW, while keeping JSON unchanged', async () => {
    const { io, env } = harness();
    expect(await run(['--help', '--lang', 'zh-CN'], { io, env })).toBe(0);
    expect(io.out).toContain('用法：');
    expect(io.out).toContain('全局选项');
    expect(io.out).toContain('--lang <locale>');
    io.out = '';

    expect(await run(['article', 'list', '--help', '--lang', 'zh-TW'], { io, env })).toBe(0);
    expect(io.out).toContain('用法：');
    expect(io.out).toContain('選項：');
    expect(io.out).toContain('全域選項');
    io.out = '';

    expect(await run(['article', 'post', '--title', 't', '--tags', 'a', '-c', 'x', '-d', '--lang', 'zh-TW', '--no-color'], { io, env })).toBe(0);
    expect(io.out).toContain('預覽模式：未傳送請求。');
    io.out = '';

    expect(await run(['bogus', '--lang', 'zh-CN', '--no-color'], { io, env })).toBe(2);
    expect(io.err).toBe("错误 [INVALID_INPUT]：未知命令 'bogus'\n");
    io.err = '';

    expect(await run(['bogus', '--lang', 'zh-TW', '--no-color'], { io, env })).toBe(2);
    expect(io.err).toBe("錯誤 [INVALID_INPUT]：未知命令 'bogus'\n");
    io.err = '';

    // JSON output must remain completely unaffected by --lang.
    expect(await run(['bogus', '--lang', 'zh-TW', '-j'], { io, env })).toBe(2);
    expect(JSON.parse(io.err)).toMatchObject({ ok: false, status: 'error', error: { code: 'INVALID_INPUT', message: "unknown command 'bogus'" } });
  });
  it('rejects unsupported --lang values', async () => {
    const { io, env } = harness();
    expect(await run(['time', '--lang', 'fr', '--no-color'], { io, env })).toBe(2);
    expect(io.err).toContain('--lang must be en, zh-CN or zh-TW');
    io.err = '';
    expect(await run(['time', '--lang', 'fr', '-j'], { io, env })).toBe(2);
    expect(JSON.parse(io.err).error).toMatchObject({ code: 'INVALID_INPUT', message: '--lang must be en, zh-CN or zh-TW' });
  });
});
