# 驗證說明

[简体中文](../zh-CN/authentication.md) | 繁體中文 | [English](../authentication.md)

於 2026-11-15 對照[官方 v2 API 文件](https://ld246.com/article/1488603534762)與公開上游原始碼核驗。

- 一般 v2 API 驗證方式為 `Authorization: token <API Token>`，Token 取自[帳號設定頁面](https://ld246.com/settings/account)。這並非 Bearer 驗證方案。
- API Token 是本 CLI 使用的唯一憑證。依 `--token`、`LIANDI_TOKEN`、`./.env`、`~/.config/liandi/.env`（Windows 為 `%APPDATA%\liandi\.env`）的優先順序解析，設定後會隨每次請求附帶。
- `POST /api/v2/login` 與 `POST /api/v2/login/2fa` 回傳的是用於 `Cookie: symphony=<session token>` 的**工作階段**憑證，並非 API Token，亦無法替代 `LIANDI_TOKEN`。因此本 CLI 不實作登入介面，登入請使用網頁端。
- 現行開源 Symphony 的 `master` 分支已不含 v2 API 處理器與 API Token 驗證邏輯，其現行網頁 Cookie 名稱亦與 v2 相容契約不同；因此本用戶端不從現行網頁路由推斷 ld246.com v2 行為。
- 目前 v2 行為嚴格遵循官方 v2 文件；文件未提供的能力會明確回報，而非以無關介面猜測。

參考來源：

- 官方 API 文件：https://ld246.com/article/1488603534762
- Symphony 工作階段產生：https://github.com/88250/symphony/blob/c3e204806f98410d7f8484825de4ef9f85c13f9f/src/main/java/org/b3log/symphony/util/Sessions.java#L308-L343
- 登入回傳工作階段 Token：https://github.com/88250/symphony/blob/c3e204806f98410d7f8484825de4ef9f85c13f9f/src/main/java/org/b3log/symphony/processor/LoginProcessor.java#L691-L700
