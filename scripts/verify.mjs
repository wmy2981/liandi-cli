#!/usr/bin/env node
/**
 * End-to-end verification of every CLI command, flag and failure path.
 * Runs against a local mock ld246.com server: no network access, no real token.
 *
 *   node scripts/verify.mjs [--verbose]
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI = fileURLToPath(new URL('../dist/cli.js', import.meta.url));
const verbose = process.argv.includes('--verbose');

if (!existsSync(CLI)) {
  console.error(`missing ${CLI}; run "npm run build" before this script`);
  process.exit(1);
}

const requests = [];
const server = createServer(async (request, response) => {
  let body = '';
  for await (const chunk of request) body += chunk;
  requests.push({ method: request.method, url: request.url, headers: request.headers, body });
  const token = String(request.headers.authorization ?? '');
  const reply = (status, payload, type = 'application/json') => {
    response.writeHead(status, { 'Content-Type': type });
    response.end(typeof payload === 'string' ? payload : JSON.stringify(payload));
  };
  if (token.includes('mock-401')) return reply(401, { code: 401, msg: 'unauthorized', data: null });
  if (token.includes('mock-403')) return reply(403, { code: 403, msg: 'forbidden', data: null });
  if (token.includes('mock-500')) return reply(500, { code: 500, msg: 'boom', data: null });
  if (token.includes('mock-html')) return reply(200, '<html>blocked</html>', 'text/html');
  if (token.includes('mock-code1')) return reply(200, { code: 1, msg: '内容太短', data: null });
  if (request.url === '/api/v2/login' && body.includes('"userName":"twofa"')) {
    return reply(200, { code: 10, msg: 'need 2fa', token: 'session-from-login', userName: 'twofa' });
  }
  reply(200, {
    code: 0,
    msg: '',
    data: {
      path: request.url,
      method: request.method,
      authorization: request.headers.authorization ?? null,
      userAgent: request.headers['user-agent'] ?? null,
      cookie: request.headers.cookie ?? null,
      body: body ? JSON.parse(body) : null,
    },
    pagination: { paginationPageCount: 1, paginationPageNums: [1] },
  });
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;

function start(args, { env = {}, cwd, pty = false, input } = {}) {
  const fullEnv = { PATH: process.env.PATH, LIANDI_TOKEN: 'mock-token', LIANDI_BASE_URL: base, ...env };
  for (const [key, value] of Object.entries(fullEnv)) if (value === undefined) delete fullEnv[key];
  const command = pty ? 'script' : process.execPath;
  const commandArgs = pty ? ['-qefc', `${process.execPath} ${CLI} ${args.join(' ')}`, '/dev/null'] : [CLI, ...args];
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, { env: fullEnv, cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', data => { stdout += data.toString(); });
    child.stderr.on('data', data => { stderr += data.toString(); });
    child.on('error', reject);
    child.on('close', code => resolve({ code, stdout, stderr }));
    // Always close stdin: an open pipe would let the CLI wait for input forever.
    child.stdin.end(input ?? '');
  });
}

const results = [];
async function check(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
  } catch (error) {
    results.push({ name, ok: false, detail: error instanceof Error ? error.message : String(error) });
  }
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function json(text, label = 'stdout') {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label} is not JSON: ${text.slice(0, 160)}`);
  }
}

const fixture = mkdtempSync(join(tmpdir(), 'liandi-verify-'));
const postFile = join(fixture, 'post.md');
writeFileSync(postFile, '# 标题\n\n中文正文，含 emoji 🎉\n');

// ---------------------------------------------------------------- reads
const reads = [
  ['article list', ['article', 'list'], '/api/v2/articles/latest?p=1'],
  ['article list --sort hot', ['article', 'list', '-s', 'hot'], '/api/v2/articles/latest/hot?p=1'],
  ['article list --sort good -p 3', ['article', 'list', '-s', 'good', '-p', '3'], '/api/v2/articles/latest/good?p=3'],
  ['article list --sort reply', ['article', 'list', '-s', 'reply'], '/api/v2/articles/latest/reply?p=1'],
  ['article list --sort perfect', ['article', 'list', '-s', 'perfect'], '/api/v2/articles/latest/perfect?p=1'],
  ['article list --tag', ['article', 'list', '--tag', 'Java'], '/api/v2/articles/tag/Java?p=1'],
  ['article list --tag --sort', ['article', 'list', '--tag', 'C++', '-s', 'hot'], '/api/v2/articles/tag/C%2B%2B/hot?p=1'],
  ['article list --domain', ['article', 'list', '--domain', 'Java'], '/api/v2/articles/domain/Java?p=1'],
  ['article get', ['article', 'get', '123', '-p', '2'], '/api/v2/article/123?p=2'],
  ['article source', ['article', 'source', '123'], '/api/v2/article/update/123'],
  ['domain list', ['domain', 'list'], '/api/v2/domains?p=1'],
  ['domain get', ['domain', 'get', 'Java'], '/api/v2/domain/Java'],
  ['tag list', ['tag', 'list'], '/api/v2/tags?p=1'],
  ['tag get', ['tag', 'get', 'Java'], '/api/v2/tag/Java'],
  ['user me', ['user', 'me'], '/api/v2/user'],
  ['user get', ['user', 'get', '88250'], '/api/v2/user/88250'],
  ['user get --number', ['user', 'get', '1', '--number'], '/api/v2/user/n/1'],
  ['user articles', ['user', 'articles', '88250'], '/api/v2/user/88250/articles?p=1'],
  ['user comments', ['user', 'comments', '88250'], '/api/v2/user/88250/comments?p=1'],
  ['user events', ['user', 'events', '88250'], '/api/v2/user/88250/events?size=16'],
  ['user events --size', ['user', 'events', '88250', '-s', '64'], '/api/v2/user/88250/events?size=64'],
  ['user watches', ['user', 'watches', '88250'], '/api/v2/user/88250/watching/articles?p=1'],
  ['user follows', ['user', 'follows', '88250'], '/api/v2/user/88250/following/users?p=1'],
  ['user tags', ['user', 'tags', '88250'], '/api/v2/user/88250/following/tags?p=1'],
  ['user stars', ['user', 'stars', '88250'], '/api/v2/user/88250/following/articles?p=1'],
  ['user followers', ['user', 'followers', '88250'], '/api/v2/user/88250/followers?p=1'],
  ['notice unread', ['notice', 'unread'], '/api/v2/notifications/unread/count'],
  ...['commented', 'comment2ed', 'reply', 'at', 'following', 'point', 'broadcast', 'wallet', 'sys-announce']
    .map(type => [`notice ${type}`, ['notice', type], `/api/v2/notifications/${type}?p=1`]),
  ['top newbies', ['top', 'newbies'], '/api/v2/tops/users/newbies'],
  ['top followers', ['top', 'followers'], '/api/v2/tops/users/followers'],
  ['time', ['time'], '/api/v2/system/time'],
];

for (const [name, args, path] of reads) {
  await check(`read: ${name}`, async () => {
    const result = await start([...args, '-j']);
    assert(result.code === 0, `exit ${result.code}: ${result.stderr.slice(0, 200)}`);
    const payload = json(result.stdout);
    assert(payload.ok === true && payload.status === 'success', 'bad envelope');
    assert(payload.data.data.path === path, `path ${payload.data.data.path} != ${path}`);
    assert(payload.data.data.authorization === 'token mock-token', 'token not sent');
    assert(/^liandi\/\d+\.\d+\.\d+ /u.test(payload.data.data.userAgent), 'bad UA');
  });
}

await check('read: aliases a/c/u/n/dom/tags/tops', async () => {
  for (const args of [['a', 'list'], ['c', 'post', '1', '-c', 'x', '-d'], ['u', 'me'], ['n', 'unread'], ['dom', 'list'], ['tags', 'list'], ['tops', 'newbies'], ['articles', 'list'], ['users', 'me'], ['notifications', 'unread'], ['domains', 'list'], ['comments', 'post', '1', '-c', 'x', '-d']]) {
    const result = await start([...args, '-j']);
    assert(result.code === 0, `${args.join(' ')} -> ${result.code} ${result.stderr.slice(0, 120)}`);
  }
});

await check('read: human output is formatted JSON without envelope', async () => {
  const result = await start(['time']);
  assert(result.code === 0, 'nonzero exit');
  assert(!result.stdout.includes('"ok"'), 'unexpected envelope in human mode');
  assert(!result.stdout.includes('\u001B'), 'unexpected ANSI escapes on a pipe');
  assert(json(result.stdout).code === 0, 'missing upstream code');
});

await check('output: color follows flags, environment and TTY', async () => {
  const forced = await start(['bogus', '--color', 'always']);
  assert(forced.code === 2, `exit ${forced.code}`);
  assert(forced.stderr.includes('\u001B[31m'), 'missing red status line');
  const piped = await start(['bogus']);
  assert(!piped.stderr.includes('\u001B'), 'unexpected ANSI on a pipe');
  const disabled = await start(['bogus', '--color', 'always', '--no-color']);
  assert(!disabled.stderr.includes('\u001B'), '--no-color ignored');
  const noColor = await start(['bogus'], { env: { NO_COLOR: '1' } });
  assert(!noColor.stderr.includes('\u001B'), 'NO_COLOR ignored');
  const forcedEnv = await start(['bogus'], { env: { NO_COLOR: '1', FORCE_COLOR: '1' } });
  assert(forcedEnv.stderr.includes('\u001B'), 'FORCE_COLOR ignored');
  const tty = await start(['bogus'], { pty: true });
  assert(tty.stdout.includes('\u001B[31m'), 'missing color in a TTY');
});

// ---------------------------------------------------------------- writes
const writes = [
  ['article post', ['article', 'post', '--title', 'T', '--tags', 'a,b', '-c', 'body'], 'POST', '/api/v2/article'],
  ['article post --content-file', ['article', 'post', '--title', 'T', '--tags', 'a,b', '-f', postFile], 'POST', '/api/v2/article'],
  ['article edit', ['article', 'edit', '123', '--title', 'T', '--tags', 'a', '-c', 'b', '--type', '0'], 'PUT', '/api/v2/article/123'],
  ['comment post', ['comment', 'post', '123', '-c', 'hi'], 'POST', '/api/v2/comment'],
  ['comment post --reply-to', ['comment', 'post', '123', '-c', 'hi', '-r', '456'], 'POST', '/api/v2/comment'],
  ['comment edit', ['comment', 'edit', '456', '-c', 'hi', '--visible', 'false'], 'PUT', '/api/v2/comment/456'],
  ['notice read commented', ['notice', 'read', 'commented'], 'GET', '/api/v2/notifications/make-read/commented'],
  ['notice read comment2ed', ['notice', 'read', 'comment2ed'], 'GET', '/api/v2/notifications/make-read/comment2ed'],
  ['notice read reply', ['notice', 'read', 'reply'], 'GET', '/api/v2/notifications/make-read/reply'],
  ['notice read at', ['notice', 'read', 'at'], 'GET', '/api/v2/notifications/make-read/at'],
  ['notice read following', ['notice', 'read', 'following'], 'GET', '/api/v2/notifications/make-read/following'],
  ['auth login', ['auth', 'login', '-u', 'alice', '--password', 'secret'], 'POST', '/api/v2/login'],
  ['auth 2fa', ['auth', '2fa', '--session-token', 'session', '--code', '123456'], 'POST', '/api/v2/login/2fa'],
  ['auth logout', ['auth', 'logout'], 'POST', '/api/v2/logout'],
];

for (const [name, args, method, path] of writes) {
  await check(`dry-run: ${name}`, async () => {
    const before = requests.length;
    const result = await start([...args, '-d', '-j']);
    assert(result.code === 0, `exit ${result.code}: ${result.stderr.slice(0, 200)}`);
    const payload = json(result.stdout);
    assert(payload.status === 'dry-run', `status ${payload.status}`);
    assert(payload.data.method === method, `method ${payload.data.method}`);
    assert(new URL(payload.data.url).pathname === path, `path ${payload.data.url}`);
    assert(requests.length === before, 'dry run sent a request');
    assert(!result.stdout.includes('secret') && !result.stdout.includes('mock-token'), 'credential leaked');
  });
}

for (const [name, args, method, path] of writes) {
  await check(`send: ${name}`, async () => {
    const result = await start([...args, '-y', '-j']);
    assert(result.code === 0, `exit ${result.code}: ${result.stderr.slice(0, 200)}`);
    const payload = json(result.stdout);
    assert(payload.status === 'success', `status ${payload.status}`);
    const last = requests.at(-1);
    assert(last.method === method && last.url === path, `sent ${last.method} ${last.url}`);
    if (path === '/api/v2/login' || path === '/api/v2/login/2fa') {
      assert(last.headers.authorization === undefined, 'login must not send an API token');
    } else {
      assert(last.headers.authorization === 'token mock-token', 'missing token header');
    }
  });
}

await check('send: article post keeps UTF-8 file content and reward fields', async () => {
  const result = await start(['article', 'post', '--title', '标题', '--tags', 'a,b', '-f', postFile, '--reward-point', '5', '--reward-content', '打赏区', '-y', '-j']);
  assert(result.code === 0, result.stderr);
  const body = requests.at(-1).body;
  const parsed = JSON.parse(body);
  assert(parsed.articleContent.includes('中文正文'), 'content not read');
  assert(parsed.articleContent.includes('🎉'), 'emoji lost');
  assert(parsed.articleRewardPoint === 5 && parsed.articleRewardContent === '打赏区', 'reward fields wrong');
  assert(parsed.articleContentType === 'markdown', 'content type wrong');
});

await check('send: 2FA uses symphony cookie and no Authorization', async () => {
  await start(['auth', '2fa', '--session-token', 'login-session', '--code', '654321', '-y', '-j']);
  const last = requests.at(-1);
  assert(last.headers.cookie === 'symphony=login-session', `cookie ${last.headers.cookie}`);
  assert(last.headers.authorization === undefined, 'unexpected authorization');
});

await check('confirm: interactive yes sends once', async () => {
  const before = requests.length;
  const result = await start(['comment', 'post', '123', '-c', 'hi', '-j'], { pty: true, input: 'y\n' });
  assert(result.code === 0, `exit ${result.code} ${result.stderr.slice(0, 200)}`);
  assert(requests.length === before + 1, `requests ${requests.length - before}`);
  // A pty merges both streams, so only the presence of the preview is checkable here.
  assert(result.stdout.includes('dry-run'), 'preview missing');
  assert(result.stdout.includes('"status": "success"'), 'success envelope missing');
});

await check('confirm: interactive no cancels without request', async () => {
  const before = requests.length;
  const result = await start(['comment', 'post', '123', '-c', 'hi', '-j'], { pty: true, input: 'n\n' });
  assert(result.code === 0, `exit ${result.code}`);
  assert(requests.length === before, 'request sent after cancel');
  assert(result.stdout.includes('cancelled'), 'not cancelled');
});

await check('confirm: non-interactive without -y is refused', async () => {
  const before = requests.length;
  const result = await start(['comment', 'post', '123', '-c', 'hi', '-j']);
  assert(result.code === 2, `exit ${result.code}`);
  const payload = json(result.stderr);
  assert(payload.error.code === 'CONFIRMATION_REQUIRED', 'wrong error');
  assert(payload.error.details?.url?.endsWith('/api/v2/comment'), 'error does not carry the preview');
  assert(result.stdout === '', `stdout should stay empty, got ${result.stdout.slice(0, 80)}`);
  assert(requests.length === before, 'request sent');
});

await check('password: --password-stdin reads one line and never echoes it', async () => {
  const result = await start(['auth', 'login', '-u', 'alice', '--password-stdin', '-d', '-j'], { input: 'piped-secret\n' });
  assert(result.code === 0, `exit ${result.code}: ${result.stderr.slice(0, 160)}`);
  const payload = json(result.stdout);
  assert(payload.status === 'dry-run', `status ${payload.status}`);
  assert(payload.data.body.userPassword === '[REDACTED]', 'password not redacted');
  assert(!result.stdout.includes('piped-secret') && !result.stderr.includes('piped-secret'), 'password echoed');
});

await check('password: --password-stdin with no input fails with exit 2', async () => {
  const before = requests.length;
  const result = await start(['auth', 'login', '-u', 'alice', '--password-stdin', '-y', '-j'], { input: '' });
  assert(result.code === 2, `exit ${result.code}`);
  assert(json(result.stderr).error.code === 'INVALID_INPUT', 'wrong error code');
  assert(result.stdout === '', 'stdout should stay empty');
  assert(requests.length === before, 'request sent without a password');
});

await check('password: --captcha is forwarded as a login field', async () => {
  const result = await start(['auth', 'login', '-u', 'alice', '--password', 'x', '--captcha', 'abcd', '-d', '-j']);
  assert(result.code === 0, `exit ${result.code}: ${result.stderr.slice(0, 160)}`);
  assert(json(result.stdout).data.body.captcha === 'abcd', 'captcha missing from the preview');
});

await check('output: stdout is always a single JSON document', async () => {
  for (const args of [['time'], ['article', 'list'], ['notice', 'read', 'at', '-d']]) {
    const result = await start([...args, '-j']);
    assert(result.code === 0, `${args.join(' ')} -> ${result.code}`);
    json(result.stdout);
    assert(result.stdout.trim().startsWith('{') && result.stdout.trim().endsWith('}'), `${args.join(' ')}: stdout is not one document`);
  }
});

// ---------------------------------------------------------------- validation
const invalid = [
  ['read with --dry-run', ['article', 'list', '-d'], 'INVALID_INPUT'],
  ['read with --yes', ['time', '-y'], 'INVALID_INPUT'],
  ['both content sources', ['comment', 'post', '1', '-c', 'x', '-f', postFile, '-y'], 'INVALID_INPUT'],
  ['no content source', ['comment', 'post', '1', '-y'], 'INVALID_INPUT'],
  ['missing content file', ['comment', 'post', '1', '-f', '/nope/file.md', '-y'], 'INVALID_INPUT'],
  ['bad content type', ['comment', 'post', '1', '-c', 'x', '--content-type', 'Markdown', '-y'], 'INVALID_INPUT'],
  ['bad sort', ['article', 'list', '-s', 'bogus'], 'INVALID_INPUT'],
  ['domain with sort', ['article', 'list', '--domain', 'Java', '-s', 'hot'], 'INVALID_INPUT'],
  ['tag and domain', ['article', 'list', '--tag', 'a', '--domain', 'b'], 'INVALID_INPUT'],
  ['bad page', ['article', 'list', '-p', '0'], 'INVALID_INPUT'],
  ['bad size', ['user', 'events', 'x', '-s', '65'], 'INVALID_INPUT'],
  ['bad visible', ['comment', 'edit', '1', '-c', 'x', '--visible', 'yes', '-y'], 'INVALID_INPUT'],
  ['bad reward point', ['article', 'post', '--title', 't', '--tags', 'a', '-c', 'x', '--reward-point', '1.5', '-y'], 'INVALID_INPUT'],
  ['bad 2fa code', ['auth', '2fa', '--session-token', 's', '--code', '12345', '-y'], 'INVALID_INPUT'],
  ['notice read wallet', ['notice', 'read', 'wallet', '-y'], 'INVALID_INPUT'],
  ['notice unknown type', ['notice', 'bogus'], 'INVALID_INPUT'],
  ['missing required option', ['article', 'post', '-c', 'x', '-y'], 'INVALID_INPUT'],
  ['missing article type', ['article', 'edit', '1', '--title', 't', '--tags', 'a', '-c', 'x', '-y'], 'INVALID_INPUT'],
  ['unknown command', ['bogus'], 'INVALID_INPUT'],
  ['unknown option', ['article', 'list', '--nope'], 'INVALID_INPUT'],
  ['login without password', ['auth', 'login', '-u', 'a', '-y'], 'INVALID_INPUT'],
  ['bad base url', ['time', '-b', 'file:///tmp'], 'CONFIG_ERROR'],
];

for (const [name, args, code] of invalid) {
  await check(`invalid: ${name}`, async () => {
    const result = await start([...args, '-j'], { env: { LIANDI_TOKEN: 'mock-token' } });
    assert(result.code === 2, `exit ${result.code} (want 2)`);
    const payload = json(result.stderr, 'stderr');
    assert(payload.ok === false && payload.status === 'error', 'bad error envelope');
    assert(payload.error.code === code, `code ${payload.error.code} != ${code}`);
    assert(result.stdout === '', `stdout should be empty, got ${result.stdout.slice(0, 80)}`);
  });
}

await check('invalid: no token for a login-only command', async () => {
  const result = await start(['user', 'me', '-j'], { env: { LIANDI_TOKEN: undefined } });
  assert(result.code === 2, `exit ${result.code}`);
  assert(json(result.stderr).error.code === 'AUTH_REQUIRED', 'wrong code');
});

await check('invalid: dry run works without a token', async () => {
  const result = await start(['article', 'post', '--title', 't', '--tags', 'a', '-c', 'x', '-d', '-j'], { env: { LIANDI_TOKEN: undefined } });
  assert(result.code === 0, `exit ${result.code}`);
  assert(json(result.stdout).status === 'dry-run', 'no preview');
});

await check('invalid: confirmed write without token fails before sending', async () => {
  const before = requests.length;
  const result = await start(['article', 'post', '--title', 't', '--tags', 'a', '-c', 'x', '-y', '-j'], { env: { LIANDI_TOKEN: undefined } });
  assert(result.code === 2, `exit ${result.code}`);
  assert(json(result.stderr).error.code === 'AUTH_REQUIRED', 'wrong code');
  assert(requests.length === before, 'request sent without token');
});

// ---------------------------------------------------------------- config priority
await check('config: flag beats env beats local .env beats global', async () => {
  const localDir = mkdtempSync(join(tmpdir(), 'liandi-cfg-local-'));
  const configHome = mkdtempSync(join(tmpdir(), 'liandi-cfg-home-'));
  mkdirSync(join(configHome, 'liandi'), { recursive: true });
  writeFileSync(join(localDir, '.env'), 'LIANDI_TOKEN=mock-local\n');
  writeFileSync(join(configHome, 'liandi', '.env'), 'LIANDI_TOKEN=mock-global\n');
  const seen = async (args, env) => {
    const result = await start([...args, '-j'], { env: { LIANDI_BASE_URL: base, ...env }, cwd: localDir });
    assert(result.code === 0, result.stderr.slice(0, 160));
    return json(result.stdout).data.data.authorization;
  };
  assert(await seen(['user', 'me'], { LIANDI_TOKEN: 'mock-env', XDG_CONFIG_HOME: configHome }) === 'token mock-env', 'env should win over files');
  assert(await seen(['user', 'me', '-t', 'mock-flag'], { LIANDI_TOKEN: 'mock-env', XDG_CONFIG_HOME: configHome }) === 'token mock-flag', 'flag should win');
  assert(await seen(['user', 'me'], { LIANDI_TOKEN: undefined, XDG_CONFIG_HOME: configHome }) === 'token mock-local', 'local .env should win over global');
  mkdirSync(join(configHome, 'liandi'), { recursive: true });
  const emptyDir = mkdtempSync(join(tmpdir(), 'liandi-cfg-empty-'));
  const result = await start(['user', 'me', '-j'], { env: { LIANDI_TOKEN: undefined, XDG_CONFIG_HOME: configHome }, cwd: emptyDir });
  assert(json(result.stdout).data.data.authorization === 'token mock-global', 'global .env should be used');
});

await check('config: --base-url and --token=value forms work', async () => {
  const result = await start(['time', `--base-url=${base}`, '--token=mock-eq', '-j']);
  assert(result.code === 0, result.stderr.slice(0, 160));
  assert(json(result.stdout).data.data.authorization === 'token mock-eq', 'token= form failed');
});

// ---------------------------------------------------------------- API errors
const apiErrors = [
  ['401 mapping', 'mock-401', 1, 'UNAUTHORIZED'],
  ['403 mapping', 'mock-403', 1, 'FORBIDDEN'],
  ['500 mapping', 'mock-500', 1, 'API_ERROR'],
  ['non-JSON body', 'mock-html', 1, 'API_ERROR'],
];
for (const [name, token, exit, code] of apiErrors) {
  await check(`api: ${name}`, async () => {
    const result = await start(['user', 'me', '-j'], { env: { LIANDI_TOKEN: token } });
    assert(result.code === exit, `exit ${result.code}`);
    const payload = json(result.stderr, 'stderr');
    assert(payload.error.code === code, `${payload.error.code} != ${code}`);
    assert(!payload.error.message.includes(token), 'token leaked in message');
  });
}

await check('api: upstream business error code fails the command', async () => {
  const result = await start(['article', 'list', '-j'], { env: { LIANDI_TOKEN: 'mock-code1' } });
  assert(result.code === 1, `exit ${result.code}`);
  const payload = json(result.stderr, 'stderr');
  assert(payload.error.code === 'API_CODE_1', `code ${payload.error.code}`);
  assert(payload.error.message === '内容太短', `message ${payload.error.message}`);
  assert(result.stdout === '', 'stdout should stay empty on failure');
});

await check('api: two-factor login returns the session token with a hint', async () => {
  const result = await start(['auth', 'login', '-u', 'twofa', '--password', 'x', '-y', '-j']);
  assert(result.code === 0, `exit ${result.code}`);
  const payload = json(result.stdout);
  assert(payload.data.token === 'session-from-login', 'session token missing');
  assert(payload.hint.includes('auth 2fa'), 'missing 2fa hint');
  assert(!result.stdout.includes('userPassword'), 'input password echoed');
});

await check('api: unreachable server is reported, not thrown', async () => {
  const result = await start(['time', '-j'], { env: { LIANDI_BASE_URL: 'http://127.0.0.1:1' } });
  assert(result.code === 1, `exit ${result.code}`);
  assert(json(result.stderr).error.code === 'NETWORK_ERROR', 'wrong code');
});

// ---------------------------------------------------------------- meta
await check('meta: --version prints semver', async () => {
  const result = await start(['--version']);
  assert(result.code === 0 && /^\d+\.\d+\.\d+/u.test(result.stdout.trim()), `got ${result.stdout}`);
});

await check('meta: --help lists every group and global flags', async () => {
  const result = await start(['--help']);
  assert(result.code === 0, 'nonzero exit');
  for (const group of ['article', 'comment', 'domain', 'tag', 'user', 'notice', 'top', 'auth', 'time', 'skill']) {
    assert(result.stdout.includes(group), `missing group ${group}`);
  }
  for (const flag of ['--json', '--dry-run', '--yes', '--token', '--base-url', '--color', '--no-color']) {
    assert(result.stdout.includes(flag), `missing flag ${flag}`);
  }
});

await check('meta: every group help renders', async () => {
  for (const group of ['article', 'comment', 'domain', 'tag', 'user', 'notice', 'top', 'auth', 'skill']) {
    const result = await start([group, '--help']);
    assert(result.code === 0, `${group} help exit ${result.code}`);
    assert(result.stdout.startsWith('Usage:'), `${group} help missing usage`);
  }
});

await check('meta: skill install dry-run and real install into a temp HOME', async () => {
  const home = mkdtempSync(join(tmpdir(), 'liandi-verify-home-'));
  const dry = await start(['skill', 'install', '-d', '-j'], { env: { HOME: home } });
  assert(dry.code === 0 && json(dry.stdout).status === 'dry-run', 'dry run failed');
  assert(!json(dry.stdout).data.destination.includes(home) === false, 'destination mismatch');
  const real = await start(['skill', 'install', '-y', '-j'], { env: { HOME: home } });
  assert(real.code === 0, real.stderr.slice(0, 160));
  const payload = json(real.stdout);
  assert(payload.status === 'success', 'install did not succeed');
  const { readFileSync, existsSync } = await import('node:fs');
  assert(existsSync(join(home, '.agents', 'skills', 'liandi', 'SKILL.md')), 'SKILL.md missing');
  assert(readFileSync(join(home, '.agents', 'skills', 'liandi', 'SKILL.md'), 'utf8').includes('name: liandi'), 'bad skill');
});

await check('meta: skill install refuses without -y in non-interactive mode', async () => {
  const home = mkdtempSync(join(tmpdir(), 'liandi-verify-home2-'));
  const result = await start(['skill', 'install', '-j'], { env: { HOME: home } });
  assert(result.code === 2, `exit ${result.code}`);
  assert(json(result.stderr).error.code === 'CONFIRMATION_REQUIRED', 'wrong code');
  assert(result.stdout === '', 'stdout should stay empty');
});

// ---------------------------------------------------------------- report
server.close();
const failed = results.filter(row => !row.ok);
for (const row of results) {
  if (verbose || !row.ok) console.log(`${row.ok ? 'PASS' : 'FAIL'}  ${row.name}${row.ok ? '' : `\n      ${row.detail}`}`);
}
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) process.exitCode = 1;
