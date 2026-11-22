/**
 * Internationalization for CLI terminal output (help, human renderers, status
 * lines, prompts, and human-mode errors).
 *
 * JSON output (`--format json` / `-j`) stays locale-independent so scripts and
 * agents can rely on a single stable machine contract.
 */

export type Locale = 'en' | 'zh-CN' | 'zh-TW';

export const SUPPORTED_LOCALES: readonly Locale[] = ['en', 'zh-CN', 'zh-TW'];
export const DEFAULT_LOCALE: Locale = 'en';

/**
 * Normalize a BCP-47 or POSIX language tag to a supported locale.
 * Returns `undefined` when the tag is not one of en / zh-CN / zh-TW.
 */
export function normalizeLocaleTag(raw: string | undefined): Locale | undefined {
  if (!raw) return undefined;
  const cleaned = raw.trim().replace(/[.@].*$/u, '').replaceAll('_', '-').toLowerCase();
  if (!cleaned) return undefined;
  if (cleaned === 'en' || cleaned.startsWith('en-')) return 'en';
  if (cleaned === 'zh') return 'zh-CN';
  if (cleaned.startsWith('zh-')) {
    const parts = cleaned.split('-');
    if (parts.some(part => part === 'hant' || part === 'tw' || part === 'hk' || part === 'mo')) {
      return 'zh-TW';
    }
    if (parts.some(part => part === 'hans' || part === 'cn' || part === 'sg')) {
      return 'zh-CN';
    }
    return 'zh-CN';
  }
  return undefined;
}

function detectSystemLocale(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return '';
  }
}

/**
 * Resolve display locale in priority order:
 *   --lang > LIANDI_LANG > LC_ALL > LC_MESSAGES > LANG > system locale > en
 */
export function resolveLocale(
  flag?: string,
  env: NodeJS.ProcessEnv = process.env,
  systemLocale?: string,
): Locale {
  if (flag !== undefined) {
    const parsed = normalizeLocaleTag(flag);
    if (parsed) return parsed;
  }
  if (env.LIANDI_LANG?.trim()) {
    const parsed = normalizeLocaleTag(env.LIANDI_LANG);
    if (parsed) return parsed;
  }
  for (const raw of [env.LC_ALL, env.LC_MESSAGES, env.LANG]) {
    if (!raw?.trim()) continue;
    const base = raw.trim().replace(/[.@].*$/u, '');
    if (/^(?:c|posix)$/iu.test(base)) return 'en';
    return normalizeLocaleTag(base) ?? DEFAULT_LOCALE;
  }
  return normalizeLocaleTag(systemLocale ?? detectSystemLocale()) ?? DEFAULT_LOCALE;
}

export interface Messages {
  help: {
    description: string;
    showVersion: string;
    showHelp: string;
    helpCommand: string;
    headings: Record<'Usage:' | 'Arguments:' | 'Options:' | 'Commands:', string>;
    defaultValue: (value: string) => string;
    globalFooter: string;
    commands: {
      article: string;
      articleList: string;
      articleGet: string;
      articlePost: string;
      articleSource: string;
      articleEdit: string;
      comment: string;
      commentPost: string;
      commentEdit: string;
      domain: string;
      domainList: string;
      domainGet: string;
      tag: string;
      tagList: string;
      tagGet: string;
      user: string;
      userMe: string;
      userGet: string;
      userArticles: string;
      userComments: string;
      userWatches: string;
      userFollows: string;
      userTags: string;
      userStars: string;
      userFollowers: string;
      userEvents: string;
      notice: string;
      noticeUnread: string;
      noticeType: (type: string) => string;
      noticeRead: string;
      top: string;
      topNewbies: string;
      topFollowers: string;
      time: string;
      skill: string;
      skillInstall: string;
    };
    options: {
      title: string;
      tags: string;
      articleContent: string;
      commentContent: string;
      contentFile: string;
      contentType: string;
      rewardContent: string;
      rewardPoint: string;
      sort: string;
      page: string;
      commentPage: string;
      tag: string;
      domain: string;
      articleType: string;
      replyTo: string;
      visible: string;
      userNumber: string;
      eventSize: string;
    };
  };
  output: {
    error: (code: string, message: string) => string;
    dryRun: string;
    cancelled: string;
    confirmOperation: string;
    confirmSkill: string;
  };
  render: {
    listSeparator: string;
    pageNote: (shown: number, pages: string) => string;
    emptyArticles: string;
    untitled: string;
    anonymous: string;
    repliesCount: (count: string) => string;
    viewsCount: (count: string) => string;
    likesCount: (count: string) => string;
    starsCount: (count: string) => string;
    authorOnlyBadge: string;
    authorOnlyInline: string;
    commentRepliesCount: (count: string) => string;
    emptyBody: string;
    noContent: string;
    unknownArticle: string;
    fields: {
      title: string;
      author: string;
      time: string;
      tags: string;
      activity: string;
      link: string;
      type: string;
      contentType: string;
      reward: string;
      username: string;
      nickname: string;
      userNo: string;
      bio: string;
      articlesComments: string;
      pointsRank: string;
      checkinStreak: string;
      profile: string;
      tag: string;
      refsComments: string;
      followersViews: string;
      domains: string;
      domain: string;
      tagsViews: string;
      includedTags: string;
      serverTime: string;
      timestamp: string;
      location: string;
      files: string;
    };
    sections: {
      body: string;
      comments: (shown: number, total: string) => string;
      sourceBody: string;
      description: string;
    };
    unknownContentType: string;
    rewardPoints: (points: string) => string;
    checkinStreakValue: (current: string, longest: string) => string;
    userColumns: {
      username: string;
      nickname: string;
      articles: string;
      comments: string;
      points: string;
      profile: string;
    };
    emptyUsers: string;
    usersTotal: (count: number) => string;
    tagColumns: {
      tag: string;
      refs: string;
      comments: string;
      followers: string;
      link: string;
    };
    emptyTags: string;
    domainColumns: {
      domain: string;
      tags: string;
      views: string;
      link: string;
    };
    emptyDomains: string;
    unreadLabels: Record<string, string>;
    emptyUnread: string;
    unreadTotal: (total: number) => string;
    emptyNotices: string;
    noticeRead: string;
    noticeUnread: string;
    systemAuthor: string;
    noticesFooter: (shown: number, unread: string) => string;
    emptyEvents: string;
    eventsTotal: (count: number) => string;
    emptyComments: string;
    serverTimeLocal: (formatted: string) => string;
    writes: {
      'articles.post': string;
      'articles.edit': string;
      'comments.post': string;
      'comments.edit': string;
    };
    noticeNames: Record<string, string>;
    markedRead: (name: string) => string;
    skillInstalled: string;
  };
}

