/**
 * Human-readable rendering for the read commands.
 *
 * JSON stays the machine contract (`-j` / `--format json`); this module only decides
 * how the same payload looks in a terminal. Field names come from live ld246
 * responses. A renderer returns `undefined` when the payload does not look like what
 * it expects, so an upstream change degrades to plain JSON instead of printing a
 * half-empty table.
 */

import { DEFAULT_LOCALE, messages, type Locale } from './i18n.js';

export interface RenderContext {
  /** Usable columns for tables. */
  width?: number;
  /** Server the request went to; used for links the API returns as paths. */
  baseUrl?: string;
  /** Display language for human-readable labels. */
  locale?: Locale;
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

function pageNote(pagination: unknown, shown: number, context: RenderContext): string {
  const pages = count(record(pagination)?.paginationPageCount);
  return messages(context.locale).render.pageNote(shown, pages);
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
  const t = messages(context.locale).render;
  if (articles.length === 0) return t.emptyArticles;
  const blocks = articles.map((article, index) => {
    const title = text(article.articleTitle) || t.untitled;
    const meta = [
      text(article.articleAuthorName) || t.anonymous,
      text(article.articleCreateTimeStr) || stamp(article.articleCreateTime),
      count(article.articleCommentCount) ? t.repliesCount(count(article.articleCommentCount)) : '',
      count(article.articleViewCount) ? t.viewsCount(count(article.articleViewCount)) : '',
    ].filter(Boolean).join(' · ');
    return [`${String(index + 1).padStart(2, ' ')}. ${title}`, `    ${meta}`, `    ${articleUrl(article, context)}`].join('\n');
  });
  return `${blocks.join('\n')}\n\n${pageNote(body.pagination, articles.length, context)}`;
}

function commentsSection(comments: Row[], context: RenderContext): string {
  const t = messages(context.locale).render;
  return comments.map((comment, index) => {
    const head = [
      text(comment.commentAuthorName) || text(record(comment.commenter)?.userName) || t.anonymous,
      text(comment.commentCreateTimeStr) || stamp(comment.commentCreateTime),
      text(comment.commentVisible) === '1' || comment.commentVisible === true ? t.authorOnlyBadge : '',
      count(comment.commentReplyCnt) && count(comment.commentReplyCnt) !== '0' ? t.commentRepliesCount(count(comment.commentReplyCnt)) : '',
    ].filter(Boolean).join(' · ');
    const body = stripHtml(comment.commentContent) || t.emptyBody;
    return `${index + 1}. ${head}\n${indent(body)}`;
  }).join('\n\n');
}

function articleDetail(value: unknown, context: RenderContext): string | undefined {
  const body = record(value);
  const article = record(body?.article);
  if (!article) return undefined;
  const t = messages(context.locale).render;
  const header = summary([
    [t.fields.title, text(article.articleTitle) || t.untitled],
    [t.fields.author, text(article.articleAuthorName)],
    [t.fields.time, [text(article.articleCreateTimeStr) || stamp(article.articleCreateTime), text(article.timeAgo)].filter(Boolean).join(' · ')],
    [t.fields.tags, text(article.articleTags)],
    [t.fields.activity, [
      count(article.articleCommentCount) ? t.repliesCount(count(article.articleCommentCount)) : '',
      count(article.articleViewCount) ? t.viewsCount(count(article.articleViewCount)) : '',
      count(article.articleGoodCnt) ? t.likesCount(count(article.articleGoodCnt)) : '',
      count(article.articleCollectCnt) ? t.starsCount(count(article.articleCollectCnt)) : '',
    ].filter(Boolean).join(' · ')],
    [t.fields.link, articleUrl(article, context)],
  ]);
  const content = text(article.articleContent) || t.noContent;
  const comments = records(article.articleComments) ?? [];
  const parts = [header, section(t.sections.body, content)];
  if (comments.length > 0) parts.push(section(t.sections.comments(comments.length, count(article.articleCommentCount) || String(comments.length)), commentsSection(comments, context)));
  parts.push(pageNote(body?.pagination, comments.length, context));
  return parts.join('\n\n');
}

function articleSource(value: unknown, context: RenderContext): string | undefined {
  const article = record(record(value)?.article);
  if (!article) return undefined;
  const t = messages(context.locale).render;
  const header = summary([
    [t.fields.title, text(article.articleTitle) || t.untitled],
    [t.fields.type, text(article.articleType)],
    [t.fields.tags, text(article.articleTags)],
    [t.fields.contentType, text(article.articleContentType) || t.unknownContentType],
    [t.fields.reward, t.rewardPoints(count(article.articleRewardPoint) || '0')],
    [t.fields.link, articleUrl(article, context)],
  ]);
  return `${header}\n\n${section(t.sections.sourceBody, text(article.articleContent) || t.noContent)}`;
}

function userSummary(value: unknown, context: RenderContext): string | undefined {
  const user = record(record(value)?.user);
  if (!user) return undefined;
  const t = messages(context.locale).render;
  return summary([
    [t.fields.username, text(user.userName)],
    [t.fields.nickname, text(user.userNickname)],
    [t.fields.userNo, text(user.userNo)],
    [t.fields.bio, oneLine(user.userIntro)],
    [t.fields.tags, text(user.userTags)],
    [t.fields.articlesComments, [count(user.userArticleCount), count(user.userCommentCount)].filter(Boolean).join(' / ')],
    [t.fields.pointsRank, [count(user.userPoint), count(user.userGeneralRank)].filter(Boolean).join(' / ')],
    [t.fields.checkinStreak, count(user.userCurrentCheckinStreak) ? t.checkinStreakValue(count(user.userCurrentCheckinStreak), count(user.userLongestCheckinStreak) || '?') : ''],
    [t.fields.profile, userUrl(user, context)],
  ]);
}

function usersTable(users: Row[], context: RenderContext, width: number): string {
  const cols = messages(context.locale).render.userColumns;
  const columns: readonly Column[] = [
    { header: cols.username }, { header: cols.nickname }, { header: cols.articles, align: 'right' },
    { header: cols.comments, align: 'right' }, { header: cols.points, align: 'right' }, { header: cols.profile },
  ];
  const rows = users.map(user => [
    text(user.userName), text(user.userNickname) || '-', count(user.userArticleCount) || '0',
    count(user.userCommentCount) || '0', count(user.userPoint) || '0', userUrl(user, context),
  ]);
  return table(columns, rows, width, 1);
}

function usersList(value: unknown, context: RenderContext, width: number): string | undefined {
  const body = record(value);
  const users = records(body?.users);
  if (!body || !users) return undefined;
  const t = messages(context.locale).render;
  if (users.length === 0) return t.emptyUsers;
  const note = body.pagination ? pageNote(body.pagination, users.length, context) : t.usersTotal(users.length);
  return `${usersTable(users, context, width)}\n\n${note}`;
}

function tagsList(value: unknown, context: RenderContext, width: number): string | undefined {
  const body = record(value);
  const tags = records(body?.tags);
  if (!body || !tags) return undefined;
  const t = messages(context.locale).render;
  if (tags.length === 0) return t.emptyTags;
  const rows = tags.map(tag => [
    text(tag.tagTitle), count(tag.tagReferenceCount) || '0', count(tag.tagCommentCount) || '0',
    count(tag.tagFollowerCount) || '0', absolute(text(tag.tagURI), context),
  ]);
  const cols = t.tagColumns;
  const rendered = table([
    { header: cols.tag }, { header: cols.refs, align: 'right' }, { header: cols.comments, align: 'right' },
    { header: cols.followers, align: 'right' }, { header: cols.link },
  ], rows, width, 0);
  return `${rendered}\n\n${pageNote(body.pagination, tags.length, context)}`;
}

function domainsList(value: unknown, context: RenderContext, width: number): string | undefined {
  const body = record(value);
  const domains = records(body?.domains);
  if (!body || !domains) return undefined;
  const t = messages(context.locale).render;
  if (domains.length === 0) return t.emptyDomains;
  const rows = domains.map(domain => [
    text(domain.domainTitle), count(domain.domainTagCnt) || '0',
    count(domain.domainViewCount) || '0', absolute(text(domain.domainURI), context),
  ]);
  const cols = t.domainColumns;
  const rendered = table([
    { header: cols.domain }, { header: cols.tags, align: 'right' }, { header: cols.views, align: 'right' }, { header: cols.link },
  ], rows, width, 0);
  return `${rendered}\n\n${pageNote(body.pagination, domains.length, context)}`;
}

function tagSummary(value: unknown, context: RenderContext): string | undefined {
  const tag = record(record(value)?.tag);
  if (!tag) return undefined;
  const t = messages(context.locale).render;
  const domains = records(tag.tagDomains)?.map(domain => text(domain.domainTitle)).filter(Boolean).join(t.listSeparator) ?? '';
  return [
    summary([
      [t.fields.tag, text(tag.tagTitle)],
      [t.fields.link, absolute(text(tag.tagURI), context)],
      [t.fields.refsComments, [count(tag.tagReferenceCount), count(tag.tagCommentCount)].filter(Boolean).join(' / ')],
      [t.fields.followersViews, [count(tag.tagFollowerCount), count(tag.tagViewCount)].filter(Boolean).join(' / ')],
      [t.fields.domains, domains],
    ]),
    stripHtml(tag.tagDescription) ? `\n${section(t.sections.description, stripHtml(tag.tagDescription))}` : '',
  ].join('').trim();
}

function domainSummary(value: unknown, context: RenderContext): string | undefined {
  const domain = record(record(value)?.domain);
  if (!domain) return undefined;
  const t = messages(context.locale).render;
  const tags = records(domain.domainTags)?.map(tag => text(tag.tagTitle)).filter(Boolean).join(t.listSeparator) ?? '';
  const header = summary([
    [t.fields.domain, text(domain.domainTitle)],
    [t.fields.link, absolute(text(domain.domainURI), context)],
    [t.fields.tagsViews, [count(domain.domainTagCnt), count(domain.domainViewCount)].filter(Boolean).join(' / ')],
    [t.fields.includedTags, tags],
  ]);
  const description = stripHtml(domain.domainDescription);
  return description ? `${header}\n\n${section(t.sections.description, description)}` : header;
}

function unreadSummary(value: unknown, context: RenderContext): string | undefined {
  const body = record(value);
  if (!body) return undefined;
  const t = messages(context.locale).render;
  const entries = Object.entries(body)
    .map(([key, item]) => [t.unreadLabels[key] ?? key, count(item)] as const)
    .filter(([, item]) => item !== '' && item !== '0');
  const total = entries.reduce((sum, [, item]) => sum + Number(item), 0);
  if (entries.length === 0) return t.emptyUnread;
  return `${summary(entries.map(([label, item]) => [label, item] as const))}\n\n${t.unreadTotal(total)}`;
}

/**
 * Notifications mix a short header with a sentence of content, so they read better
 * as blocks: a table would truncate the part that matters.
 */
function noticesList(value: unknown, context: RenderContext): string | undefined {
  const body = record(value);
  if (!body) return undefined;
  const key = Object.keys(body).find(name => name.endsWith('Notifications'));
  const notices = key ? records(body[key]) : undefined;
  if (!notices) return undefined;
  const t = messages(context.locale).render;
  if (notices.length === 0) return t.emptyNotices;
  const blocks = notices.map(notice => {
    const head = [
      notice.hasRead === true ? t.noticeRead : t.noticeUnread,
      text(notice.authorName) || t.systemAuthor,
      oneLine(notice.title),
    ].filter(Boolean).join(' · ');
    const content = fit(oneLine(notice.content), 160);
    return content && content !== oneLine(notice.title) ? `${head}\n   ${content}` : head;
  });
  const unread = count(body.unreadNotificationCount);
  return `${blocks.join('\n')}\n\n${t.noticesFooter(notices.length, unread)}`;
}

function eventsList(value: unknown, context: RenderContext): string | undefined {
  const events = records(value);
  if (!events) return undefined;
  const t = messages(context.locale).render;
  if (events.length === 0) return t.emptyEvents;
  const blocks = events.map(event => {
    const head = [
      text(event.timeAgo) || stamp(event.time),
      text(event.operation) || text(event.type),
    ].filter(Boolean).join(' · ');
    const body = fit(oneLine(event.title) || oneLine(event.content), 160);
    const link = absolute(text(event.url), context);
    return [head, body ? `   ${body}` : '', link ? `   ${link}` : ''].filter(Boolean).join('\n');
  });
  return `${blocks.join('\n')}\n\n${t.eventsTotal(events.length)}`;
}

function commentsList(value: unknown, context: RenderContext): string | undefined {
  const body = record(value);
  const comments = records(body?.comments);
  if (!body || !comments) return undefined;
  const t = messages(context.locale).render;
  if (comments.length === 0) return t.emptyComments;
  const blocks = comments.map((comment, index) => {
    const meta = [
      text(comment.commentAuthorName) || text(record(comment.commenter)?.userName) || t.anonymous,
      text(comment.commentCreateTimeStr) || stamp(comment.commentCreateTime),
      text(comment.commentVisible) === '1' ? t.authorOnlyInline : '',
    ].filter(Boolean).join(' · ');
    const link = absolute(text(comment.commentSharpURL) || text(comment.commentURL), context);
    return [
      `${index + 1}. ${oneLine(comment.commentArticleTitle) || t.unknownArticle}`,
      `   ${meta}`,
      link ? `   ${link}` : '',
      indent(stripHtml(comment.commentContent)),
    ].filter(Boolean).join('\n');
  });
  return `${blocks.join('\n\n')}\n\n${pageNote(body.pagination, comments.length, context)}`;
}

function serverTime(value: unknown, context: RenderContext): string | undefined {
  const ms = Number(value);
  if (!Number.isFinite(ms)) return undefined;
  const t = messages(context.locale).render;
  return summary([[t.fields.serverTime, t.serverTimeLocal(stamp(ms))], [t.fields.timestamp, `${ms} ms`]]);
}

function writeResult(command: string, value: unknown, context: RenderContext): string | undefined {
  const t = messages(context.locale).render;
  if (command === 'skill.install') {
    const body = record(value) ?? {};
    const files = Array.isArray(body.files) ? body.files.map(item => text(item)).filter(Boolean).join(t.listSeparator) : '';
    const details = summary([
      [t.fields.location, text(body.destination)],
      [t.fields.files, files],
    ]);
    return details ? `${t.skillInstalled}\n${details}` : t.skillInstalled;
  }
  if (command.startsWith('notices.read.')) {
    const type = command.slice('notices.read.'.length);
    return t.markedRead(t.noticeNames[type] ?? type);
  }
  const label = t.writes[command as keyof typeof t.writes];
  if (!label) return undefined;
  const body = record(value);
  const article = record(body?.article) ?? body;
  const url = article ? articleUrl(article, context) : '';
  return url ? `${label}\n${t.fields.link}  ${url}` : label;
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
  'notices.unread': (value, context) => unreadSummary(value, context),
  'tops.newbies': (value, context, width) => usersList(value, context, width),
  'tops.followers': (value, context, width) => usersList(value, context, width),
  'system.time': (value, context) => serverTime(value, context),
};

/** Every `notices.<type>` list shares one shape, so it does not need an entry each. */
function noticeRenderer(command: string): typeof RENDERERS[string] | undefined {
  if (!command.startsWith('notices.') || command === 'notices.unread' || command.startsWith('notices.read.')) return undefined;
  return (value: unknown, context: RenderContext) => noticesList(value, context);
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
  const resolved: RenderContext = { ...context, locale: context.locale ?? DEFAULT_LOCALE };
  const width = Math.max(40, Math.min(resolved.width ?? DEFAULT_WIDTH, 160));
  const inner = payload(value);
  const renderer = command ? (RENDERERS[command] ?? noticeRenderer(command)) : undefined;
  const rendered = renderer?.(inner, resolved, width);
  if (rendered !== undefined) return rendered;
  if (command) {
    const written = writeResult(command, inner, resolved);
    if (written !== undefined) return written;
  }
  return typeof inner === 'string' ? inner : JSON.stringify(inner ?? null, null, 2);
}
