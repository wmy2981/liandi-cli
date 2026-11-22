import { describe, expect, it } from 'vitest';
import { render } from '../src/render.js';

const context = { width: 100, baseUrl: 'https://ld246.com' };

/** Live payload wrapper: every response carries code/msg/random around `data`. */
const wrap = (data: unknown) => ({ code: 0, msg: '', random: 'r', data });

const article = {
  oId: '1795318034189',
  articleTitle: '为什么复制后光标会跑到行首？',
  articleAuthorName: 'inessence',
  articleCreateTimeStr: '2026-11-22 11:27:13',
  articleCommentCount: 6,
  articleViewCount: 10,
  articleGoodCnt: 0,
  articleCollectCnt: 0,
  articleTags: '思源笔记',
  articlePermalink: 'https://ld246.com/article/1795318034189',
  articleContent: '正文第一段',
};

const user = { userName: 'yoss', userNickname: 'Yoss', userNo: 44114, userArticleCount: 6, userCommentCount: 167, userPoint: 2270, userGeneralRank: 762 };

describe('article lists', () => {
  it('shows title, author, time and permalink for each article', () => {
    const text = render('articles.list', wrap({ pagination: { paginationPageCount: 2991 }, articles: [article, { ...article, oId: '2', articleTitle: '第二篇', articlePermalink: '' }] }), context);
    expect(text).toContain(' 1. 为什么复制后光标会跑到行首？');
    expect(text).toContain('inessence · 2026-11-22 11:27:13 · 6 回帖 · 10 浏览');
    expect(text).toContain('https://ld246.com/article/1795318034189');
    // A payload without a permalink still gets a usable link.
    expect(text).toContain('https://ld246.com/article/2');
    expect(text).toContain('本页 2 条 · 共 2991 页');
  });
  it('renders the same block for user article feeds', () => {
    const text = render('users.stars', wrap({ pagination: { paginationPageCount: 3 }, articles: [article] }), context);
    expect(text).toContain('为什么复制后光标会跑到行首？');
    expect(text).toContain('本页 1 条');
  });
  it('says so instead of printing an empty table', () => {
    expect(render('articles.list', wrap({ pagination: { paginationPageCount: 1 }, articles: [] }), context)).toBe('没有帖子。');
  });
});

describe('article detail', () => {
  const comments = [
    { oId: 'c1', commentAuthorName: 'inessence', commentCreateTimeStr: '2026-11-22 11:29:12', commentContent: '<p>场景是该行已有文字内容时</p>', commentVisible: 0 },
    { oId: 'c2', commentAuthorName: 'EmptyLight', commentCreateTimeStr: '2026-11-22 11:33:59', commentContent: '<p>录屏看看操作</p>', commentVisible: 1 },
  ];

  it('summarizes the header, body and comments', () => {
    const text = render('articles.get', wrap({ pagination: { paginationPageCount: 1 }, article: { ...article, articleComments: comments } }), context);
    expect(text).toContain('标题  为什么复制后光标会跑到行首？');
    expect(text).toContain('作者  inessence');
    expect(text).toContain('标签  思源笔记');
    expect(text).toContain('互动  6 回帖 · 10 浏览');
    expect(text).toContain('正文\n────');
    expect(text).toContain('正文第一段');
    expect(text).toContain('回帖（本页 2 条 · 共 6 条）');
    expect(text).toContain('1. inessence · 2026-11-22 11:29:12');
    expect(text).toContain('场景是该行已有文字内容时');
  });
  it('marks author-only comments and strips their HTML', () => {
    const text = render('articles.get', wrap({ pagination: { paginationPageCount: 1 }, article: { ...article, articleComments: comments } }), context);
    expect(text).toContain('2. EmptyLight · 2026-11-22 11:33:59 · （仅作者可见）');
    expect(text).not.toContain('<p>');
  });
  it('describes an article prepared for editing', () => {
    const text = render('articles.source', wrap({ article: { ...article, articleType: 0, articleContentType: null, articleRewardPoint: 5 } }), context);
    expect(text).toContain('内容类型  未知（提交时请显式传 --content-type）');
    expect(text).toContain('5 积分');
    expect(text).toContain('正文（原样，可直接用于 article edit）');
  });
});

