import { LiandiError } from './errors.js';
import { boolean, content, contentType, encodeSegment, integer, positiveInteger, size } from './input.js';
import type { ApiRequest } from './client.js';

type Values = Record<string, string | boolean | undefined>;

export interface Definition {
  name: string;
  write: boolean;
  /** The endpoint requires a login, so reject locally when no token exists. */
  auth: boolean;
  request: (args: string[], values: Values) => Promise<ApiRequest>;
}

const page = (v: Values) => positiveInteger(String(v.page ?? '1'));
const seg = (value: string, label: string) => encodeSegment(value, label);
const listAt = (route: string) => async (_args: string[], v: Values): Promise<ApiRequest> => ({ method: 'GET', path: route, query: { p: page(v) } });

const articleBody = async (v: Values) => ({
  articleTitle: v.title,
  articleTags: v.tags,
  articleContent: await content(v.content as string | undefined, v.contentFile as string | undefined),
  articleContentType: contentType(String(v.contentType)),
  articleRewardContent: v.rewardContent,
  articleRewardPoint: integer(String(v.rewardPoint)),
});

const SORTS = ['latest', 'hot', 'good', 'reply', 'perfect'] as const;
const NOTICE_TYPES = ['commented', 'comment2ed', 'reply', 'at', 'following', 'point', 'broadcast', 'wallet', 'sys-announce'] as const;
const READABLE_NOTICES = ['commented', 'comment2ed', 'reply', 'at', 'following'] as const;

export function sortSuffix(value: string): string {
  if (!SORTS.includes(value as (typeof SORTS)[number])) {
    throw new LiandiError('Sort must be latest, hot, good, reply or perfect', 'INVALID_INPUT', 2);
  }
  return value === 'latest' ? '' : `/${value}`;
}

export function noticeType(value: string): string {
  if (!NOTICE_TYPES.includes(value as (typeof NOTICE_TYPES)[number])) {
    throw new LiandiError(`Notice type must be one of: ${NOTICE_TYPES.join(', ')}`, 'INVALID_INPUT', 2);
  }
  return value;
}

export function readableNoticeType(value: string): string {
  if (!READABLE_NOTICES.includes(value as (typeof READABLE_NOTICES)[number])) {
    throw new LiandiError(`Only ${READABLE_NOTICES.join(', ')} can be marked read`, 'INVALID_INPUT', 2);
  }
  return value;
}

function userList(name: string, endpoint: string): Definition {
  return {
    name: `users.${name}`, write: false, auth: false,
    request: async (args, v) => ({ method: 'GET', path: `/api/v2/user/${seg(args[0]!, 'Username')}/${endpoint}`, query: { p: page(v) } }),
  };
}

