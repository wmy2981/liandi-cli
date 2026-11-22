# liandi

[简体中文](README.md) | 繁體中文 | [English](README.en.md)

面向人類與 Agent 的 [鏈滴 ld246.com](https://ld246.com) 命令列用戶端。以 TypeScript 實作，涵蓋[官方社群用戶端 API 文件](https://ld246.com/article/1488603534762)列出的所有操作。

## 特性

- 完整支援貼文、回覆、領域、標籤、使用者、通知、排行榜與系統時間介面。
- 預設人類可讀輸出：列表呈現為表格或區塊，詳情呈現為欄位摘要；`--format json`（簡寫 `-j`）提供統一、穩定的機器可讀信封。
- 終端輸出與文件支援簡體中文（`zh-CN`）、繁體中文（`zh-TW`）與英語（`en`），自動偵測系統語言並支援 `--lang` / `LIANDI_LANG` 覆寫；JSON 輸出維持語言無關。
- 表格依終端寬度自適應，中文字元以雙寬計算，不會將一行擠成兩行。
- 寫入操作預設先顯示請求預覽，再進行互動確認；`-d, --dry-run` 僅預覽，`-y, --yes` 確認執行。
- `--content` 內嵌內容或 `--content-file` 讀取 UTF-8 Markdown/HTML 檔案。
- 多層設定獨立管理 API Token，日誌與預覽不輸出憑證。
- 內建 `liandi/<version>` User-Agent，可安裝 Agent 技能。
- Node.js 20+，跨平台支援 Windows / macOS / Linux，執行時期僅相依 Commander。
- 遵循語意化版本，推送 tag 觸發發布；CI 涵蓋三平台 × Node 20/22/24 與封裝安裝驗證。

## 安裝與執行

需要 Node.js 20 或以上版本，支援 Windows、macOS 與 Linux。

```sh
# 免安裝直接執行（npx 會拉取最新版）
npx liandi --help

# 或全域安裝，之後直接執行 liandi
npm install -g liandi
liandi --help
```

### 各平台設定位置

| 平台 | 全域 `.env` 路徑 |
| --- | --- |
| Linux / macOS | `$XDG_CONFIG_HOME/liandi/.env`，未設定時為 `~/.config/liandi/.env` |
| Windows | `%APPDATA%\liandi\.env`（無 `APPDATA` 時回退至 `~/.config/liandi/.env`） |

目前目錄的 `./.env` 優先於全域設定；`.env` 支援 CRLF 與 BOM（Windows 編輯器常見）。

Windows PowerShell 暫時指定 token：

```powershell
$env:LIANDI_TOKEN = "你的 API Token"
liandi user me -j
```

長期使用請寫入 `.env` 並收緊檔案權限，避免 token 進入命令歷史。

### 原始碼開發

```sh
git clone https://github.com/wmy2981/liandi-cli.git
cd liandi-cli
npm install && npm run build
npm link          # 之後可全域執行 liandi
# 或直接執行：node dist/cli.js --help
```

## API Token 與驗證

於 [鏈滴設定 - 帳號](https://ld246.com/settings/account) 取得 **API Token**。一般 API 請求使用：

```http
Authorization: token <API Token>
```

這不是 `Bearer` 驗證，也不是網頁登入的 `symphony` Cookie 工作階段。本 CLI 僅使用 API Token：帳號密碼登入（`/api/v2/login`、`/api/v2/login/2fa`）回傳的工作階段 token 只在兩步驟驗證流程有效，無法當作 API Token 使用，因此 `auth` 命令群組已移除，登入請透過網頁端操作。詳見 [docs/zh-TW/authentication.md](docs/zh-TW/authentication.md)。

只要設定了 Token，CLI 就會在所有 v2 請求中附帶它；未設定時仍會嘗試匿名讀取。實測 ld246.com 對無 Token 的 `/api/v2/*` 請求普遍回傳 401，因此建議一律設定 Token。

Token 來源優先順序由高至低：

1. `-t, --token <API Token>`
2. 處理程序環境變數 `LIANDI_TOKEN`
3. 目前工作目錄 `.env` 中的 `LIANDI_TOKEN`
4. `$XDG_CONFIG_HOME/liandi/.env`；未設定 XDG 時為 `~/.config/liandi/.env`

建議使用受保護的 `.env` 檔案，而非可能留在 shell 歷史或處理程序列表中的 `--token`：

```sh
cp .env.example .env
chmod 600 .env
# 編輯 .env，填入 LIANDI_TOKEN
```

`.env` 已加入 `.gitignore`。支援 `KEY=value`、單/雙引號、`export KEY=value` 與註解，不執行 shell 運算式。`LIANDI_BASE_URL` 或 `-b, --base-url` 可指定私有/測試伺服器，預設 `https://ld246.com`。

## 輸出約定

### 人類閱讀（預設）

預設 `--format human`：列表命令渲染為表格或精簡區塊，詳情命令渲染為欄位摘要，在管線中亦同。錯誤輸出至 stderr：

```text
錯誤 [AUTH_REQUIRED]：需要 API Token。請透過 --token、LIANDI_TOKEN、./.env 或 ~/.config/liandi/.env 設定
```

貼文列表每則三行（標題 / 作者·時間·回覆·瀏覽 / 連結）：

```text
 1. 為什麼複製後游標會跑到行首？
    inessence · 2026-11-22 11:27:13 · 6 回覆 · 10 瀏覽
    https://ld246.com/article/1795318034189

本頁 20 則 · 共 2991 頁
```

短欄位列表（使用者、標籤、領域）使用對齊表格，依終端寬度收縮，中文以雙寬計算：

```text
使用者名稱       暱稱    文章  回覆  積分  主頁
───────────────  ──────  ────  ────  ────  ─────────────────────────────────────────────────────
yoss             Yoss        6   167  2270  https://ld246.com/member/yoss
```

`user me`、`article get`、`tag get`、`domain get` 輸出欄位摘要與分段內文/簡介。若上游結構變更導致無法識別，會自動退化為僅輸出 `data` 的 JSON，不會印出半空表格。

### 明確選擇格式

```sh
liandi article list                  # 人類可讀（預設）
liandi article list --format human   # 同上，明確指定
liandi article list --format json    # 穩定信封
liandi article list -j               # 等同於 --format json
```

`--format json` 與 `-j` 輸出完全一致；`-j --format human` 這類衝突組合會以 `INVALID_INPUT`（結束碼 2）拒絕。

### 語言設定（i18n）

終端輸出（說明資訊、人類可讀列表/摘要、狀態提示、互動確認與錯誤提示）支援三種語言：`zh-CN`（簡體中文）、`zh-TW`（繁體中文）與 `en`（English）。

```sh
liandi article list --lang zh-CN
liandi article list --lang zh-TW
liandi article list --lang en
liandi --help --lang zh-TW
```

語言偵測優先順序由高至低：

1. `--lang <locale>`（支援標準標籤與常見別名，如 `zh-CN`/`zh-Hans`/`zh`、`zh-TW`/`zh-HK`/`zh-Hant`、`en`/`en-US`）
2. 處理程序環境變數 `LIANDI_LANG`
3. POSIX 環境變數 `LC_ALL` > `LC_MESSAGES` > `LANG`
4. 系統地區設定（Windows / macOS / Linux 自動識別），未命中時回退為 `en`

`--format json`（`-j`）輸出始終維持語言無關，不受 `--lang` 或系統語言影響，以確保指令碼與 Agent 解析契約穩定。

### 彩色終端

互動終端僅對狀態列與提示著色：錯誤為紅色，預覽/取消為黃色，附加提示為青色；回應資料保持純文字，`-j` 輸出永遠不含 ANSI 跳脫序列。

顏色依 stdout、stderr 分別偵測 TTY 自動啟用，也可用 `--color auto|always|never` 或 `--no-color` 控制。優先順序：命令列參數 > `FORCE_COLOR`（`0`/`false` 停用，其餘啟用）> `NO_COLOR`（非空即停用）> TTY 偵測。

### Agent / 自動化

在任意命令位置加上 `--format json`、`-j` 或 `--json`。stdout 始終僅包含單一 JSON 物件：

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

`data` 保留完整上游回應，不遺失欄位。`status` 可能為 `success`、`dry-run`、`cancelled`、`error`。無論成功、預覽或失敗，stdout 僅輸出單一 JSON 物件：寫入操作在互動確認時的預覽會寫入 stderr；非互動環境下缺少 `--yes` 時，預覽會置於錯誤物件的 `details`。錯誤範例：

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

結束碼：`0` 成功/預覽/取消，`1` 上游業務錯誤/網路/執行期錯誤，`2` 參數、設定或確認方式錯誤。

錯誤分為三層，都會轉為上述錯誤信封：

1. HTTP 非 2xx（如 401/403/5xx）或回應非 JSON；
2. **上游 JSON `code != 0`**（HTTP 200 但業務失敗），錯誤碼為 `API_CODE_<code>`，`message` 取上游 `msg`；
3. 本機參數/設定錯誤。

## 寫入操作安全流程

發布貼文、更新貼文、回覆、標記通知已讀與技能安裝皆視為寫入操作。

```sh
# 1. 僅預覽，不傳送請求
liandi article post \
  --title "命令列工具發布" \
  --tags "CLI,Markdown" \
  --content-file ./post.md \
  --dry-run

# 2. 在互動終端預覽並手動輸入 y
liandi article post --title "命令列工具發布" \
  --tags "CLI,Markdown" --content-file ./post.md

# 3. 無人值守：先審閱上述預覽，再對同一命令加上 --yes
liandi article post --title "命令列工具發布" \
  --tags "CLI,Markdown" --content-file ./post.md --yes --json
```

- `--dry-run` 不建立網路請求，也不自動傳送後續確認請求，且**不需要已設定 Token**，可先審閱預覽再準備憑證。
- 實際傳送前才會檢查 Token：缺少 Token 時會在送出任何請求前以 `AUTH_REQUIRED`（結束碼 2）失敗。
- 未帶 `--yes` 時會顯示預覽並等待 `y`/`yes`；其他回答視為取消。
- 非 TTY 環境未提供 `--yes` 會拒絕執行，不會卡在等待輸入。
- `--dry-run` 與 `--yes` 僅適用於寫入操作，避免讓讀取命令的實際行為含糊。
- `notice read` 雖為 GET，仍會改變狀態，必須按寫入操作確認。
- 官方說明 broadcast、wallet、sys-announce 通知拉取後會自動標為已讀，請留意此類讀取的副作用。
- API Token 不會出現在預覽或成功輸出中：預覽僅包含 `method`、`url` 與請求內容。仍需自行保護終端與日誌。

## 常用操作

```sh
# 最新、熱議、好評、最近回覆、優選貼文
liandi article list --sort hot --page 1
liandi article list --tag Java --sort perfect
liandi article list --domain Java
liandi article get 1488603534762 --page 1

# 更新前取得完整原文與 articleType
liandi article source 1488603534762
liandi article edit 1488603534762 \
  --title "標題" --tags "CLI,Markdown" --type 0 --content-file post.md

# 回覆與回覆指定留言
liandi comment post 1488603534762 --content-file reply.md
liandi comment post 1488603534762 -c "回覆內容" --reply-to 1488603534763
liandi comment edit 1488603534763 -c "新內容" --visible false

# 使用者、領域與標籤
liandi user me --json
liandi user get 88250
liandi user get 1 --number
liandi user events 88250 --size 16
liandi user followers 88250 --page 1
liandi domain list
liandi tag get Java

# 通知、排行榜與系統
liandi notice unread
liandi notice at --page 1
liandi notice read at --dry-run
liandi top followers
liandi time
```

命令刻意保持簡短：`article list|get|post|edit|source`、`comment post|edit`、`user me|get|articles|comments|events|watches|follows|tags|stars|followers`、`notice unread|<type>|read`、`domain|tag list|get`、`top newbies|followers`、`time`。也支援別名 `a`/`c`/`u`/`n`/`dom`/`tags`/`tops`。完整參數見 `liandi <group> --help` 或 [技能命令參考](skills/liandi/references/commands.md)。

### 內文檔案

`-c, --content <text>` 與 `-f, --content-file <path>` 二選一。預設 `--content-type markdown`；HTML 請用 `--content-type html`。發布/更新支援 `--reward-content`、`--reward-point`，更新另需從 `article source` 取得的 `--type`。更新為整體覆蓋：標題、標籤、內文與激勵區皆會依本次命令的值重新送出。

## Agent 技能

```sh
liandi skill install --dry-run
liandi skill install --yes
```

安裝或覆蓋更新 `~/.agents/skills/liandi`，不修改其他技能目錄。技能包含安全操作規則與命令參考（評測用例放在儲存庫的 `evals/` 目錄，不會隨套件安裝）。

## 開發

```sh
npm install
npm run typecheck
npm run build
npm test
npm run test:coverage
node scripts/verify.mjs        # 全命令/全參數離線驗證
npm pack --dry-run
```

`node scripts/verify.mjs` 會啟動本機模擬伺服器，逐項驗證全部命令、參數、確認流程、輸出格式、多語言切換、憑證優先順序與錯誤對應，CI 每次提交都會執行。

單元與整合測試皆使用模擬函式與本機 HTTP 伺服器，不存取 ld246.com，不需要真實 Token。介面路徑測試涵蓋文件中的全部操作；建置產物執行公開讀取、確認寫入與未確認拒絕的端對端測試。

## 真實環境驗證

部分唯讀介面與最小寫入操作已在真實環境驗證，結論（含回傳結構細節、錯誤碼對應、匿名存取遭拒）見 [docs/zh-TW/live-verification.md](docs/zh-TW/live-verification.md)（驗證說明見 [docs/zh-TW/authentication.md](docs/zh-TW/authentication.md)）。

## 不提供的能力

僅實作官方 v2 文件列出的介面，文件沒有的一律不提供。以下常見需求**無法以本 CLI 完成**，請勿嘗試或以其他介面拼湊：

| 需求 | 狀態 | 原因 |
| --- | --- | --- |
| 刪除貼文 / 刪除回覆 | 不提供 | 官方 v2 文件無刪除介面；僅能於網頁端手動刪除 |
| 按讚 / 感謝 / 反對（good、bad、thank） | 不提供 | 無公開 v2 介面，僅有統計欄位 |
| 收藏 / 取消收藏、關注 / 取消關注 | 不提供 | 僅能讀取相關列表，無寫入介面 |
| 投票 / 懸賞相關寫入操作 | 不提供 | 無公開 v2 介面 |
| 搜尋貼文、使用者、標籤 | 不提供 | 官方文件未收錄搜尋介面 |
| 上傳圖片 / 附件 / 頭像 | 不提供 | 無公開 v2 上傳介面 |
| 修改暱稱、頭像、簽名、密碼、電子郵件 | 不提供 | 屬於設定頁介面，未包含於用戶端 API 文件中 |
| 積分轉帳、簽到、兌換邀請碼 | 不提供 | 無公開 v2 介面 |
| 私訊 / 聊天對話 | 不提供 | 無公開 v2 介面 |
| `auth login` / `2fa` / `logout` | 已移除 | 帳號密碼登入僅回傳一次性工作階段，不產生可重複使用的 API 憑證；呼叫 API 僅使用 API Token，登入請走網頁端 |
| 自訂每頁筆數 | 不提供 | 伺服器固定為 20，僅能翻頁 |

可執行的寫入僅有：發布貼文、編輯貼文（自己的）、發布回覆、編輯回覆（自己的）、標記通知已讀。其餘皆為唯讀。

## 範圍與限制

- 僅實作官方文件明確支援的 v2 API，不新增文件外介面；刪除、按讚、收藏等未收錄能力見上表。
- 上游列表每頁固定 20 筆；`users events` 的 `size` 範圍為 1–64。
- 請遵守官方使用原則，每個 IP 每分鐘不超過 120 次請求；請勿批次灌水內容。
- 官方 v2 線上實作與現行開源 Symphony 儲存庫存在差異，本 CLI 以官方 v2 文件為介面依據。

## 版本與發布

遵循語意化版本，`vX.Y.Z` tag 推送到 `main` 會自動發布至 npm 並建立 GitHub Release。手動觸發 Release 工作流程預設同樣發布（僅允許從 `main` 或 release tag 觸發），若需演練請明確勾選 `dry_run`。一般分支推送僅執行測試。版本號、發布步驟與 npm 設定見 [docs/zh-TW/publishing.md](docs/zh-TW/publishing.md)，變更紀錄見 [CHANGELOG.md](CHANGELOG.md)。

```sh
npm run release:patch   # 或 release:minor / release:major
git push --follow-tags  # 觸發 Release 工作流程
```

## 開源

[MIT](LICENSE) © 2026 wmy2981。第三方相依套件與 API 聲明見 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。本專案為獨立用戶端，與 ld246.com 無隸屬或背書關係。