const plural = (count: string, singular: string, pluralForm: string): string =>
  `${count} ${count === '1' ? singular : pluralForm}`;

const EN: Messages = {
  help: {
    description: 'Human and agent friendly CLI for the ld246.com community API',
    showVersion: 'Show version',
    showHelp: 'Show help',
    helpCommand: 'Display help for command',
    headings: {
      'Usage:': 'Usage:',
      'Arguments:': 'Arguments:',
      'Options:': 'Options:',
      'Commands:': 'Commands:',
    },
    defaultValue: value => `(default: ${value})`,
    globalFooter: `
Global options (can appear before or after commands):
  -t, --token <token>       API token (highest-priority source)
  -b, --base-url <url>      API server (default: https://ld246.com)
  --format <format>         Output format: human (default) or json
  -j, --json                Shorthand for --format json
  --lang <locale>           Display language: en, zh-CN or zh-TW
  -d, --dry-run             Preview a write; never send it
  -y, --yes                 Execute a write without interactive confirmation
  --color <when>            Colorize status lines and hints: auto, always, never
  --no-color                Never colorize (same as --color never)
  -v, --version             Show version
  -h, --help                Show help

Reads never use --dry-run/--yes. Writes always show a preview before confirmation.
--format human renders tables and summaries; --format json is the stable envelope for scripts.
Language: --lang > LIANDI_LANG > LC_ALL/LC_MESSAGES/LANG > system locale (JSON output is unchanged).
Authentication: --token > LIANDI_TOKEN > ./.env > ~/.config/liandi/.env
Run "liandi <group> --help" for subcommands.`,
    commands: {
      article: 'Read, post and edit articles',
      articleList: 'List articles',
      articleGet: 'Article with paginated comments',
      articlePost: 'Publish an article (write)',
      articleSource: 'Get an article for updating',
      articleEdit: 'Update an article (write)',
      comment: 'Post and edit comments',
      commentPost: 'Comment on an article (write)',
      commentEdit: 'Update your comment (write)',
      domain: 'List and inspect domains',
      domainList: 'List domains',
      domainGet: 'One domain',
      tag: 'List and inspect tags',
      tagList: 'List tags',
      tagGet: 'One tag',
      user: 'Profiles, activity and social lists',
      userMe: 'Current authenticated user',
      userGet: 'Profile by username, or by user number with --number',
      userArticles: 'Articles by a user',
      userComments: 'Comments by a user',
      userWatches: 'Articles watched by a user',
      userFollows: 'Users followed by a user',
      userTags: 'Tags followed by a user',
      userStars: 'Articles favorited by a user',
      userFollowers: 'Followers of a user',
      userEvents: 'Recent activity',
      notice: 'Read notifications and mark them read',
      noticeUnread: 'Unread count',
      noticeType: type => `List ${type} notifications`,
      noticeRead: 'Mark commented, comment2ed, reply, at or following as read (write)',
      top: 'Leaderboards',
      topNewbies: 'Newly registered users',
      topFollowers: 'Users ranked by followers',
      time: 'Current server time',
      skill: 'Install the bundled agent skill',
      skillInstall: 'Install or update ~/.agents/skills/liandi (local file write)',
    },
    options: {
      title: 'Article title',
      tags: 'Comma-separated tags',
      articleContent: 'Inline article content',
      commentContent: 'Inline comment content',
      contentFile: 'Read content from a UTF-8 Markdown/HTML file',
      contentType: 'markdown or html',
      rewardContent: 'Reward-area content',
      rewardPoint: 'Reward points',
      sort: 'latest, hot, good, reply, perfect',
      page: 'Page number',
      commentPage: 'Comment page number',
      tag: 'Filter by tag',
      domain: 'Filter by domain (latest sort only)',
      articleType: 'Article type from "article source"',
      replyTo: 'Original comment ID when replying',
      visible: 'true: only the author can see it; false: public',
      userNumber: 'Treat <name> as a user number',
      eventSize: 'Number of events, 1-64',
    },
  },
  output: {
    error: (code, message) => `Error [${code}]: ${message}`,
    dryRun: 'Dry run: no request was sent.',
    cancelled: 'Cancelled: no request was sent.',
    confirmOperation: 'Execute this operation? [y/N] ',
    confirmSkill: 'Install this skill? [y/N] ',
  },
  render: {
    listSeparator: ', ',
    pageNote: (shown, pages) => pages ? `Showing ${shown} · ${pages} pages` : `Showing ${shown}`,
    emptyArticles: 'No articles.',
    untitled: '(untitled)',
    anonymous: 'Anonymous',
    repliesCount: count => plural(count, 'reply', 'replies'),
    viewsCount: count => plural(count, 'view', 'views'),
    likesCount: count => plural(count, 'like', 'likes'),
    starsCount: count => plural(count, 'star', 'stars'),
    authorOnlyBadge: '(author only)',
    authorOnlyInline: 'author only',
    commentRepliesCount: count => plural(count, 'reply', 'replies'),
    emptyBody: '(empty)',
    noContent: '(no content)',
    unknownArticle: '(unknown article)',
    fields: {
      title: 'Title',
      author: 'Author',
      time: 'Time',
      tags: 'Tags',
      activity: 'Activity',
      link: 'Link',
      type: 'Type',
      contentType: 'Content Type',
      reward: 'Reward',
      username: 'Username',
      nickname: 'Nickname',
      userNo: 'User No.',
      bio: 'Bio',
      articlesComments: 'Articles / Comments',
      pointsRank: 'Points / Rank',
      checkinStreak: 'Check-in Streak',
      profile: 'Profile',
      tag: 'Tag',
      refsComments: 'Refs / Comments',
      followersViews: 'Followers / Views',
      domains: 'Domains',
      domain: 'Domain',
      tagsViews: 'Tags / Views',
      includedTags: 'Tags',
      serverTime: 'Server Time',
      timestamp: 'Timestamp',
      location: 'Location',
      files: 'Files',
    },
    sections: {
      body: 'Body',
      comments: (shown, total) => `Comments (${shown} on this page · ${total} total)`,
      sourceBody: 'Body (raw, ready for article edit)',
      description: 'Description',
    },
    unknownContentType: 'unknown (pass --content-type explicitly when editing)',
    rewardPoints: points => `${points} pts`,
    checkinStreakValue: (current, longest) => `${current} days (longest ${longest} days)`,
    userColumns: {
      username: 'Username',
      nickname: 'Nickname',
      articles: 'Articles',
      comments: 'Comments',
      points: 'Points',
      profile: 'Profile',
    },
    emptyUsers: 'No users.',
    usersTotal: count => `${count} ${count === 1 ? 'user' : 'users'}`,
    tagColumns: {
      tag: 'Tag',
      refs: 'Refs',
      comments: 'Comments',
      followers: 'Followers',
      link: 'Link',
    },
    emptyTags: 'No tags.',
    domainColumns: {
      domain: 'Domain',
      tags: 'Tags',
      views: 'Views',
      link: 'Link',
    },
    emptyDomains: 'No domains.',
    unreadLabels: {
      unreadNotificationCnt: 'Comments',
      unreadCommentedNotificationCnt: 'Commented',
      unreadComment2edNotificationCnt: 'Comments',
      unreadReplyNotificationCnt: 'Replies',
      unreadAtNotificationCnt: 'Mentions',
      unreadFollowingNotificationCnt: 'Following',
      unreadPointNotificationCnt: 'Points',
      unreadWalletNotificationCnt: 'Wallet',
      unreadBroadcastNotificationCnt: 'Broadcast',
      unreadSysAnnounceNotificationCnt: 'Announcements',
      unreadNewFollowerNotificationCnt: 'New followers',
      unreadChatNotificationCnt: 'Chat',
      unreadReviewNotificationCnt: 'Review',
    },
    emptyUnread: 'No unread notifications.',
    unreadTotal: total => `${total} unread total`,
    emptyNotices: 'No notifications.',
    noticeRead: 'Read',
    noticeUnread: 'Unread',
    systemAuthor: 'System',
    noticesFooter: (shown, unread) => `Showing ${shown}${unread ? ` · ${unread} unread` : ''}`,
    emptyEvents: 'No activity.',
    eventsTotal: count => `${count} ${count === 1 ? 'event' : 'events'}`,
    emptyComments: 'No comments.',
    serverTimeLocal: formatted => `${formatted} (local time)`,
    writes: {
      'articles.post': 'Article published',
      'articles.edit': 'Article updated',
      'comments.post': 'Comment posted',
      'comments.edit': 'Comment updated',
    },
    noticeNames: {
      commented: 'commented',
      comment2ed: 'comment2ed',
      reply: 'reply',
      at: 'mention',
      following: 'following',
    },
    markedRead: name => `Marked ${name} notifications as read`,
    skillInstalled: 'Skill installed or updated',
  },
};

