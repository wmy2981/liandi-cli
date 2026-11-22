# 真实环境验证（2026-11-15）

简体中文 | [繁體中文](../zh-TW/live-verification.md) | [English](../live-verification.md)

使用真实账号 Token 对线上 ld246.com API 验证了全部只读路径与最小写操作集合，未发布或修改任何帖子。

## 线上实测确认项

| 范围 | 结果 |
| --- | --- |
| `time`、`article list`（全部 5 种排序）、`--tag`、`--domain`、`article get`、`article source` | `code: 0`，返回真实数据 |
| `domain list/get`、`tag list/get` | `code: 0`，返回真实数据 |
| `user me`、`user get`、`user get --number`、`user articles/comments/events/watches/follows/tags/stars/followers` | `code: 0`，返回真实数据 |
| `notice unread`、`notice commented/reply/at/following`、`notice read commented` | `code: 0` |
| `top newbies`、`top followers` | `code: 0`，返回真实数据 |
| 在自己帖子下执行 `comment post` | `code: 0`，成功创建回帖 |
| 执行 `comment edit --visible true` | `code: 0`，`commentVisible` 由 `0` 变为 `1` |
| 不存在的帖子/用户 | 错误信封 `API_CODE_1`（`Article not found` / `User not found`），退出码 `1` |
| 匿名请求 | HTTP 401，因此即使是名义上公开的接口，实操中也需要 Token |

## 解析响应时需注意的结构细节

- 除 `code`/`msg`/`data` 外，每次响应顶层还会多一个 `random` 字段；CLI 原样透传。
- 列表接口返回的是对象而非裸数组：
  - 帖子：`data.data = { pagination, articles: [...] }`
  - 标签：`{ pagination, tags: [...] }`，领域：`{ pagination, domains: [...] }`
  - 用户帖子/回帖：`{ pagination, articles|comments: [...] }`
- 分页列表每页固定 20 条（例如 `articles/latest` 单页返回 20 条，`paginationPageCount: 2987`）。
- `article get` 返回 `data.data = { pagination, article }`，回帖在 `article.articleComments`，正文在 `article.articleContent`。
- `commentContent` 返回的始终是渲染后的 HTML（`<p>…</p>`），即使发帖时提交的是 Markdown。
- `comment post` 仅返回 `{ code: 0 }`，不返回新建回帖 ID；如需 ID 需重新读取帖子。
- `article source` 对 Markdown 创建的帖子可能返回 `article.articleContentType: null`，编辑时请显式传 `--content-type`。
- `notice unread` 返回扁平计数字段对象（`unreadNotificationCnt`、`unreadAtNotificationCnt` 等）。

## 实测写操作安全行为

`comment post` 与 `comment edit` 均先展示预览，确认后仅发出一次请求。`notice read commented` 虽在上游使用 GET，但按写操作处理。`--dry-run` 全程未发出任何请求。

## 清理记录

本文档覆盖的 v2 API 不提供删帖或删回帖接口。本次验证在帖子 `1793524162099` 下创建的测试回帖 `1794748879013` 已设为仅作者可见（`commentVisible: 1`）；如需彻底删除请通过网页端操作。