const definitionsList: Definition[] = [
  {
    name: 'articles.list', write: false, auth: false,
    request: async (_args, v) => {
      const sort = sortSuffix(String(v.sort ?? 'latest'));
      const page_ = page(v);
      if (v.tag !== undefined && v.domain !== undefined) {
        throw new LiandiError('Use either --tag or --domain, not both', 'INVALID_INPUT', 2);
      }
      if (v.tag !== undefined) return { method: 'GET', path: `/api/v2/articles/tag/${seg(String(v.tag), 'Tag')}${sort}`, query: { p: page_ } };
      if (v.domain !== undefined) {
        if (sort !== '') throw new LiandiError('--domain supports only the default latest sort', 'INVALID_INPUT', 2);
        return { method: 'GET', path: `/api/v2/articles/domain/${seg(String(v.domain), 'Domain')}`, query: { p: page_ } };
      }
      return { method: 'GET', path: `/api/v2/articles/latest${sort}`, query: { p: page_ } };
    },
  },
  {
    name: 'articles.get', write: false, auth: false,
    request: async (args, v) => ({ method: 'GET', path: `/api/v2/article/${seg(args[0]!, 'Article ID')}`, query: { p: page(v) } }),
  },
  {
    name: 'articles.post', write: true, auth: true,
    request: async (_args, v) => ({ method: 'POST', path: '/api/v2/article', body: await articleBody(v) }),
  },
  {
    name: 'articles.source', write: false, auth: true,
    request: async args => ({ method: 'GET', path: `/api/v2/article/update/${seg(args[0]!, 'Article ID')}` }),
  },
  {
    name: 'articles.edit', write: true, auth: true,
    request: async (args, v) => ({
      method: 'PUT',
      path: `/api/v2/article/${seg(args[0]!, 'Article ID')}`,
      body: { ...(await articleBody(v)), articleType: integer(String(v.type)) },
    }),
  },
  {
    name: 'comments.post', write: true, auth: true,
    request: async (args, v) => ({
      method: 'POST',
      path: '/api/v2/comment',
      body: {
        articleId: args[0],
        commentContent: await content(v.content as string | undefined, v.contentFile as string | undefined),
        commentContentType: contentType(String(v.contentType)),
        ...(v.replyTo ? { commentOriginalCommentId: v.replyTo } : {}),
      },
    }),
  },
  {
    name: 'comments.edit', write: true, auth: true,
    request: async (args, v) => ({
      method: 'PUT',
      path: `/api/v2/comment/${seg(args[0]!, 'Comment ID')}`,
      body: {
        commentContent: await content(v.content as string | undefined, v.contentFile as string | undefined),
        commentContentType: contentType(String(v.contentType)),
        ...(v.visible !== undefined ? { commentVisible: boolean(String(v.visible)) } : {}),
      },
    }),
  },
  { name: 'domains.list', write: false, auth: false, request: listAt('/api/v2/domains') },
  { name: 'domains.get', write: false, auth: false, request: async args => ({ method: 'GET', path: `/api/v2/domain/${seg(args[0]!, 'Domain')}` }) },
  { name: 'tags.list', write: false, auth: false, request: listAt('/api/v2/tags') },
  { name: 'tags.get', write: false, auth: false, request: async args => ({ method: 'GET', path: `/api/v2/tag/${seg(args[0]!, 'Tag')}` }) },
  { name: 'users.me', write: false, auth: true, request: async () => ({ method: 'GET', path: '/api/v2/user' }) },
  {
    name: 'users.get', write: false, auth: false,
    request: async (args, v) => ({
      method: 'GET',
      path: v.number ? `/api/v2/user/n/${seg(args[0]!, 'User number')}` : `/api/v2/user/${seg(args[0]!, 'Username')}`,
    }),
  },
  userList('articles', 'articles'),
  userList('comments', 'comments'),
  {
    name: 'users.events', write: false, auth: false,
    request: async (args, v) => ({ method: 'GET', path: `/api/v2/user/${seg(args[0]!, 'Username')}/events`, query: { size: size(String(v.size)) } }),
  },
  userList('watches', 'watching/articles'),
  userList('follows', 'following/users'),
  userList('tags', 'following/tags'),
  userList('stars', 'following/articles'),
  userList('followers', 'followers'),
  { name: 'notices.unread', write: false, auth: true, request: async () => ({ method: 'GET', path: '/api/v2/notifications/unread/count' }) },
  ...NOTICE_TYPES.map(type => ({
    name: `notices.${type}`, write: false, auth: true,
    request: listAt(`/api/v2/notifications/${type}`),
  })),
  ...READABLE_NOTICES.map(type => ({
    name: `notices.read.${type}`, write: true, auth: true,
    request: async (): Promise<ApiRequest> => ({ method: 'GET', path: `/api/v2/notifications/make-read/${type}` }),
  })),
  { name: 'tops.newbies', write: false, auth: false, request: async () => ({ method: 'GET', path: '/api/v2/tops/users/newbies' }) },
  { name: 'tops.followers', write: false, auth: false, request: async () => ({ method: 'GET', path: '/api/v2/tops/users/followers' }) },
  { name: 'system.time', write: false, auth: false, request: async () => ({ method: 'GET', path: '/api/v2/system/time' }) },
];

export const definitions: Record<string, Definition> = Object.fromEntries(definitionsList.map(definition => [definition.name, definition]));