const ZH_CN: Messages = {
  help: {
    description: '面向人类和 Agent 的链滴（ld246.com）社区命令行客户端',
    showVersion: '显示版本号',
    showHelp: '显示帮助信息',
    helpCommand: '显示指定命令的帮助信息',
    headings: {
      'Usage:': '用法：',
      'Arguments:': '参数：',
      'Options:': '选项：',
      'Commands:': '命令：',
    },
    defaultValue: value => `（默认：${value}）`,
    globalFooter: `
全局选项（可放在命令前或命令后）：
  -t, --token <token>       API Token（最高优先级）
  -b, --base-url <url>      API 服务器地址（默认：https://ld246.com）
  --format <format>         输出格式：human（默认）或 json
  -j, --json                --format json 的简写
  --lang <locale>           显示语言：en、zh-CN 或 zh-TW
  -d, --dry-run             仅预览写操作，不发送请求
  -y, --yes                 跳过交互确认直接执行写操作
  --color <when>            状态行与提示着色：auto、always、never
  --no-color                禁用颜色（等同于 --color never）
  -v, --version             显示版本号
  -h, --help                显示帮助信息

读操作不使用 --dry-run/--yes；写操作确认前始终先展示预览。
--format human 输出表格与摘要；--format json 输出供脚本使用的稳定信封。
语言优先级：--lang > LIANDI_LANG > LC_ALL/LC_MESSAGES/LANG > 系统语言（JSON 输出不受影响）。
鉴权优先级：--token > LIANDI_TOKEN > ./.env > ~/.config/liandi/.env
运行 "liandi <命令组> --help" 查看子命令。`,
    commands: {
      article: '读取、发布与编辑帖子',
      articleList: '列出帖子',
      articleGet: '查看帖子详情及分页回帖',
      articlePost: '发布帖子（写操作）',
      articleSource: '获取用于更新的帖子原文',
      articleEdit: '更新帖子（写操作）',
      comment: '发布与编辑回帖',
      commentPost: '给帖子发表回帖（写操作）',
      commentEdit: '更新自己的回帖（写操作）',
      domain: '列出与查看领域',
      domainList: '列出领域',
      domainGet: '查看单个领域',
      tag: '列出与查看标签',
      tagList: '列出标签',
      tagGet: '查看单个标签',
      user: '查看用户资料、动态与社交列表',
      userMe: '当前已鉴权用户',
      userGet: '按用户名查询资料，配合 --number 按用户号查询',
      userArticles: '用户发布的帖子',
      userComments: '用户的回帖',
      userWatches: '用户关注的帖子',
      userFollows: '用户关注的人',
      userTags: '用户关注的标签',
      userStars: '用户收藏的帖子',
      userFollowers: '用户的粉丝',
      userEvents: '用户近期动态',
      notice: '读取通知与标记已读',
      noticeUnread: '未读通知统计',
      noticeType: type => `列出 ${type} 类型通知`,
      noticeRead: '将 commented、comment2ed、reply、at 或 following 标为已读（写操作）',
      top: '查看榜单',
      topNewbies: '新注册用户榜',
      topFollowers: '粉丝排行榜',
      time: '当前服务器时间',
      skill: '安装内置 Agent 技能',
      skillInstall: '安装或更新 ~/.agents/skills/liandi（本地文件写入）',
    },
    options: {
      title: '帖子标题',
      tags: '逗号分隔的标签',
      articleContent: '内联帖子正文',
      commentContent: '内联回帖正文',
      contentFile: '从 UTF-8 Markdown/HTML 文件读取正文',
      contentType: 'markdown 或 html',
      rewardContent: '打赏区内容',
      rewardPoint: '打赏积分',
      sort: 'latest、hot、good、reply 或 perfect',
      page: '页码',
      commentPage: '回帖页码',
      tag: '按标签筛选',
      domain: '按领域筛选（仅支持默认 latest 排序）',
      articleType: '从 "article source" 获取的帖子类型',
      replyTo: '回复指定回帖时的原回帖 ID',
      visible: 'true：仅作者可见；false：公开',
      userNumber: '将 <name> 视为用户号',
      eventSize: '动态条数（1-64）',
    },
  },
  output: {
    error: (code, message) => `错误 [${code}]：${message}`,
    dryRun: '预览模式：未发送请求。',
    cancelled: '已取消：未发送请求。',
    confirmOperation: '确认执行此操作？[y/N] ',
    confirmSkill: '确认安装此技能？[y/N] ',
  },
  render: {
    listSeparator: '、',
    pageNote: (shown, pages) => pages ? `本页 ${shown} 条 · 共 ${pages} 页` : `本页 ${shown} 条`,
    emptyArticles: '没有帖子。',
    untitled: '(无标题)',
    anonymous: '匿名',
    repliesCount: count => `${count} 回帖`,
    viewsCount: count => `${count} 浏览`,
    likesCount: count => `${count} 赞`,
    starsCount: count => `${count} 收藏`,
    authorOnlyBadge: '（仅作者可见）',
    authorOnlyInline: '仅作者可见',
    commentRepliesCount: count => `${count} 条回复`,
    emptyBody: '(空)',
    noContent: '(无正文)',
    unknownArticle: '(未知帖子)',
    fields: {
      title: '标题',
      author: '作者',
      time: '时间',
      tags: '标签',
      activity: '互动',
      link: '链接',
      type: '类型',
      contentType: '内容类型',
      reward: '奖励',
      username: '用户名',
      nickname: '昵称',
      userNo: '用户号',
      bio: '简介',
      articlesComments: '文章 / 回帖',
      pointsRank: '积分 / 排名',
      checkinStreak: '连续签到',
      profile: '主页',
      tag: '标签',
      refsComments: '引用 / 回帖',
      followersViews: '关注 / 浏览',
      domains: '领域',
      domain: '领域',
      tagsViews: '标签 / 浏览',
      includedTags: '包含标签',
      serverTime: '服务器时间',
      timestamp: '时间戳',
      location: '位置',
      files: '文件',
    },
    sections: {
      body: '正文',
      comments: (shown, total) => `回帖（本页 ${shown} 条 · 共 ${total} 条）`,
      sourceBody: '正文（原样，可直接用于 article edit）',
      description: '简介',
    },
    unknownContentType: '未知（提交时请显式传 --content-type）',
    rewardPoints: points => `${points} 积分`,
    checkinStreakValue: (current, longest) => `${current} 天（最长 ${longest} 天）`,
    userColumns: {
      username: '用户名',
      nickname: '昵称',
      articles: '文章',
      comments: '回帖',
      points: '积分',
      profile: '主页',
    },
    emptyUsers: '没有用户。',
    usersTotal: count => `共 ${count} 位`,
    tagColumns: {
      tag: '标签',
      refs: '引用',
      comments: '回帖',
      followers: '关注',
      link: '链接',
    },
    emptyTags: '没有标签。',
    domainColumns: {
      domain: '领域',
      tags: '标签',
      views: '浏览',
      link: '链接',
    },
    emptyDomains: '没有领域。',
    unreadLabels: {
      unreadNotificationCnt: '回帖',
      unreadCommentedNotificationCnt: '收到的评论',
      unreadComment2edNotificationCnt: '评论',
      unreadReplyNotificationCnt: '回复',
      unreadAtNotificationCnt: '提及我',
      unreadFollowingNotificationCnt: '关注',
      unreadPointNotificationCnt: '积分',
      unreadWalletNotificationCnt: '钱包',
      unreadBroadcastNotificationCnt: '同城广播',
      unreadSysAnnounceNotificationCnt: '系统公告',
      unreadNewFollowerNotificationCnt: '新关注者',
      unreadChatNotificationCnt: '聊天',
      unreadReviewNotificationCnt: '审核',
    },
    emptyUnread: '没有未读消息。',
    unreadTotal: total => `合计 ${total} 条未读`,
    emptyNotices: '没有消息。',
    noticeRead: '已读',
    noticeUnread: '未读',
    systemAuthor: '系统',
    noticesFooter: (shown, unread) => `本页 ${shown} 条${unread ? ` · 未读 ${unread}` : ''}`,
    emptyEvents: '没有动态。',
    eventsTotal: count => `共 ${count} 条动态`,
    emptyComments: '没有回帖。',
    serverTimeLocal: formatted => `${formatted}（本地时区）`,
    writes: {
      'articles.post': '已发布帖子',
      'articles.edit': '已更新帖子',
      'comments.post': '已发布回帖',
      'comments.edit': '已更新回帖',
    },
    noticeNames: {
      commented: '回帖',
      comment2ed: '评论',
      reply: '回复',
      at: '提及',
      following: '关注',
    },
    markedRead: name => `已将${name}消息标记为已读`,
    skillInstalled: '技能已安装或更新',
  },
};