describe('users, tags and domains', () => {
  it('prints a field summary for one user', () => {
    const text = render('users.me', wrap({ user }), context);
    expect(text).toContain('用户名');
    expect(text).toContain('yoss');
    expect(text).toContain('文章 / 回帖  6 / 167');
    expect(text).toContain('2270 / 762');
    expect(text).toContain('https://ld246.com/member/yoss');
  });
  it('aligns user lists in a table with the member link', () => {
    const text = render('users.followers', wrap({ pagination: { paginationPageCount: 151 }, users: [user, { ...user, userName: 'donalddu', userNickname: '', userArticleCount: 0 }] }), context);
    const [header, separator, first] = text.split('\n');
    expect(header).toContain('用户名');
    expect(header).toContain('主页');
    expect(separator).toContain('─');
    expect(first).toContain('yoss');
    expect(first).toContain('https://ld246.com/member/yoss');
    expect(text).toContain('本页 2 条 · 共 151 页');
    expect(text).toContain('donalddu');
  });
  it('tabulates tags with their reference counts and links', () => {
    const text = render('tags.list', wrap({ pagination: { paginationPageCount: 449 }, tags: [{ tagTitle: 'Java', tagReferenceCount: 3208, tagCommentCount: 8217, tagFollowerCount: 1, tagURI: 'https://ld246.com/tag/java' }] }), context);
    expect(text).toContain('引用');
    expect(text).toContain('3208');
    expect(text).toContain('https://ld246.com/tag/java');
  });
  it('shrinks the flexible column but never loses the row', () => {
    const wide = render('tags.list', wrap({ tags: [{ tagTitle: '一个非常长的标签名字用于测试截断', tagReferenceCount: 1 }] }), { width: 120, baseUrl: 'https://ld246.com' });
    const narrow = render('tags.list', wrap({ tags: [{ tagTitle: '一个非常长的标签名字用于测试截断', tagReferenceCount: 1 }] }), { width: 40, baseUrl: 'https://ld246.com' });
    expect(wide).toContain('一个非常长的标签名字用于测试截断');
    expect(narrow).toContain('…');
    expect(narrow).toContain('1');
  });
  it('summarizes a tag and a domain, stripping the HTML description', () => {
    const tag = render('tags.get', wrap({ tag: { tagTitle: 'Java', tagURI: 'https://ld246.com/tag/java', tagReferenceCount: 3208, tagDescription: '<p>Java 是一种语言</p>', tagDomains: [{ domainTitle: '后端' }] } }), context);
    expect(tag).toContain('后端');
    expect(tag).toContain('Java 是一种语言');
    expect(tag).not.toContain('<p>');
    const domain = render('domains.get', wrap({ domain: { domainTitle: 'Java', domainURI: 'https://ld246.com/domain/java', domainTagCnt: 10, domainViewCount: 6474, domainDescription: '<p>"Write once, run anywhere."</p>', domainTags: [{ domainTitle: '后端' }] } }), context);
    expect(domain).toContain('领域         Java');
    expect(domain).toContain('标签 / 浏览  10 / 6474');
    expect(domain).toContain('"Write once, run anywhere."');
  });
});

describe('notifications, events and time', () => {
  it('renders notification blocks with read state and unread count', () => {
    const text = render('notices.commented', wrap({
      pagination: { paginationPageCount: 1 },
      unreadNotificationCount: 2,
      commentedNotifications: [
        { authorName: 'AchatesRay', hasRead: true, title: '“开源” API Key', content: '<a href="#">AchatesRay</a> 回复了你的帖子' },
        { authorName: 'kongyue', hasRead: false, title: '“开源” API Key', content: '查询成功' },
      ],
    }), context);
    expect(text).toContain('已读 · AchatesRay · “开源” API Key');
    expect(text).toContain('未读 · kongyue');
    expect(text).toContain('本页 2 条 · 未读 2');
    expect(text).not.toContain('<a href');
  });
  it('lists activity as blocks with links', () => {
    const text = render('users.events', wrap([{ timeAgo: '14 小时前', operation: '感谢了清风明月', content: '千禧如刷题', url: 'https://ld246.com/member/Imu' }]), context);
    expect(text).toContain('14 小时前 · 感谢了清风明月');
    expect(text).toContain('   千禧如刷题');
    expect(text).toContain('https://ld246.com/member/Imu');
    expect(text).toContain('共 1 条动态');
  });
  it('shows only the unread counters that are not zero', () => {
    const text = render('notices.unread', wrap({ unreadNotificationCnt: 3, unreadAtNotificationCnt: 0, unreadReplyNotificationCnt: 1 }), context);
    expect(text).toContain('回帖');
    expect(text).toContain('3');
    expect(text).toContain('回复');
    expect(text).not.toContain('提及我');
    expect(text).toContain('合计 4 条未读');
    expect(render('notices.unread', wrap({ unreadNotificationCnt: 0 }), context)).toBe('没有未读消息。');
  });
  it('formats the server timestamp in local time', () => {
    const text = render('system.time', wrap(1795322987467), context);
    expect(text).toContain('服务器时间');
    expect(text).toContain('时间戳      1795322987467 ms');
    expect(text).toMatch(/服务器时间\s+\d{4}-\d{2}-\d{2} \d{2}:\d{2}（本地时区）/u);
  });
});

describe('write confirmations and fallbacks', () => {
  it('names the write instead of dumping {code:0}', () => {
    expect(render('comments.post', wrap({ code: 0 }), context)).toBe('已发布回帖');
    expect(render('notices.read.at', wrap(null), context)).toBe('已将提及消息标记为已读');
    expect(render('skill.install', { destination: 'C:\\skills\\liandi', files: ['SKILL.md'] }, context)).toContain('位置  C:\\skills\\liandi');
  });
  it('links the article when the write returns one', () => {
    const text = render('articles.post', wrap({ article: { ...article } }), context);
    expect(text).toContain('已发布帖子');
    expect(text).toContain('https://ld246.com/article/1795318034189');
  });
  it('falls back to the raw data when a shape is unknown', () => {
    expect(render('articles.list', wrap({ unexpected: true }), context)).toBe('{\n  "unexpected": true\n}');
    expect(render(undefined, wrap({ a: 1 }), context)).toBe('{\n  "a": 1\n}');
    expect(render('system.time', wrap('plain text'), context)).toBe('plain text');
  });
  it('never throws on missing data', () => {
    for (const command of ['articles.list', 'articles.get', 'users.me', 'tags.get', 'notices.at', 'users.events', 'users.followers']) {
      expect(() => render(command, undefined, context)).not.toThrow();
      expect(() => render(command, wrap(null), context)).not.toThrow();
    }
  });
});
