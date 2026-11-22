# liandi

面向人类和 Agent 的 [链滴 ld246.com](https://ld246.com) 命令行客户端。TypeScript 实现，覆盖[官方社区客户端 API 文档](https://ld246.com/article/1488603534762)列出的所有操作。

## 特性

- 完整支持帖子、回帖、领域、标签、用户、通知、榜单和系统时间接口。
- 默认人类可读输出：列表成表格或分块，详情是字段摘要；`--format json`（简写 `-j`）提供统一、稳定的机器可读信封。
- 表格按终端宽度自适应，中文字符按双宽计算，不会把一行挤成两行。
- 写操作默认先展示请求预览，再交互确认；`-d, --dry-run` 仅预览，`-y, --yes` 确认执行。
- `--content` 内联正文或 `--content-file` 读取 UTF-8 Markdown/HTML 文件。
- 每级配置独立管理 API Token，日志和预览不输出凭据。
- 自带 `liandi/<version>` User-Agent，可安装 Agent 技能。
- Node.js 20+，Windows/macOS/Linux 通用，运行时仅依赖 Commander。
- 语义化版本，tag 触发发布；CI 覆盖三平台 × Node 20/22/24 与打包安装验证。

## 安装与运行

需要 Node.js 20 或更高版本，Windows、macOS、Linux 通用。

```sh
# 不安装，直接用（npx 会取最新版）
npx liandi --help

# 或全局安装，之后直接敲 liandi
npm install -g liandi
liandi --help
```

### 各平台配置位置

| 平台 | 全局 `.env` 路径 |
| --- | --- |
| Linux / macOS | `$XDG_CONFIG_HOME/liandi/.env`，未设置时为 `~/.config/liandi/.env` |
| Windows | `%APPDATA%\liandi\.env`（无 `APPDATA` 时回退到 `~/.config/liandi/.env`） |

当前目录的 `./.env` 优先于全局配置；`.env` 支持 CRLF 与 BOM（Windows 编辑器常见）。

Windows PowerShell 临时指定 token：

```powershell
$env:LIANDI_TOKEN = "你的 API Token"
liandi user me -j
```

长期使用请写进 `.env` 并收紧权限，避免 token 进入命令历史。

### 源码开发

```sh
git clone https://github.com/wmy2981/liandi-cli.git
cd liandi-cli
npm install && npm run build
npm link          # 之后全局可用 liandi
# 或直接运行：node dist/cli.js --help
```

## API Token 与鉴权

在 [链滴设置 - 账号](https://ld246.com/settings/account) 获取 **API Token**。普通 API 请求使用：

```http
Authorization: token <API Token>
```

这不是 `Bearer` 认证，也不是网页登录的 `symphony` Cookie 会话。本 CLI 只使用 API Token：账号密码登录（`/api/v2/login`、`/api/v2/login/2fa`）返回的会话 token 只在两步验证流程里有效，不能当 API Token 用，因此 `auth` 命令组已移除，登录请走网页端。

只要配置了 Token，CLI 就会对所有 v2 请求附带它；未配置时仍会尝试匿名读取。实测 ld246.com 对无 Token 的 `/api/v2/*` 请求普遍返回 401，因此除纯公开读取外建议始终配置 Token。

Token 来源优先级从高到低：

1. `-t, --token <API Token>`
2. 进程环境变量 `LIANDI_TOKEN`
3. 当前工作目录 `.env` 中的 `LIANDI_TOKEN`
4. `$XDG_CONFIG_HOME/liandi/.env`；未设置 XDG 时为 `~/.config/liandi/.env`

建议用受保护的 `.env` 文件，而非可能留在 shell 历史或进程列表中的 `--token`：

```sh
cp .env.example .env
chmod 600 .env
# 编辑 .env，填入 LIANDI_TOKEN
```

`.env` 已加入 `.gitignore`。支持 `KEY=value`、单/双引号、`export KEY=value` 和注释，不执行 shell 表达式。`LIANDI_BASE_URL` 或 `-b, --base-url` 可指定私有/测试服务器，默认 `https://ld246.com`。

## 输出约定

### 人类阅读（默认）

默认 `--format human`：列表命令渲染成表格或紧凑分块，详情命令渲染成字段摘要，管道里也一样。错误写到 stderr：

```text
Error [AUTH_REQUIRED]: API token required. ...
```

帖子列表每项三行（标题 / 作者·时间·回帖·浏览 / 链接）：

```text
 1. 为什么复制后光标会跑到行首？
    inessence · 2026-11-22 11:27:13 · 6 回帖 · 10 浏览
    https://ld246.com/article/1795318034189

本页 20 条 · 共 2991 页
```

短字段列表（用户、标签、领域）用对齐表格，按终端宽度收缩，中文按双宽计算：

```text
用户名           昵称    文章  回帖  积分  主页
───────────────  ──────  ────  ────  ────  ─────────────────────────────────────────────────────
yoss             Yoss        6   167  2270  https://ld246.com/member/yoss
```

`user me`、`article get`、`tag get`、`domain get` 输出字段摘要与分段正文/简介。上游结构变化导致无法识别时，自动退化成只输出 `data` 的 JSON，不会打印半空表格。

### 显式选择格式

```sh
liandi article list                  # 人类可读（默认）
liandi article list --format human   # 同上，显式写出
liandi article list --format json    # 稳定信封
liandi article list -j               # 等同于 --format json
```

`--format json` 与 `-j` 输出完全一致；`-j --format human` 这类冲突组合按 `INVALID_INPUT`（退出码 2）拒绝。

### 彩色终端

交互式终端里只给状态行和提示上色：错误为红色，预览/取消为黄色，附加提示为青色；响应数据保持纯文本，`-j` 输出永远不含 ANSI 转义。

颜色按 stdout、stderr 分别检测 TTY 自动开启，也可用 `--color auto|always|never` 或 `--no-color` 控制。优先级：命令行参数 > `FORCE_COLOR`（`0`/`false` 禁用，其余启用）> `NO_COLOR`（非空即禁用）> TTY 检测。

### Agent / 自动化

在任意命令位置添加 `--format json`、`-j` 或 `--json`。stdout 始终只包含一个 JSON 对象：

```json
{
  "ok": true,
  "status": "success",
  "command": "articles.list",
  "data": {
    "code": 0,
    "msg": "",
    "data": []
  }
}
```

`data` 保留完整上游响应，不丢字段。`status` 可能是 `success`、`dry-run`、`cancelled`、`error`。无论成功、预览还是失败，stdout 只有一个 JSON 对象：写操作在交互确认时的预览会写到 stderr；非交互环境下缺少 `--yes` 时，预览会放进错误对象的 `details`。错误示例：

```json
{
  "ok": false,
  "status": "error",
  "error": {
    "code": "CONFIRMATION_REQUIRED",
    "message": "Confirmation required ..."
  }
}
```

退出码：`0` 成功/预览/取消，`1` 上游业务错误/网络/运行错误，`2` 参数、配置或确认方式错误。

错误分三层，都会被转成上面的错误信封：

1. HTTP 非 2xx（如 401/403/5xx）或响应不是 JSON；
2. **上游 JSON `code != 0`**（HTTP 200 但业务失败），错误码为 `API_CODE_<code>`，`message` 取上游 `msg`；
3. 本地参数/配置错误。

## 写操作安全流程

发帖、更新、回帖、标记通知已读和技能安装均按写操作处理。

```sh
# 1. 只预览，不发送请求
liandi article post \
  --title "命令行工具发布" \
  --tags "CLI,Markdown" \
  --content-file ./post.md \
  --dry-run

# 2. 在交互终端预览并手动输入 y
liandi article post --title "命令行工具发布" \
  --tags "CLI,Markdown" --content-file ./post.md

# 3. 无人值守：先审查上面的预览，再对同一命令添加 --yes
liandi article post --title "命令行工具发布" \
  --tags "CLI,Markdown" --content-file ./post.md --yes --json
```

- `--dry-run` 不建立网络请求，也不自动发送后续确认请求，且**不需要已配置 Token**，因此可以先审阅预览再准备凭据。
- 真正发送前才会校验 Token：缺少 Token 时会在发出任何请求之前以 `AUTH_REQUIRED`（退出码 2）失败。
- 不带 `--yes` 时显示预览并等待 `y`/`yes`；其他回答视为取消。
- 非 TTY 环境未提供 `--yes` 会拒绝执行，不会卡在输入等待。
- `--dry-run` 和 `--yes` 只适用于写操作，避免让读取命令的实际行为含糊。
- `notice read` 虽为 GET，仍会改变状态，必须按写操作确认。
- 官方说明 broadcast、wallet、sys-announce 通知拉取后自动已读，请注意这类读取的副作用。
- API Token 不出现在预览或成功输出中：预览只包含 `method`、`url` 和请求体。仍需自行保护终端和日志。

## 常用操作

```sh
# 最新、热议、好评、最近回帖、优选帖子
liandi article list --sort hot --page 1
liandi article list --tag Java --sort perfect
liandi article list --domain Java
liandi article get 1488603534762 --page 1

# 更新前获取完整原文及 articleType
liandi article source 1488603534762
liandi article edit 1488603534762 \
  --title "标题" --tags "CLI,Markdown" --type 0 --content-file post.md

# 回帖及回复指定回帖
liandi comment post 1488603534762 --content-file reply.md
liandi comment post 1488603534762 -c "回复内容" --reply-to 1488603534763
liandi comment edit 1488603534763 -c "新内容" --visible false

# 用户、领域和标签
liandi user me --json
liandi user get 88250
liandi user get 1 --number
liandi user events 88250 --size 16
liandi user followers 88250 --page 1
liandi domain list
liandi tag get Java

# 通知、榜单和系统
liandi notice unread
liandi notice at --page 1
liandi notice read at --dry-run
liandi top followers
liandi time
```

命令刻意保持简短：`article list|get|post|edit|source`、`comment post|edit`、`user me|get|articles|comments|events|watches|follows|tags|stars|followers`、`notice unread|<type>|read`、`domain|tag list|get`、`top newbies|followers`、`time`。也支持别名 `a`/`c`/`u`/`n`/`dom`/`tags`/`tops`。完整参数见 `liandi <group> --help` 或 [技能命令参考](skills/liandi/references/commands.md)。

### 正文文件

`-c, --content <text>` 和 `-f, --content-file <path>` 二选一。默认 `--content-type markdown`；HTML 用 `--content-type html`。发帖/更新支持 `--reward-content`、`--reward-point`，更新另需从 `article source` 获取的 `--type`。更新是整体覆盖：标题、标签、正文、激励区都会按本次命令的取值重新提交。

## Agent 技能

```sh
liandi skill install --dry-run
liandi skill install --yes
```

安装或覆盖更新 `~/.agents/skills/liandi`，不修改其他技能目录。技能包含安全操作规则与命令参考（评测用例放在仓库的 `evals/` 目录，不会随包安装）。

## 开发

```sh
npm install
npm run typecheck
npm run build
npm test
npm run test:coverage
node scripts/verify.mjs        # 全命令/全参数离线校验（110 项）
npm pack --dry-run
```

`node scripts/verify.mjs` 会启动本地模拟服务，逐项验证全部命令、全部参数、确认流程、输出格式、凭据优先级与错误映射（110 项），CI 每次提交都会跑。

单元与集成测试使用模拟函数和本地 HTTP 服务，不访问 ld246.com，不需要真实 Token。接口路径测试覆盖文档中的全部操作；构建产物执行公共读取、确认写入和未确认拒绝的端到端测试。

## 真实环境验证

部分只读接口与最小写操作已在真实环境验证，结论（含返回结构细节、错误码映射、匿名访问被拒）见 [docs/live-verification.md](docs/live-verification.md)。

## 不提供的能力

只实现官方 v2 文档列出的接口，文档没有的一律不提供。以下常见需求**无法用本 CLI 完成**，请不要尝试或用其它接口拼凑：

| 需求 | 状态 | 原因 |
| --- | --- | --- |
| 删除帖子 / 删除回帖 | 不提供 | 官方 v2 文档无删除接口；只能到网页端手动删除 |
| 点赞 / 感谢 / 反对（good、bad、thank） | 不提供 | 无公开 v2 接口，仅有统计字段 |
| 收藏 / 取消收藏、关注 / 取消关注 | 不提供 | 只能读取相关列表，无写入接口 |
| 投票 / 悬赏相关写操作 | 不提供 | 无公开 v2 接口 |
| 搜索帖子、用户、标签 | 不提供 | 官方文档未收录搜索接口 |
| 上传图片 / 附件 / 头像 | 不提供 | 无公开 v2 上传接口 |
| 修改昵称、头像、签名、密码、邮箱 | 不提供 | 属于设置页接口，未包含在客户端 API 文档中 |
| 积分转账、签到、兑换邀请码 | 不提供 | 无公开 v2 接口 |
| 私聊 / 聊天会话 | 不提供 | 无公开 v2 接口 |
| `auth login` / `2fa` / `logout` | 已移除 | 账号密码登录只返回一次性会话，不产生可复用的 API 凭据；调用 API 只用 API Token，登录请走网页端 |
| 自定义每页条数 | 不提供 | 服务端固定 20，只能翻页 |

可以做的写入只有：发帖、改帖（自己的）、发回帖、改回帖（自己的）、标记通知已读。其余都是只读。

## 范围与限制

- 只实现官方文档明确支持的 v2 API，不添加文档外接口；删除、点赞、收藏等未收录能力见上表。
- 上游列表页大小固定为 20；`users events` 的 `size` 范围为 1–64。
- 请遵守官方使用原则，每个 IP 每分钟不超过 120 次请求；不要批量填充内容。
- 官方 v2 线上实现与当前开源 Symphony 仓库存在差异，本 CLI 以官方 v2 文档为接口依据。

## 版本与发布

遵循语义化版本，`vX.Y.Z` tag 推送到 `main` 会自动发布到 npm 并创建 GitHub Release。手动触发 Release 工作流默认同样发布（只允许从 `main` 或 release tag 触发），需要演练时请显式勾选 `dry_run`。普通分支推送只跑测试。版本号、发布步骤与 npm token 配置见 [docs/publishing.md](docs/publishing.md)，变更记录见 [CHANGELOG.md](CHANGELOG.md)。

```sh
npm run release:patch   # 或 release:minor / release:major
git push --follow-tags  # 触发 Release 工作流
```

## 开源

[MIT](LICENSE) © 2026 wmy2981。第三方依赖和 API 声明见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。本项目是独立客户端，与 ld246.com 无隶属或背书关系。