const ZH_TW: Messages = {
  help: {
    description: '面向人類與 Agent 的鏈滴（ld246.com）社群命令列用戶端',
    showVersion: '顯示版本號',
    showHelp: '顯示說明資訊',
    helpCommand: '顯示指定命令的說明資訊',
    headings: {
      'Usage:': '用法：',
      'Arguments:': '參數：',
      'Options:': '選項：',
      'Commands:': '命令：',
    },
    defaultValue: value => `（預設：${value}）`,
    globalFooter: `
全域選項（可置於命令前或命令後）：
  -t, --token <token>       API Token（最高優先順序）
  -b, --base-url <url>      API 伺服器位址（預設：https://ld246.com）
  --format <format>         輸出格式：human（預設）或 json
  -j, --json                --format json 的簡寫
  --lang <locale>           顯示語言：en、zh-CN 或 zh-TW
  -d, --dry-run             僅預覽寫入操作，不傳送請求
  -y, --yes                 跳過互動確認直接執行寫入操作
  --color <when>            狀態列與提示著色：auto、always、never
  --no-color                停用顏色（等同於 --color never）
  -v, --version             顯示版本號
  -h, --help                顯示說明資訊

讀取操作不使用 --dry-run/--yes；寫入操作確認前一律先顯示預覽。
--format human 輸出表格與摘要；--format json 輸出供指令碼使用的穩定信封。
語言優先順序：--lang > LIANDI_LANG > LC_ALL/LC_MESSAGES/LANG > 系統語言（JSON 輸出不受影響）。
驗證優先順序：--token > LIANDI_TOKEN > ./.env > ~/.config/liandi/.env
執行 "liandi <命令群組> --help" 查看子命令。`,
    commands: {
      article: '讀取、發布與編輯貼文',
      articleList: '列出貼文',
      articleGet: '檢視貼文詳情與分頁回覆',
      articlePost: '發布貼文（寫入操作）',
      articleSource: '取得用於更新的貼文原文',
      articleEdit: '更新貼文（寫入操作）',
      comment: '發布與編輯回覆',
      commentPost: '為貼文發表回覆（寫入操作）',
      commentEdit: '更新自己的回覆（寫入操作）',
      domain: '列出與檢視領域',
      domainList: '列出領域',
      domainGet: '檢視單一領域',
      tag: '列出與檢視標籤',
      tagList: '列出標籤',
      tagGet: '檢視單一標籤',
      user: '檢視使用者資料、動態與社群列表',
      userMe: '目前驗證的使用者',
      userGet: '依使用者名稱查詢資料，搭配 --number 依使用者編號查詢',
      userArticles: '使用者發布的貼文',
      userComments: '使用者的回覆',
      userWatches: '使用者關注的貼文',
      userFollows: '使用者關注的人',
      userTags: '使用者關注的標籤',
      userStars: '使用者收藏的貼文',
      userFollowers: '使用者的粉絲',
      userEvents: '使用者近期動態',
      notice: '讀取通知並標記已讀',
      noticeUnread: '未讀通知統計',
      noticeType: type => `列出 ${type} 類型通知`,
      noticeRead: '將 commented、comment2ed、reply、at 或 following 標為已讀（寫入操作）',
      top: '檢視排行榜',
      topNewbies: '新註冊使用者榜',
      topFollowers: '粉絲排行榜',
      time: '目前伺服器時間',
      skill: '安裝內建 Agent 技能',
      skillInstall: '安裝或更新 ~/.agents/skills/liandi（本機檔案寫入）',
    },
    options: {
      title: '貼文標題',
      tags: '以逗號分隔的標籤',
      articleContent: '內嵌貼文內容',
      commentContent: '內嵌回覆內容',
      contentFile: '從 UTF-8 Markdown/HTML 檔案讀取內容',
      contentType: 'markdown 或 html',
      rewardContent: '打賞區內容',
      rewardPoint: '打賞積分',
      sort: 'latest、hot、good、reply 或 perfect',
      page: '頁碼',
      commentPage: '回覆頁碼',
      tag: '依標籤篩選',
      domain: '依領域篩選（僅支援預設 latest 排序）',
      articleType: '從 "article source" 取得的貼文類型',
      replyTo: '回覆指定回覆時的原回覆 ID',
      visible: 'true：僅作者可見；false：公開',
      userNumber: '將 <name> 視為使用者編號',
      eventSize: '動態則數（1-64）',
    },
  },
  output: {
    error: (code, message) => `錯誤 [${code}]：${message}`,
    dryRun: '預覽模式：未傳送請求。',
    cancelled: '已取消：未傳送請求。',
    confirmOperation: '確認執行此操作？[y/N] ',
    confirmSkill: '確認安裝此技能？[y/N] ',
  },
  render: {
    listSeparator: '、',
    pageNote: (shown, pages) => pages ? `本頁 ${shown} 則 · 共 ${pages} 頁` : `本頁 ${shown} 則`,
    emptyArticles: '沒有貼文。',
    untitled: '(無標題)',
    anonymous: '匿名',
    repliesCount: count => `${count} 回覆`,
    viewsCount: count => `${count} 瀏覽`,
    likesCount: count => `${count} 讚`,
    starsCount: count => `${count} 收藏`,
    authorOnlyBadge: '（僅作者可見）',
    authorOnlyInline: '僅作者可見',
    commentRepliesCount: count => `${count} 則回覆`,
    emptyBody: '(空)',
    noContent: '(無內文)',
    unknownArticle: '(未知貼文)',
    fields: {
      title: '標題',
      author: '作者',
      time: '時間',
      tags: '標籤',
      activity: '互動',
      link: '連結',
      type: '類型',
      contentType: '內容類型',
      reward: '獎勵',
      username: '使用者名稱',
      nickname: '暱稱',
      userNo: '使用者編號',
      bio: '簡介',
      articlesComments: '文章 / 回覆',
      pointsRank: '積分 / 排名',
      checkinStreak: '連續簽到',
      profile: '主頁',
      tag: '標籤',
      refsComments: '引用 / 回覆',
      followersViews: '關注 / 瀏覽',
      domains: '領域',
      domain: '領域',
      tagsViews: '標籤 / 瀏覽',
      includedTags: '包含標籤',
      serverTime: '伺服器時間',
      timestamp: '時間戳',
      location: '位置',
      files: '檔案',
    },
    sections: {
      body: '內文',
      comments: (shown, total) => `回覆（本頁 ${shown} 則 · 共 ${total} 則）`,
      sourceBody: '內文（原始內容，可直接用於 article edit）',
      description: '簡介',
    },
    unknownContentType: '未知（送出時請明確傳入 --content-type）',
    rewardPoints: points => `${points} 積分`,
    checkinStreakValue: (current, longest) => `${current} 天（最長 ${longest} 天）`,
    userColumns: {
      username: '使用者名稱',
      nickname: '暱稱',
      articles: '文章',
      comments: '回覆',
      points: '積分',
      profile: '主頁',
    },
    emptyUsers: '沒有使用者。',
    usersTotal: count => `共 ${count} 位`,
    tagColumns: {
      tag: '標籤',
      refs: '引用',
      comments: '回覆',
      followers: '關注',
      link: '連結',
    },
    emptyTags: '沒有標籤。',
    domainColumns: {
      domain: '領域',
      tags: '標籤',
      views: '瀏覽',
      link: '連結',
    },
    emptyDomains: '沒有領域。',
    unreadLabels: {
      unreadNotificationCnt: '回覆',
      unreadCommentedNotificationCnt: '收到的評論',
      unreadComment2edNotificationCnt: '評論',
      unreadReplyNotificationCnt: '回覆',
      unreadAtNotificationCnt: '提及我',
      unreadFollowingNotificationCnt: '關注',
      unreadPointNotificationCnt: '積分',
      unreadWalletNotificationCnt: '錢包',
      unreadBroadcastNotificationCnt: '同城廣播',
      unreadSysAnnounceNotificationCnt: '系統公告',
      unreadNewFollowerNotificationCnt: '新關注者',
      unreadChatNotificationCnt: '聊天',
      unreadReviewNotificationCnt: '審核',
    },
    emptyUnread: '沒有未讀通知。',
    unreadTotal: total => `合計 ${total} 則未讀`,
    emptyNotices: '沒有通知。',
    noticeRead: '已讀',
    noticeUnread: '未讀',
    systemAuthor: '系統',
    noticesFooter: (shown, unread) => `本頁 ${shown} 則${unread ? ` · 未讀 ${unread}` : ''}`,
    emptyEvents: '沒有動態。',
    eventsTotal: count => `共 ${count} 則動態`,
    emptyComments: '沒有回覆。',
    serverTimeLocal: formatted => `${formatted}（本地時區）`,
    writes: {
      'articles.post': '已發布貼文',
      'articles.edit': '已更新貼文',
      'comments.post': '已發布回覆',
      'comments.edit': '已更新回覆',
    },
    noticeNames: {
      commented: '回覆',
      comment2ed: '評論',
      reply: '回覆',
      at: '提及',
      following: '關注',
    },
    markedRead: name => `已將${name}通知標記為已讀`,
    skillInstalled: '技能已安裝或更新',
  },
};

