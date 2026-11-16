import { describe, expect, it } from 'vitest';
import { run } from '../src/program.js';
import type { IO } from '../src/runtime.js';
import { definitions } from '../src/catalog.js';
import type { ApiRequest } from '../src/client.js';

interface Case { name: string; args: string[]; path: string; flags?: Record<string, string> }

const cases: Case[] = [
  { name: 'articles.list', args: ['article', 'list'], path: '/api/v2/articles/latest?p=1' },
  { name: 'articles.list', args: ['article', 'list', '-s', 'good', '-p', '3'], path: '/api/v2/articles/latest/good?p=3' },
  { name: 'articles.list', args: ['article', 'list', '-s', 'reply'], path: '/api/v2/articles/latest/reply?p=1' },
  { name: 'articles.list', args: ['article', 'list', '-s', 'perfect'], path: '/api/v2/articles/latest/perfect?p=1' },
  { name: 'articles.list', args: ['article', 'list', '--tag', 'Java'], path: '/api/v2/articles/tag/Java?p=1' },
  { name: 'articles.list', args: ['article', 'list', '--tag', 'C++', '-s', 'hot'], path: '/api/v2/articles/tag/C%2B%2B/hot?p=1' },
  { name: 'articles.list', args: ['article', 'list', '--tag', 'Java', '-s', 'good'], path: '/api/v2/articles/tag/Java/good?p=1' },
  { name: 'articles.list', args: ['article', 'list', '--tag', 'Java', '-s', 'reply'], path: '/api/v2/articles/tag/Java/reply?p=1' },
  { name: 'articles.list', args: ['article', 'list', '--tag', 'Java', '-s', 'perfect'], path: '/api/v2/articles/tag/Java/perfect?p=1' },
  { name: 'articles.list', args: ['article', 'list', '--domain', 'Java'], path: '/api/v2/articles/domain/Java?p=1' },
  { name: 'articles.get', args: ['article', 'get', '123', '-p', '4'], path: '/api/v2/article/123?p=4' },
  { name: 'articles.source', args: ['article', 'source', '123'], path: '/api/v2/article/update/123' },
  { name: 'articles.post', args: ['article', 'post', '--title', 'T', '--tags', 'a,b', '-c', 'C'], path: '/api/v2/article' },
  { name: 'articles.edit', args: ['article', 'edit', '123', '--title', 'T', '--tags', 'a,b', '-c', 'C', '--type', '0'], path: '/api/v2/article/123' },
  { name: 'comments.post', args: ['comment', 'post', '123', '-c', 'C', '-r', '456'], path: '/api/v2/comment' },
  { name: 'comments.edit', args: ['comment', 'edit', '456', '-c', 'C', '--visible', 'false'], path: '/api/v2/comment/456' },
  { name: 'domains.list', args: ['domain', 'list'], path: '/api/v2/domains?p=1' },
  { name: 'domains.get', args: ['domain', 'get', 'Java'], path: '/api/v2/domain/Java' },
  { name: 'tags.list', args: ['tag', 'list'], path: '/api/v2/tags?p=1' },
  { name: 'tags.get', args: ['tag', 'get', 'Java'], path: '/api/v2/tag/Java' },
  { name: 'users.me', args: ['user', 'me'], path: '/api/v2/user' },
  { name: 'users.get', args: ['user', 'get', '88250'], path: '/api/v2/user/88250' },
  { name: 'users.get', args: ['user', 'get', '1', '--number'], path: '/api/v2/user/n/1' },
  { name: 'users.articles', args: ['user', 'articles', '88250'], path: '/api/v2/user/88250/articles?p=1' },
  { name: 'users.comments', args: ['user', 'comments', '88250'], path: '/api/v2/user/88250/comments?p=1' },
  { name: 'users.events', args: ['user', 'events', '88250', '-s', '64'], path: '/api/v2/user/88250/events?size=64' },
  { name: 'users.watches', args: ['user', 'watches', '88250'], path: '/api/v2/user/88250/watching/articles?p=1' },
  { name: 'users.follows', args: ['user', 'follows', '88250'], path: '/api/v2/user/88250/following/users?p=1' },
  { name: 'users.tags', args: ['user', 'tags', '88250'], path: '/api/v2/user/88250/following/tags?p=1' },
  { name: 'users.stars', args: ['user', 'stars', '88250'], path: '/api/v2/user/88250/following/articles?p=1' },
  { name: 'users.followers', args: ['user', 'followers', '88250'], path: '/api/v2/user/88250/followers?p=1' },
  { name: 'notices.unread', args: ['notice', 'unread'], path: '/api/v2/notifications/unread/count' },
  ...['commented', 'comment2ed', 'reply', 'at', 'following', 'point', 'broadcast', 'wallet', 'sys-announce']
    .map(type => ({ name: `notices.${type}`, args: ['notice', type], path: `/api/v2/notifications/${type}?p=1` })),
  ...['commented', 'comment2ed', 'reply', 'at', 'following']
    .map(type => ({ name: `notices.read.${type}`, args: ['notice', 'read', type], path: `/api/v2/notifications/make-read/${type}` })),
  { name: 'tops.newbies', args: ['top', 'newbies'], path: '/api/v2/tops/users/newbies' },
  { name: 'tops.followers', args: ['top', 'followers'], path: '/api/v2/tops/users/followers' },
  { name: 'auth.login', args: ['auth', 'login', '-u', 'test', '--password', 'not-real'], path: '/api/v2/login' },
  { name: 'auth.2fa', args: ['auth', '2fa', '--session-token', 'fake', '--code', '123456'], path: '/api/v2/login/2fa' },
  { name: 'auth.logout', args: ['auth', 'logout'], path: '/api/v2/logout' },
  { name: 'system.time', args: ['time'], path: '/api/v2/system/time' },
];

