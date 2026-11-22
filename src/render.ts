/**
 * Human-readable rendering for the read commands.
 *
 * JSON stays the machine contract (`-j` / `--format json`); this module only decides
 * how the same payload looks in a terminal. Field names come from live ld246
 * responses. A renderer returns `undefined` when the payload does not look like what
 * it expects, so an upstream change degrades to plain JSON instead of printing a
 * half-empty table.
 */

export interface RenderContext {
  /** Usable columns for tables. */
  width?: number;
  /** Server the request went to; used for links the API returns as paths. */
  baseUrl?: string;
}

type Row = Record<string, unknown>;

const DEFAULT_WIDTH = 96;
const GAP = '  ';
const MIN_FLEX = 12;
const SEPARATOR = '─';

/* ------------------------------------------------------------------ values */

function record(value: unknown): Row | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Row : undefined;
}

function records(value: unknown): Row[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const rows = value.map(record);
  return rows.every(row => row !== undefined) ? rows as Row[] : undefined;
}

function text(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function count(value: unknown): string {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? String(parsed) : '';
}

function stamp(value: unknown): string {
  const ms = Number(value);
  if (!Number.isFinite(ms)) return '';
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** Comment bodies and descriptions arrive as HTML; drop the markup, keep the words. */
function stripHtml(value: unknown): string {
  return text(value)
    .replace(/<(?:br|\/p|\/div|\/li|\/h[1-6])\s*\/?>/giu, '\n')
    .replace(/<[^>]*>/gu, '')
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/giu, (match, entity: string) => {
      if (entity.startsWith('#')) {
        const code = entity[1]?.toLowerCase() === 'x' ? Number.parseInt(entity.slice(2), 16) : Number.parseInt(entity.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : match;
      }
      return ENTITIES[entity.toLowerCase()] ?? match;
    })
    .split('\n')
    .map(line => line.replace(/[ \t]+/gu, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/gu, '\n\n')
    .trim();
}

function oneLine(value: unknown): string {
  return stripHtml(value).replace(/\s+/gu, ' ').trim();
}

/** Indent a multi-line body; blank lines stay blank instead of gaining trailing spaces. */
function indent(value: string, prefix = '   '): string {
  return value.split('\n').map(line => line.trim() ? `${prefix}${line.trimEnd()}` : '').join('\n');
}

/* ------------------------------------------------------------------- width */

// East Asian wide and fullwidth characters, plus emoji, occupy two cells.
const WIDE = /[\u1100-\u115F\u2E80-\u33FF\u3400-\u4DBF\u4E00-\u9FFF\uA960-\uA97F\uAC00-\uD7A3\uF900-\uFAFF\uFE10-\uFE19\uFE30-\uFE6F\uFF00-\uFF60\uFFE0-\uFFE6]|[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

function cellWidth(value: string): number {
  let width = 0;
  for (const char of value) width += WIDE.test(char) ? 2 : 1;
  return width;
}

function fit(value: string, width: number): string {
  if (width <= 0) return '';
  if (cellWidth(value) <= width) return value;
  let out = '';
  let used = 0;
  for (const char of value) {
    const charWidth = WIDE.test(char) ? 2 : 1;
    if (used + charWidth > width - 1) break;
    out += char;
    used += charWidth;
  }
  return `${out}…`;
}

function pad(value: string, width: number, align: 'left' | 'right' = 'left'): string {
  const fill = ' '.repeat(Math.max(0, width - cellWidth(value)));
  return align === 'right' ? `${fill}${value}` : `${value}${fill}`;
}

interface Column {
  header: string;
  align?: 'left' | 'right';
}

/**
 * Aligned table. One column may absorb the overflow (flex) so titles keep their
 * space while a narrow terminal stays usable; every other column shrinks only as a
 * last resort.
 */
function table(columns: readonly Column[], rows: readonly (readonly string[])[], width: number, flex = 0): string {
  const cells = rows.map(row => columns.map((_column, index) => oneLine(row[index] ?? '')));
  const widths = columns.map((column, index) => Math.max(cellWidth(column.header), ...cells.map(row => cellWidth(row[index] ?? ''))));
  const total = () => widths.reduce((sum, item) => sum + item, 0) + cellWidth(GAP) * Math.max(0, columns.length - 1);

  let overflow = total() - width;
  if (overflow > 0) {
    const flexWidth = widths[flex] ?? MIN_FLEX;
    const shrinkFlex = Math.min(overflow, Math.max(0, flexWidth - MIN_FLEX));
    widths[flex] = flexWidth - shrinkFlex;
    overflow -= shrinkFlex;
  }
  for (let index = columns.length - 1; index >= 0 && overflow > 0; index -= 1) {
    if (index === flex) continue;
    const floor = Math.max(4, cellWidth(columns[index]?.header ?? ''));
    const shrink = Math.min(overflow, Math.max(0, (widths[index] ?? floor) - floor));
    widths[index] = (widths[index] ?? floor) - shrink;
    overflow -= shrink;
  }

  const line = (row: readonly string[]) => columns.map((column, index) => {
    const width_ = widths[index] ?? MIN_FLEX;
    return pad(fit(oneLine(row[index] ?? ''), width_), width_, column.align);
  }).join(GAP).trimEnd();

  return [
    line(columns.map(column => column.header)),
    columns.map((_column, index) => SEPARATOR.repeat(widths[index] ?? MIN_FLEX)).join(GAP),
    ...cells.map(line),
  ].join('\n');
}

function summary(entries: readonly (readonly [string, string])[]): string {
  const visible = entries.filter(([, value]) => value !== '');
  if (visible.length === 0) return '';
  const width = Math.max(...visible.map(([label]) => cellWidth(label)));
  return visible.map(([label, value]) => `${pad(label, width)}  ${value}`).join('\n');
}

function section(title: string, body: string): string {
  return `${title}\n${SEPARATOR.repeat(Math.max(8, Math.min(cellWidth(title), 40)))}\n${body}`;
}

function pageNote(pagination: unknown, shown: number): string {
  const pages = count(record(pagination)?.paginationPageCount);
  return pages ? `本页 ${shown} 条 · 共 ${pages} 页` : `本页 ${shown} 条`;
}

/* ------------------------------------------------------------------- links */

function base(context: RenderContext): string {
  return (context.baseUrl ?? 'https://ld246.com').replace(/\/+$/u, '');
}

function absolute(url: string, context: RenderContext): string {
  if (!url) return '';
  return url.startsWith('http') ? url : `${base(context)}${url}`;
}

function articleUrl(article: Row, context: RenderContext): string {
  const permalink = text(article.articlePermalink);
  if (permalink) return permalink;
  const link = text(article.articleLink);
  if (link) return absolute(link, context);
  const id = text(article.oId);
  return id ? `${base(context)}/article/${id}` : '';
}

function userUrl(user: Row, context: RenderContext): string {
  const url = text(user.userURL);
  if (url) return url;
  const name = text(user.userName);
  return name ? `${base(context)}/member/${name}` : '';
}

/* -------------------------------------------------------------- renderers */

function articlesList(value: unknown, context: RenderContext): string | undefined {
  const body = record(value);
  const articles = records(body?.articles);
  if (!body || !articles) return undefined;
  if (articles.length === 0) return '没有帖子。';
  const blocks = articles.map((article, index) => {
    const title = text(article.articleTitle) || '(无标题)';
    const meta = [
      text(article.articleAuthorName) || '匿名',
      text(article.articleCreateTimeStr) || stamp(article.articleCreateTime),
      count(article.articleCommentCount) ? `${count(article.articleCommentCount)} 回帖` : '',
      count(article.articleViewCount) ? `${count(article.articleViewCount)} 浏览` : '',
    ].filter(Boolean).join(' · ');
    return [`${String(index + 1).padStart(2, ' ')}. ${title}`, `    ${meta}`, `    ${articleUrl(article, context)}`].join('\n');
  });
  return `${blocks.join('\n')}\n\n${pageNote(body.pagination, articles.length)}`;
}

function commentsSection(comments: Row[], context: RenderContext): string {
  return comments.map((comment, index) => {
    const head = [
      text(comment.commentAuthorName) || text(record(comment.commenter)?.userName) || '匿名',
      text(comment.commentCreateTimeStr) || stamp(comment.commentCreateTime),
      text(comment.commentVisible) === '1' || comment.commentVisible === true ? '（仅作者可见）' : '',
      count(comment.commentReplyCnt) && count(comment.commentReplyCnt) !== '0' ? `${count(comment.commentReplyCnt)} 条回复` : '',
    ].filter(Boolean).join(' · ');
    const body = stripHtml(comment.commentContent) || '(空)';
    return `${index + 1}. ${head}\n${indent(body)}`;
  }).join('\n\n');
}

function articleDetail(value: unknown, context: RenderContext): string | undefined {
  const body = record(value);
  const article = record(body?.article);
  if (!article) return undefined;
  const header = summary([
    ['标题', text(article.articleTitle) || '(无标题)'],
    ['作者', text(article.articleAuthorName)],
    ['时间', [text(article.articleCreateTimeStr) || stamp(article.articleCreateTime), text(article.timeAgo)].filter(Boolean).join(' · ')],
    ['标签', text(article.articleTags)],
    ['互动', [
      count(article.articleCommentCount) ? `${count(article.articleCommentCount)} 回帖` : '',
      count(article.articleViewCount) ? `${count(article.articleViewCount)} 浏览` : '',
      count(article.articleGoodCnt) ? `${count(article.articleGoodCnt)} 赞` : '',
      count(article.articleCollectCnt) ? `${count(article.articleCollectCnt)} 收藏` : '',
    ].filter(Boolean).join(' · ')],
    ['链接', articleUrl(article, context)],
  ]);
  const content = text(article.articleContent) || '(无正文)';
  const comments = records(article.articleComments) ?? [];
  const parts = [header, section('正文', content)];
  if (comments.length > 0) parts.push(section(`回帖（本页 ${comments.length} 条 · 共 ${count(article.articleCommentCount) || comments.length} 条）`, commentsSection(comments, context)));
  parts.push(pageNote(body?.pagination, comments.length));
  return parts.join('\n\n');
}

function articleSource(value: unknown, context: RenderContext): string | undefined {
  const article = record(record(value)?.article);
  if (!article) return undefined;
  const header = summary([
    ['标题', text(article.articleTitle) || '(无标题)'],
    ['类型', text(article.articleType)],
    ['标签', text(article.articleTags)],
    ['内容类型', text(article.articleContentType) || '未知（提交时请显式传 --content-type）'],
    ['奖励', `${count(article.articleRewardPoint) || '0'} 积分`],
    ['链接', articleUrl(article, context)],
  ]);
  return `${header}\n\n${section('正文（原样，可直接用于 article edit）', text(article.articleContent) || '(无正文)')}`;
}

function userSummary(value: unknown, context: RenderContext): string | undefined {
  const user = record(record(value)?.user);
  if (!user) return undefined;
  return summary([
    ['用户名', text(user.userName)],
    ['昵称', text(user.userNickname)],
    ['用户号', text(user.userNo)],
    ['简介', oneLine(user.userIntro)],
    ['标签', text(user.userTags)],
    ['文章 / 回帖', [count(user.userArticleCount), count(user.userCommentCount)].filter(Boolean).join(' / ')],
    ['积分 / 排名', [count(user.userPoint), count(user.userGeneralRank)].filter(Boolean).join(' / ')],
    ['连续签到', count(user.userCurrentCheckinStreak) ? `${count(user.userCurrentCheckinStreak)} 天（最长 ${count(user.userLongestCheckinStreak) || '?'} 天）` : ''],
    ['主页', userUrl(user, context)],
  ]);
}

const USER_COLUMNS: readonly Column[] = [
  { header: '用户名' }, { header: '昵称' }, { header: '文章', align: 'right' },
  { header: '回帖', align: 'right' }, { header: '积分', align: 'right' }, { header: '主页' },
];

function usersTable(users: Row[], context: RenderContext, width: number): string {
  const rows = users.map(user => [
    text(user.userName), text(user.userNickname) || '-', count(user.userArticleCount) || '0',
    count(user.userCommentCount) || '0', count(user.userPoint) || '0', userUrl(user, context),
  ]);
  return table(USER_COLUMNS, rows, width, 1);
}

function usersList(value: unknown, context: RenderContext, width: number): string | undefined {
  const body = record(value);
  const users = records(body?.users);
  if (!body || !users) return undefined;
  if (users.length === 0) return '没有用户。';
  const note = body.pagination ? pageNote(body.pagination, users.length) : `共 ${users.length} 位`;
  return `${usersTable(users, context, width)}\n\n${note}`;
}

function tagsList(value: unknown, context: RenderContext, width: number): string | undefined {
  const body = record(value);
  const tags = records(body?.tags);
  if (!body || !tags) return undefined;
  if (tags.length === 0) return '没有标签。';
  const rows = tags.map(tag => [
    text(tag.tagTitle), count(tag.tagReferenceCount) || '0', count(tag.tagCommentCount) || '0',
    count(tag.tagFollowerCount) || '0', absolute(text(tag.tagURI), context),
  ]);
  const rendered = table([
    { header: '标签' }, { header: '引用', align: 'right' }, { header: '回帖', align: 'right' },
    { header: '关注', align: 'right' }, { header: '链接' },
  ], rows, width, 0);
  return `${rendered}\n\n${pageNote(body.pagination, tags.length)}`;
}

function domainsList(value: unknown, context: RenderContext, width: number): string | undefined {
  const body = record(value);
  const domains = records(body?.domains);
  if (!body || !domains) return undefined;
  if (domains.length === 0) return '没有领域。';
  const rows = domains.map(domain => [
    text(domain.domainTitle), count(domain.domainTagCnt) || '0',
    count(domain.domainViewCount) || '0', absolute(text(domain.domainURI), context),
  ]);
  const rendered = table([
    { header: '领域' }, { header: '标签', align: 'right' }, { header: '浏览', align: 'right' }, { header: '链接' },
  ], rows, width, 0);
  return `${rendered}\n\n${pageNote(body.pagination, domains.length)}`;
}

function tagSummary(value: unknown, context: RenderContext): string | undefined {
  const tag = record(record(value)?.tag);
  if (!tag) return undefined;
  const domains = records(tag.tagDomains)?.map(domain => text(domain.domainTitle)).filter(Boolean).join('、') ?? '';
  return [
    summary([
      ['标签', text(tag.tagTitle)],
      ['链接', absolute(text(tag.tagURI), context)],
      ['引用 / 回帖', [count(tag.tagReferenceCount), count(tag.tagCommentCount)].filter(Boolean).join(' / ')],
      ['关注 / 浏览', [count(tag.tagFollowerCount), count(tag.tagViewCount)].filter(Boolean).join(' / ')],
      ['领域', domains],
    ]),
    stripHtml(tag.tagDescription) ? `\n${section('简介', stripHtml(tag.tagDescription))}` : '',
  ].join('').trim();
}

function domainSummary(value: unknown, context: RenderContext): string | undefined {
  const domain = record(record(value)?.domain);
  if (!domain) return undefined;
  const tags = records(domain.domainTags)?.map(tag => text(tag.tagTitle)).filter(Boolean).join('、') ?? '';
  const header = summary([
    ['领域', text(domain.domainTitle)],
    ['链接', absolute(text(domain.domainURI), context)],
    ['标签 / 浏览', [count(domain.domainTagCnt), count(domain.domainViewCount)].filter(Boolean).join(' / ')],
    ['包含标签', tags],
  ]);
  const description = stripHtml(domain.domainDescription);
  return description ? `${header}\n\n${section('简介', description)}` : header;
}

function unreadSummary(value: unknown): string | undefined {
  const body = record(value);
  if (!body) return undefined;
  const labels: Record<string, string> = {
    unreadNotificationCnt: '回帖', unreadCommentedNotificationCnt: '收到的评论', unreadComment2edNotificationCnt: '评论',
    unreadReplyNotificationCnt: '回复', unreadAtNotificationCnt: '提及我', unreadFollowingNotificationCnt: '关注',
    unreadPointNotificationCnt: '积分', unreadWalletNotificationCnt: '钱包', unreadBroadcastNotificationCnt: '同城广播',
    unreadSysAnnounceNotificationCnt: '系统公告', unreadNewFollowerNotificationCnt: '新关注者',
    unreadChatNotificationCnt: '聊天', unreadReviewNotificationCnt: '审核',
  };
  const entries = Object.entries(body)
    .map(([key, item]) => [labels[key] ?? key, count(item)] as const)
    .filter(([, item]) => item !== '' && item !== '0');
  const total = entries.reduce((sum, [, item]) => sum + Number(item), 0);
  if (entries.length === 0) return '没有未读消息。';
  return `${summary(entries.map(([label, item]) => [label, item] as const))}\n\n合计 ${total} 条未读`;
}

/**
 * Notifications mix a short header with a sentence of content, so they read better
 * as blocks: a table would truncate the part that matters.
 */
function noticesList(value: unknown): string | undefined {
  const body = record(value);
  if (!body) return undefined;
  const key = Object.keys(body).find(name => name.endsWith('Notifications'));
  const notices = key ? records(body[key]) : undefined;
  if (!notices) return undefined;
  if (notices.length === 0) return '没有消息。';
  const blocks = notices.map(notice => {
    const head = [
      notice.hasRead === true ? '已读' : '未读',
      text(notice.authorName) || '系统',
      oneLine(notice.title),
    ].filter(Boolean).join(' · ');
    const content = fit(oneLine(notice.content), 160);
    return content && content !== oneLine(notice.title) ? `${head}\n   ${content}` : head;
  });
  const unread = count(body.unreadNotificationCount);
  return `${blocks.join('\n')}\n\n本页 ${notices.length} 条${unread ? ` · 未读 ${unread}` : ''}`;
}

function eventsList(value: unknown, context: RenderContext): string | undefined {
  const events = records(value);
  if (!events) return undefined;
  if (events.length === 0) return '没有动态。';
  const blocks = events.map(event => {
    const head = [
      text(event.timeAgo) || stamp(event.time),
      text(event.operation) || text(event.type),
    ].filter(Boolean).join(' · ');
    const body = fit(oneLine(event.title) || oneLine(event.content), 160);
    const link = absolute(text(event.url), context);
    return [head, body ? `   ${body}` : '', link ? `   ${link}` : ''].filter(Boolean).join('\n');
  });
  return `${blocks.join('\n')}\n\n共 ${events.length} 条动态`;
}

function commentsList(value: unknown, context: RenderContext): string | undefined {
  const body = record(value);
  const comments = records(body?.comments);
  if (!body || !comments) return undefined;
  if (comments.length === 0) return '没有回帖。';
  const blocks = comments.map((comment, index) => {
    const meta = [
      text(comment.commentAuthorName) || text(record(comment.commenter)?.userName) || '匿名',
      text(comment.commentCreateTimeStr) || stamp(comment.commentCreateTime),
      text(comment.commentVisible) === '1' ? '仅作者可见' : '',
    ].filter(Boolean).join(' · ');
    const link = absolute(text(comment.commentSharpURL) || text(comment.commentURL), context);
    return [
      `${index + 1}. ${oneLine(comment.commentArticleTitle) || '(未知帖子)'}`,
      `   ${meta}`,
      link ? `   ${link}` : '',
      indent(stripHtml(comment.commentContent)),
    ].filter(Boolean).join('\n');
  });
  return `${blocks.join('\n\n')}\n\n${pageNote(body.pagination, comments.length)}`;
}

function serverTime(value: unknown): string | undefined {
  const ms = Number(value);
  if (!Number.isFinite(ms)) return undefined;
  return summary([['服务器时间', `${stamp(ms)}（本地时区）`], ['时间戳', `${ms} ms`]]);
}

const ARTICLE_WRITES: Record<string, string> = {
  'articles.post': '已发布帖子',
  'articles.edit': '已更新帖子',
  'comments.post': '已发布回帖',
  'comments.edit': '已更新回帖',
};

const NOTICE_NAMES: Record<string, string> = {
  commented: '回帖', comment2ed: '评论', reply: '回复', at: '提及', following: '关注',
};

function writeResult(command: string, value: unknown, context: RenderContext): string | undefined {
  if (command === 'skill.install') {
    const body = record(value) ?? {};
    const files = Array.isArray(body.files) ? body.files.map(item => text(item)).filter(Boolean).join('、') : '';
    return [
      '技能已安装或更新',
      text(body.destination) ? `位置  ${text(body.destination)}` : '',
      files ? `文件  ${files}` : '',
    ].filter(Boolean).join('\n');
  }
  if (command.startsWith('notices.read.')) {
    const type = command.slice('notices.read.'.length);
    return `已将${NOTICE_NAMES[type] ?? type}消息标记为已读`;
  }
  const label = ARTICLE_WRITES[command];
  if (!label) return undefined;
  const body = record(value);
  const article = record(body?.article) ?? body;
  const url = article ? articleUrl(article, context) : '';
  return url ? `${label}\n链接  ${url}` : label;
}

const RENDERERS: Record<string, (value: unknown, context: RenderContext, width: number) => string | undefined> = {
  'articles.list': (value, context) => articlesList(value, context),
  'articles.get': (value, context) => articleDetail(value, context),
  'articles.source': (value, context) => articleSource(value, context),
  'domains.list': (value, context, width) => domainsList(value, context, width),
  'domains.get': (value, context) => domainSummary(value, context),
  'tags.list': (value, context, width) => tagsList(value, context, width),
  'tags.get': (value, context) => tagSummary(value, context),
  'users.me': (value, context) => userSummary(value, context),
  'users.get': (value, context) => userSummary(value, context),
  'users.articles': (value, context) => articlesList(value, context),
  'users.watches': (value, context) => articlesList(value, context),
  'users.stars': (value, context) => articlesList(value, context),
  'users.comments': (value, context) => commentsList(value, context),
  'users.events': (value, context) => eventsList(value, context),
  'users.follows': (value, context, width) => usersList(value, context, width),
  'users.followers': (value, context, width) => usersList(value, context, width),
  'users.tags': (value, context, width) => tagsList(value, context, width),
  'notices.unread': value => unreadSummary(value),  'tops.newbies': (value, context, width) => usersList(value, context, width),
  'tops.followers': (value, context, width) => usersList(value, context, width),
  'system.time': value => serverTime(value),
};

/** Every `notices.<type>` list shares one shape, so it does not need an entry each. */
function noticeRenderer(command: string): typeof RENDERERS[string] | undefined {
  if (!command.startsWith('notices.') || command === 'notices.unread' || command.startsWith('notices.read.')) return undefined;
  return (value: unknown) => noticesList(value);
}

/** The envelope carries the whole upstream body; `data` is the part worth showing. */
function payload(value: unknown): unknown {
  const wrapper = record(value);
  return wrapper && 'code' in wrapper ? wrapper.data : value;
}

/**
 * Render one successful payload for a terminal. Commands without a renderer, and
 * payloads whose shape changed upstream, fall back to the raw `data` as JSON so
 * nothing is lost.
 */
export function render(command: string | undefined, value: unknown, context: RenderContext = {}): string {
  const width = Math.max(40, Math.min(context.width ?? DEFAULT_WIDTH, 160));
  const inner = payload(value);
  const renderer = command ? (RENDERERS[command] ?? noticeRenderer(command)) : undefined;
  const rendered = renderer?.(inner, context, width);
  if (rendered !== undefined) return rendered;
  if (command) {
    const written = writeResult(command, inner, context);
    if (written !== undefined) return written;
  }
  return typeof inner === 'string' ? inner : JSON.stringify(inner ?? null, null, 2);
}