const CATALOG: Record<Locale, Messages> = {
  en: EN,
  'zh-CN': ZH_CN,
  'zh-TW': ZH_TW,
};

export function messages(locale: Locale = DEFAULT_LOCALE): Messages {
  return CATALOG[locale];
}

/* ----------------------------------------------------------- human errors */

const EXACT_ERRORS: Record<string, { 'zh-CN': string; 'zh-TW': string }> = {
  'Use either --json or --format human, not both': {
    'zh-CN': '--json 与 --format human 不能同时使用',
    'zh-TW': '--json 與 --format human 不能同時使用',
  },
  '--no-color does not take a value': {
    'zh-CN': '--no-color 不接受参数值',
    'zh-TW': '--no-color 不接受參數值',
  },
  '--color must be auto, always or never': {
    'zh-CN': '--color 必须是 auto、always 或 never',
    'zh-TW': '--color 必須是 auto、always 或 never',
  },
  '--format must be human or json': {
    'zh-CN': '--format 必须是 human 或 json',
    'zh-TW': '--format 必須是 human 或 json',
  },
  '--lang must be en, zh-CN or zh-TW': {
    'zh-CN': '--lang 必须是 en、zh-CN 或 zh-TW',
    'zh-TW': '--lang 必須是 en、zh-CN 或 zh-TW',
  },
  '--yes only applies to write operations; omit it for reads': {
    'zh-CN': '--yes 仅适用于写操作，读操作请省略',
    'zh-TW': '--yes 僅適用於寫入操作，讀取操作請省略',
  },
  '--dry-run only applies to write operations; omit it for reads': {
    'zh-CN': '--dry-run 仅适用于写操作，读操作请省略',
    'zh-TW': '--dry-run 僅適用於寫入操作，讀取操作請省略',
  },
  'Internal command mapping is missing': {
    'zh-CN': '缺少内部命令映射',
    'zh-TW': '缺少內部命令對應',
  },
  'Confirmation required. Review with --dry-run, then rerun with --yes': {
    'zh-CN': '需要确认。请先使用 --dry-run 预览，再加 --yes 重新执行',
    'zh-TW': '需要確認。請先使用 --dry-run 預覽，再加 --yes 重新執行',
  },
  'Confirmation required in a non-interactive terminal. Review with --dry-run, then rerun with --yes': {
    'zh-CN': '非交互终端需要确认。请先使用 --dry-run 预览，再加 --yes 重新执行',
    'zh-TW': '非互動終端需要確認。請先使用 --dry-run 預覽，再加 --yes 重新執行',
  },
  'Sort must be latest, hot, good, reply or perfect': {
    'zh-CN': '排序必须是 latest、hot、good、reply 或 perfect',
    'zh-TW': '排序必須是 latest、hot、good、reply 或 perfect',
  },
  'Use either --tag or --domain, not both': {
    'zh-CN': '--tag 与 --domain 不能同时使用',
    'zh-TW': '--tag 與 --domain 不能同時使用',
  },
  '--domain supports only the default latest sort': {
    'zh-CN': '--domain 仅支持默认的 latest 排序',
    'zh-TW': '--domain 僅支援預設的 latest 排序',
  },
  'Use either --content or --content-file, not both': {
    'zh-CN': '--content 与 --content-file 不能同时使用',
    'zh-TW': '--content 與 --content-file 不能同時使用',
  },
  'Provide --content <text> or --content-file <path>': {
    'zh-CN': '请提供 --content <text> 或 --content-file <path>',
    'zh-TW': '請提供 --content <text> 或 --content-file <path>',
  },
  'Expected an integer greater than zero': {
    'zh-CN': '需要大于 0 的整数',
    'zh-TW': '需要大於 0 的整數',
  },
  'Size must be between 1 and 64': {
    'zh-CN': '条数必须在 1 到 64 之间',
    'zh-TW': '則數必須在 1 到 64 之間',
  },
  'Content type must be markdown or html': {
    'zh-CN': '内容类型必须是 markdown 或 html',
    'zh-TW': '內容類型必須是 markdown 或 html',
  },
  'Expected true or false': {
    'zh-CN': '需要 true 或 false',
    'zh-TW': '需要 true 或 false',
  },
  'Invalid .env: unterminated single quote': {
    'zh-CN': '无效的 .env：单引号未闭合',
    'zh-TW': '無效的 .env：單引號未閉合',
  },
  'Invalid .env: unterminated double quote': {
    'zh-CN': '无效的 .env：双引号未闭合',
    'zh-TW': '無效的 .env：雙引號未閉合',
  },
  'Base URL must be an absolute HTTP(S) URL': {
    'zh-CN': 'Base URL 必须是完整的 HTTP(S) 地址',
    'zh-TW': 'Base URL 必須是完整的 HTTP(S) 位址',
  },
  'Base URL must use HTTP or HTTPS': {
    'zh-CN': 'Base URL 必须使用 HTTP 或 HTTPS 协议',
    'zh-TW': 'Base URL 必須使用 HTTP 或 HTTPS 協定',
  },
  'API token required. Set --token, LIANDI_TOKEN, ./.env, or ~/.config/liandi/.env': {
    'zh-CN': '需要 API Token。请通过 --token、LIANDI_TOKEN、./.env 或 ~/.config/liandi/.env 配置',
    'zh-TW': '需要 API Token。請透過 --token、LIANDI_TOKEN、./.env 或 ~/.config/liandi/.env 設定',
  },
  'Network request failed': {
    'zh-CN': '网络请求失败',
    'zh-TW': '網路請求失敗',
  },
  'Bundled liandi skill is missing. Reinstall the liandi package': {
    'zh-CN': '内置 liandi 技能缺失，请重新安装 liandi 包',
    'zh-TW': '內建 liandi 技能缺失，請重新安裝 liandi 套件',
  },
  'Unknown error': {
    'zh-CN': '未知错误',
    'zh-TW': '未知錯誤',
  },
};