const valueFlags: Record<string, string> = {
  '-p': 'page', '--page': 'page', '-s': 'sortOrSize', '--sort': 'sort', '--size': 'size',
  '-c': 'content', '--content': 'content', '--title': 'title', '--tags': 'tags', '--type': 'type',
  '-r': 'replyTo', '--reply-to': 'replyTo', '--visible': 'visible', '-u': 'username', '--username': 'username',
  '--password': 'password', '--session-token': 'sessionToken', '--code': 'code', '--tag': 'tag', '--domain': 'domain',
};

function valuesFrom(args: string[], name: string): Record<string, string> {
  const values: Record<string, string> = { page: '1', sort: 'latest', size: '16', contentType: 'markdown', rewardPoint: '0', rewardContent: '' };
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--number') { values.number = 'true'; continue; }
    const flag = valueFlags[args[index]!];
    if (!flag) continue;
    const value = args[index + 1]!;
    if (flag === 'sortOrSize') values[name === 'users.events' ? 'size' : 'sort'] = value;
    else values[flag] = value;
  }
  return values;
}

describe('documented API command coverage', () => {
  it('maps every definition to a command', () => {
    expect(new Set(cases.map(entry => entry.name))).toEqual(new Set(Object.keys(definitions)));
  });

  for (const entry of cases) {
    it(`${entry.args.join(' ')} -> ${entry.path}`, async () => {
      const positional = entry.args[2] && !entry.args[2].startsWith('-') ? [entry.args[2]] : [];
      const request: ApiRequest = await definitions[entry.name]!.request(positional, valuesFrom(entry.args, entry.name));
      const url = new URL(`https://ld246.com${request.path}`);
      for (const [key, value] of Object.entries(request.query ?? {})) url.searchParams.set(key, String(value));
      expect(url.pathname + url.search).toBe(entry.path);
    });
  }

  for (const entry of cases.filter(item => definitions[item.name]!.write)) {
    it(`previews ${entry.args.join(' ')} without sending`, async () => {
      let out = '', err = '';
      const io: IO = {
        stdout: { isTTY: true, write(text: string) { out += text; return true; } },
        stderr: { isTTY: true, write(text: string) { err += text; return true; } },
        stdin: { isTTY: true },
      };
      expect(await run([...entry.args, '-d', '-j'], { io, env: {} }), err).toBe(0);
      const result = JSON.parse(out);
      expect(result.status).toBe('dry-run');
      expect(new URL(result.data.url).pathname).toBe(entry.path.split('?')[0]);
    });
  }

  it('rejects --yes and --dry-run for reads', async () => {
    for (const args of [['article', 'list'], ['time'], ['user', 'me']]) {
      let err = '';
      const io: IO = { stdout: { write: () => true }, stderr: { write(text: string) { err += text; return true; } }, stdin: { isTTY: true } };
      expect(await run([...args, '-y', '-j'], { io, env: {} })).toBe(2);
      expect(JSON.parse(err).error.code).toBe('INVALID_INPUT');
      err = '';
      expect(await run([...args, '-d', '-j'], { io, env: {} })).toBe(2);
      expect(JSON.parse(err).error.code).toBe('INVALID_INPUT');
    }
  });
});
