import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createServer, type IncomingMessage } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/** Never hard-code the version: `npm version` bumps it before this suite runs. */
const packageVersion = (JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }).version;

let url: string;
let server: ReturnType<typeof createServer>;
const requests: Array<{ method?: string; url?: string; headers: IncomingMessage['headers']; body: string }> = [];

beforeAll(async () => {
  server = createServer(async (request, response) => {
    let body = '';
    for await (const chunk of request) body += chunk;
    requests.push({ method: request.method, url: request.url, headers: request.headers, body });
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ code: 0, msg: '', data: { path: request.url } }));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('No test server address');
  url = `http://127.0.0.1:${address.port}`;
});
afterAll(async () => { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); });

function cli(args: string[], { input }: { input?: string } = {}) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(process.execPath, ['dist/cli.js', ...args, '-j'], { env: { PATH: process.env.PATH ?? '', LIANDI_TOKEN: 'fake', LIANDI_BASE_URL: url } });
    let stdout = '', stderr = '';
    child.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
    child.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });
    child.on('error', reject);
    child.on('close', code => resolve({ code, stdout, stderr }));
    child.stdin.end(input ?? '');
  });
}

describe('built CLI with a local HTTP server', () => {
  it('executes reads with a custom UA and the configured token', async () => {
    const result = await cli(['article', 'list', '-p', '2']);
    expect(result.code, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ ok: true, status: 'success', data: { code: 0 } });
    const request = requests.at(-1)!;
    expect(request.url).toBe('/api/v2/articles/latest?p=2');
    expect(request.headers.authorization).toBe('token fake');
    expect(request.headers['user-agent']).toBe(`liandi/${packageVersion} (+https://github.com/wmy2981/liandi-cli)`);
  });
  it('executes an approved write exactly once with API token and JSON body', async () => {
    const result = await cli(['comment', 'post', '123', '--content', '测试', '--yes']);
    expect(result.code, result.stderr).toBe(0);
    const request = requests.at(-1)!;
    expect(request.method).toBe('POST');
    expect(request.headers.authorization).toBe('token fake');
    expect(JSON.parse(request.body)).toMatchObject({ articleId: '123', commentContent: '测试', commentContentType: 'markdown' });
    expect(result.stdout).not.toContain('fake');
  });
  it('reads a password from stdin without echoing or misusing it', async () => {
    const preview = await cli(['auth', 'login', '-u', 'alice', '--password-stdin', '-d'], { input: 'piped-secret\n' });
    expect(preview.code, preview.stderr).toBe(0);
    expect(JSON.parse(preview.stdout).data.body).toMatchObject({ userName: 'alice', userPassword: '[REDACTED]' });
    expect(preview.stdout + preview.stderr).not.toContain('piped-secret');
  });
  it('fails with a JSON error when --password-stdin has no input', async () => {
    const before = requests.length;
    const result = await cli(['auth', 'login', '-u', 'alice', '--password-stdin', '-y']);
    expect(result.code).toBe(2);
    expect(JSON.parse(result.stderr)).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } });
    expect(result.stdout).toBe('');
    expect(requests.length).toBe(before);
  });
  it('does not send a dry run or non-interactive unconfirmed write', async () => {
    const before = requests.length;
    expect((await cli(['comment', 'post', '123', '-c', 'test', '-d'])).code).toBe(0);
    expect((await cli(['comment', 'post', '123', '-c', 'test'])).code).toBe(2);
    expect(requests.length).toBe(before);
  });
});