const SEGMENT_LABELS: Record<string, { 'zh-CN': string; 'zh-TW': string }> = {
  Username: { 'zh-CN': '用户名', 'zh-TW': '使用者名稱' },
  Tag: { 'zh-CN': '标签', 'zh-TW': '標籤' },
  Domain: { 'zh-CN': '领域', 'zh-TW': '領域' },
  'Article ID': { 'zh-CN': '帖子 ID', 'zh-TW': '貼文 ID' },
  'Comment ID': { 'zh-CN': '回帖 ID', 'zh-TW': '回覆 ID' },
  'User number': { 'zh-CN': '用户号', 'zh-TW': '使用者編號' },
};

const CONFIG_LABELS: Record<string, { 'zh-CN': string; 'zh-TW': string }> = {
  local: { 'zh-CN': '本地', 'zh-TW': '本機' },
  global: { 'zh-CN': '全局', 'zh-TW': '全域' },
};

type PatternRule = {
  pattern: RegExp;
  'zh-CN': (match: RegExpMatchArray) => string;
  'zh-TW': (match: RegExpMatchArray) => string;
};

const PATTERN_ERRORS: readonly PatternRule[] = [
  {
    pattern: /^(.+) does not take a value$/u,
    'zh-CN': m => `${m[1]} 不接受参数值`,
    'zh-TW': m => `${m[1]} 不接受參數值`,
  },
  {
    pattern: /^(.+) requires a value$/u,
    'zh-CN': m => `${m[1]} 需要提供参数值`,
    'zh-TW': m => `${m[1]} 需要提供參數值`,
  },
  {
    pattern: /^Notice type must be one of: (.+)$/u,
    'zh-CN': m => `通知类型必须是以下之一：${m[1]}`,
    'zh-TW': m => `通知類型必須是以下之一：${m[1]}`,
  },
  {
    pattern: /^Only (.+) can be marked read$/u,
    'zh-CN': m => `仅支持将 ${m[1]} 标记为已读`,
    'zh-TW': m => `僅支援將 ${m[1]} 標記為已讀`,
  },
  {
    pattern: /^Cannot read content file: (.+)$/u,
    'zh-CN': m => `无法读取正文文件：${m[1]}`,
    'zh-TW': m => `無法讀取內容檔案：${m[1]}`,
  },
  {
    pattern: /^Expected an integer, received: (.+)$/u,
    'zh-CN': m => `需要整数，实际收到：${m[1]}`,
    'zh-TW': m => `需要整數，實際收到：${m[1]}`,
  },
  {
    pattern: /^Integer out of range: (.+)$/u,
    'zh-CN': m => `整数超出安全范围：${m[1]}`,
    'zh-TW': m => `整數超出安全範圍：${m[1]}`,
  },
  {
    pattern: /^(.+) cannot be empty$/u,
    'zh-CN': m => `${SEGMENT_LABELS[m[1]!]?.['zh-CN'] ?? m[1]}不能为空`,
    'zh-TW': m => `${SEGMENT_LABELS[m[1]!]?.['zh-TW'] ?? m[1]}不能為空`,
  },
  {
    pattern: /^(.+) cannot be "\." or "\.\."$/u,
    'zh-CN': m => `${SEGMENT_LABELS[m[1]!]?.['zh-CN'] ?? m[1]}不能为 "." 或 ".."`,
    'zh-TW': m => `${SEGMENT_LABELS[m[1]!]?.['zh-TW'] ?? m[1]}不能為 "." 或 ".."`,
  },
  {
    pattern: /^Cannot read (local|global) configuration$/u,
    'zh-CN': m => `无法读取${CONFIG_LABELS[m[1]!]?.['zh-CN'] ?? m[1]}配置`,
    'zh-TW': m => `無法讀取${CONFIG_LABELS[m[1]!]?.['zh-TW'] ?? m[1]}設定`,
  },
  {
    pattern: /^Server returned non-JSON response \(HTTP (\d+)\)$/u,
    'zh-CN': m => `服务器返回了非 JSON 响应（HTTP ${m[1]}）`,
    'zh-TW': m => `伺服器回傳了非 JSON 回應（HTTP ${m[1]}）`,
  },
  {
    pattern: /^Request failed with HTTP (\d+)$/u,
    'zh-CN': m => `请求失败（HTTP ${m[1]}）`,
    'zh-TW': m => `請求失敗（HTTP ${m[1]}）`,
  },
  {
    pattern: /^Request timed out after (\d+)ms$/u,
    'zh-CN': m => `请求超时（${m[1]}ms）`,
    'zh-TW': m => `請求逾時（${m[1]}ms）`,
  },
  {
    pattern: /^API returned code (-?\d+)$/u,
    'zh-CN': m => `接口返回错误码 ${m[1]}`,
    'zh-TW': m => `介面回傳錯誤碼 ${m[1]}`,
  },
  {
    pattern: /^Cannot install the liandi skill: (.+)$/u,
    'zh-CN': m => `无法安装 liandi 技能：${m[1]}`,
    'zh-TW': m => `無法安裝 liandi 技能：${m[1]}`,
  },
  // Commander argument/option parse errors
  {
    pattern: /^unknown command '(.+)'$/u,
    'zh-CN': m => `未知命令 '${m[1]}'`,
    'zh-TW': m => `未知命令 '${m[1]}'`,
  },
  {
    pattern: /^unknown option '(.+)'$/u,
    'zh-CN': m => `未知选项 '${m[1]}'`,
    'zh-TW': m => `未知選項 '${m[1]}'`,
  },
  {
    pattern: /^required option '(.+)' not specified$/u,
    'zh-CN': m => `缺少必填选项 '${m[1]}'`,
    'zh-TW': m => `缺少必填選項 '${m[1]}'`,
  },
  {
    pattern: /^missing required argument '(.+)'$/u,
    'zh-CN': m => `缺少必填参数 '${m[1]}'`,
    'zh-TW': m => `缺少必填參數 '${m[1]}'`,
  },
  {
    pattern: /^option '(.+)' argument missing$/u,
    'zh-CN': m => `选项 '${m[1]}' 缺少参数值`,
    'zh-TW': m => `選項 '${m[1]}' 缺少參數值`,
  },
  {
    pattern: /^too many arguments for '(.+)'\. Expected (\d+) arguments? but got (\d+)\.$/u,
    'zh-CN': m => `命令 '${m[1]}' 参数过多：需要 ${m[2]} 个，实际收到 ${m[3]} 个`,
    'zh-TW': m => `命令 '${m[1]}' 參數過多：需要 ${m[2]} 個，實際收到 ${m[3]} 個`,
  },
];

/**
 * Translate a canonical English CLI error message for human terminal output.
 * Upstream server messages and unknown runtime exceptions pass through untouched.
 */
export function localizeErrorMessage(message: string, locale: Locale = DEFAULT_LOCALE): string {
  if (locale === 'en') return message;
  const exact = EXACT_ERRORS[message];
  if (exact) return exact[locale];
  for (const rule of PATTERN_ERRORS) {
    const match = message.match(rule.pattern);
    if (match) return rule[locale](match);
  }
  return message;
}
