# 鉴权说明

简体中文 | [繁體中文](../zh-TW/authentication.md) | [English](../authentication.md)

于 2026-11-15 对照[官方 v2 API 文档](https://ld246.com/article/1488603534762)与公开上游源码核验。

- 常规 v2 API 鉴权方式为 `Authorization: token <API Token>`，Token 取自[账号设置页面](https://ld246.com/settings/account)。它不是 Bearer 认证方案。
- API Token 是本 CLI 使用的唯一凭据。按 `--token`、`LIANDI_TOKEN`、`./.env`、`~/.config/liandi/.env`（Windows 下为 `%APPDATA%\liandi\.env`）的优先级解析，配置后会在每次请求中附带。
- `POST /api/v2/login` 与 `POST /api/v2/login/2fa` 返回的是用于 `Cookie: symphony=<session token>` 的**会话**凭据，它不是 API Token，也无法替代 `LIANDI_TOKEN`。因此本 CLI 不实现登录接口，登录请走网页端。
- 当前开源 Symphony 的 `master` 分支已不包含 v2 API 处理器及 API Token 校验逻辑，其当前网页 Cookie 名称也与 v2 兼容契约不同；因此本客户端不会从现有网页路由反推 ld246.com v2 行为。
- 当前 v2 行为严格遵循官方 v2 文档；若文档未提供某项能力，直接明确告知而非用无关接口猜测。

参考来源：

- 官方 API 文档：https://ld246.com/article/1488603534762
- Symphony 会话生成：https://github.com/88250/symphony/blob/c3e204806f98410d7f8484825de4ef9f85c13f9f/src/main/java/org/b3log/symphony/util/Sessions.java#L308-L343
- 登录返回会话 Token：https://github.com/88250/symphony/blob/c3e204806f98410d7f8484825de4ef9f85c13f9f/src/main/java/org/b3log/symphony/processor/LoginProcessor.java#L691-L700
