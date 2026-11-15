# liandi

面向人类和 Agent 的 [链滴 ld246.com](https://ld246.com) 命令行客户端。TypeScript 实现，覆盖[官方社区客户端 API 文档](https://ld246.com/article/1488603534762)列出的所有操作。

## 特性

- 完整支持帖子、回帖、领域、标签、用户、通知、榜单、登录和系统时间接口。
- 默认格式化 JSON 数据；`-j, --json` 提供统一、稳定的机器可读信封。
- 写操作默认先展示请求预览，再交互确认；`-d, --dry-run` 仅预览，`-y, --yes` 确认执行。
- `--content` 内联正文或 `--content-file` 读取 UTF-8 Markdown/HTML 文件。
- 每级配置独立管理 API Token，日志和预览不输出凭据。
- 自带 `liandi/<version>` User-Agent，可安装 Agent 技能。
- Node.js 20+，运行时仅依赖 Commander。

## 安装与运行

发布 npm 后：

```sh
npx liandi --help
# 或
npm install -g liandi
liandi --help
```

本地开发：

```sh
npm install
npm run build
node dist/cli.js --help
# 也可以在本目录执行 npm link，之后使用 liandi
```

## API Token 与鉴权

在 [链滴设置 - 账号](https://ld246.com/settings/account) 获取 **API Token**。普通 API 请求使用：

```http
Authorization: token <API Token>
```

这不是 `Bearer` 认证。`auth login` / `auth 2fa` 返回的是**登录会话 token**，用于 `symphony` Cookie 和两步验证，**不是 API Token，不能填入 `LIANDI_TOKEN` 替代它**。本 CLI 不会自动持久化登录会话 token。

只要配置了 Token，CLI 就会对所有 v2 请求附带它（登录/两步验证除外）；未配置时仍会尝试匿名读取。实测 ld246.com 对无 Token 的 `/api/v2/*` 请求普遍返回 401，因此除纯公开读取外建议始终配置 Token。

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

### 人类阅读

默认将上游响应格式化为 JSON 文本。错误写到 stderr：

```text
Error [AUTH_REQUIRED]: API token required. ...
```

### Agent / 自动化

在任意命令位置添加 `-j` 或 `--json`。stdout 始终只包含一个 JSON 对象：

```json
{
  "ok": true,
  "status": "success",
  "command": "articles.latest",
  "data": {
    "code": 0,
    "msg": "",
    "data": []
  }
}
```

`data` 保留完整上游响应，不丢字段。`status` 可能是 `success`、`dry-run`、`cancelled`、`error`。错误示例：

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

退出码：`0` 成功/预览/取消，`1` API/网络/运行错误，`2` 参数、配置或确认方式错误。HTTP 非 2xx 会报错；调用方还应检查上游 JSON 的 `code`。

## 写操作安全流程

发帖、更新、回帖、登录/登出、标记通知已读和技能安装均按写操作处理。

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
- `notifications read` 虽为 GET，仍会改变状态，必须按写操作确认。
- 官方说明 broadcast、wallet、sys-announce 通知拉取后自动已读，请注意这类读取的副作用。
- `--token`、密码、两步验证码、登录返回 token 不出现在预览或成功输出中。仍需自行保护终端和日志。

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

命令刻意保持简短：`article list|get|post|edit|source`、`comment post|edit`、`user me|get|articles|comments|events|watches|follows|tags|stars|followers`、`notice unread|<type>|read`、`domain|tag list|get`、`top newbies|followers`、`auth login|2fa|logout`、`time`。也支持别名 `a`/`c`/`u`/`n`/`dom`/`tags`/`tops`。完整参数见 `liandi <group> --help` 或 [技能命令参考](skills/liandi/references/commands.md)。

### 正文文件

`-c, --content <text>` 和 `-f, --content-file <path>` 二选一。默认 `--content-type markdown`；HTML 用 `--content-type html`。发帖/更新支持 `--reward-content`、`--reward-point`，更新另需从 `edit-source` 获取的 `--type`。

### 登录

```sh
liandi auth login -u <usernameOrEmail> --password-stdin --dry-run
# 实际登录前确认预览，然后使用交互确认或 --yes
liandi auth login -u <usernameOrEmail> --password-stdin
```

CLI 按官方要求本地计算密码 MD5 后发送。若服务端返回 `code=10`，其会话 token 只交给：

```sh
liandi auth 2fa --session-token <loginToken> --code <6位动态口令>
```

验证码需求由服务端返回；CLI 不猜测或自动下载验证码。

## Agent 技能

```sh
liandi skill install --dry-run
liandi skill install --yes
```

安装或覆盖更新 `~/.agents/skills/liandi`，不修改其他技能目录。技能包含安全操作规则、命令参考与评测用例。

## 开发

```sh
npm install
npm run typecheck
npm run build
npm test
npm run test:coverage
npm pack --dry-run
```

测试使用模拟函数和本地 HTTP 服务，不访问 ld246.com，不需要真实 Token。接口路径测试覆盖文档中的全部操作；构建产物执行公共读取、确认写入和未确认拒绝的端到端测试。

## 范围与限制

- 只实现官方文档明确支持的 v2 API，不添加文档外接口。
- 上游列表页大小固定为 20；`users events` 的 `size` 范围为 1–64。
- 请遵守官方使用原则，每个 IP 每分钟不超过 120 次请求；不要批量填充内容。
- 官方 v2 线上实现与当前开源 Symphony 仓库存在差异，本 CLI 以官方 v2 文档为接口依据。
- 尚未发布 npm；发布前 `npx liandi` 需要先将包发布到 npm registry。

## 开源

[MIT](LICENSE) © 2026 wmy2981。第三方依赖和 API 声明见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。本项目是独立客户端，与 ld246.com 无隶属或背书关系。
