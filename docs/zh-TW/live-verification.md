# 真實環境驗證（2026-11-15）

[简体中文](../zh-CN/live-verification.md) | 繁體中文 | [English](../live-verification.md)

使用真實帳號 Token 對線上 ld246.com API 驗證了全部唯讀路徑與最小寫入操作集合，未發布或修改任何貼文。

## 線上實測確認項目

| 範圍 | 結果 |
| --- | --- |
| `time`、`article list`（全部 5 種排序）、`--tag`、`--domain`、`article get`、`article source` | `code: 0`，回傳真實資料 |
| `domain list/get`、`tag list/get` | `code: 0`，回傳真實資料 |
| `user me`、`user get`、`user get --number`、`user articles/comments/events/watches/follows/tags/stars/followers` | `code: 0`，回傳真實資料 |
| `notice unread`、`notice commented/reply/at/following`、`notice read commented` | `code: 0` |
| `top newbies`、`top followers` | `code: 0`，回傳真實資料 |
| 在自己貼文下執行 `comment post` | `code: 0`，成功建立回覆 |
| 執行 `comment edit --visible true` | `code: 0`，`commentVisible` 由 `0` 變為 `1` |
| 不存在的貼文/使用者 | 錯誤信封 `API_CODE_1`（`Article not found` / `User not found`），結束碼 `1` |
| 匿名請求 | HTTP 401，因此即使是名義上公開的介面，實務上仍需要 Token |

## 解析回應時須注意的結構細節

- 除 `code`/`msg`/`data` 外，每次回應頂層還會附帶一個 `random` 欄位；CLI 原樣透傳。
- 列表介面回傳的是物件而非裸陣列：
  - 貼文：`data.data = { pagination, articles: [...] }`
  - 標籤：`{ pagination, tags: [...] }`，領域：`{ pagination, domains: [...] }`
  - 使用者貼文/回覆：`{ pagination, articles|comments: [...] }`
- 分頁列表每頁固定 20 筆（例如 `articles/latest` 單頁回傳 20 筆，`paginationPageCount: 2987`）。
- `article get` 回傳 `data.data = { pagination, article }`，回覆位於 `article.articleComments`，內文位於 `article.articleContent`。
- `commentContent` 回傳的始終是渲染後的 HTML（`<p>…</p>`），即使送出時使用 Markdown。
- `comment post` 僅回傳 `{ code: 0 }`，不回傳新建回覆 ID；如需 ID 須重新讀取貼文。
- `article source` 對 Markdown 建立的貼文可能回傳 `article.articleContentType: null`，編輯時請明確傳入 `--content-type`。
- `notice unread` 回傳扁平計數欄位物件（`unreadNotificationCnt`、`unreadAtNotificationCnt` 等）。

## 實測寫入安全行為

`comment post` 與 `comment edit` 皆先顯示預覽，確認後僅送出一次請求。`notice read commented` 雖於上游使用 GET，但視為寫入操作處理。`--dry-run` 全程未送出任何請求。

## 清理紀錄

本文件涵蓋的 v2 API 不提供刪除貼文或刪除回覆介面。本次驗證在貼文 `1793524162099` 下建立的測試回覆 `1794748879013` 已設為僅作者可見（`commentVisible: 1`）；如需徹底刪除請於網頁端操作。
