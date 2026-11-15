# Live verification (2026-11-15)

Read paths and a minimal set of writes were exercised against the real ld246.com API with a real account token. No article was published and no article was edited.

## Confirmed against the live service

| Area | Result |
| --- | --- |
| `time`, `article list` (all five sorts), `--tag`, `--domain`, `article get`, `article source` | `code: 0`, real data |
| `domain list/get`, `tag list/get` | `code: 0`, real data |
| `user me`, `user get`, `user get --number`, `user articles/comments/events/watches/follows/tags/stars/followers` | `code: 0`, real data |
| `notice unread`, `notice commented/reply/at/following`, `notice read commented` | `code: 0` |
| `top newbies`, `top followers` | `code: 0`, real data |
| `comment post` on an own article | `code: 0`, comment created |
| `comment edit` with `--visible true` | `code: 0`, `commentVisible` went `0` → `1` |
| Unknown article/user | error envelope `API_CODE_1` with `Article not found` / `User not found`, exit 1 |
| Anonymous request | HTTP 401, so a token is required in practice even for nominally public endpoints |

## Response shapes worth knowing when parsing

- Every response carries an extra top-level `random` string besides `code`/`msg`/`data`; this CLI passes it through untouched.
- List endpoints return an object, not a bare array:
  - articles: `data.data = { pagination, articles: [...] }`
  - tags: `{ pagination, tags: [...] }`, domains: `{ pagination, domains: [...] }`
  - user articles/comments: `{ pagination, articles|comments: [...] }`
- Page size is 20 for paged lists (a page of `articles/latest` returned 20 items with `paginationPageCount: 2987`).
- `article get` returns `data.data = { pagination, article }`, where `article.articleComments` holds the comments and `article.articleContent` the body.
- `commentContent` comes back rendered as HTML (`<p>…</p>`), even when it was posted as Markdown.
- `comment post` returns only `{ code: 0 }`: it does not return the new comment id, so read the article back to find it.
- `article source` returns `article.articleContentType: null` for an article created as Markdown; pass `--content-type` explicitly when editing.
- `notice unread` returns a flat object of counters (`unreadNotificationCnt`, `unreadAtNotificationCnt`, …).

## Write safety observed in practice

`comment post` and `comment edit` each showed a preview first, then sent exactly one request after confirmation. `notice read commented` behaved as a write despite using GET upstream. No request was sent during `--dry-run` runs.

## Cleanup note

The API documented here has no delete endpoint for comments or articles. A test comment created during this verification must be removed manually through the web interface if it should not stay: comment id `1794748879013` on article `1793524162099`. It was set to author-only (`commentVisible: 1`) so other users do not see it.
