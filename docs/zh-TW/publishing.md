# 發布說明

[简体中文](../zh-CN/publishing.md) | 繁體中文 | [English](../publishing.md)

發布由 Git Tag 驅動。向 `main` 分支上的提交推送 `vMAJOR.MINOR.PATCH` tag 會自動發布至 npm 並建立 GitHub Release；一般分支推送永遠不會觸發發布。

手動觸發 Release 工作流程同樣會執行發布，但僅允許從 `main` 或 release tag 觸發；若需演練模式，請明確勾選 `dry_run` 輸入項目。

## 版本策略

語意化版本約束兩項穩定契約：CLI 介面（命令、選項、結束碼）與 JSON 輸出信封，Agent 高度依賴這兩者。

| 變更類型 | 版本號遞增 | 範例 |
| --- | --- | --- |
| 破壞性 CLI 或輸出契約變更 | major | 重新命名 `article list`、修改信封欄位、修改結束碼或錯誤碼、移除選項 |
| 新增命令、選項或向後相容的輸出欄位 | minor | 新增 `notice read`、新增 `--domain`、新增 `--lang`、於信封中增加 `hint` |
| 修復、文件、內部重構 | patch | 錯誤修復、文案調整、相依套件小版本升級 |

規則：

- `1.0.0` 之前，破壞性變更採用 **minor** 遞增（`0.1` → `0.2`）；`1.0.0` 留待對外契約凍結後使用。
- `package.json`、`package-lock.json` 與 tag 必須一致，`scripts/check-version.mjs` 會在 CI 與發布守衛中強制檢查。
- Tag 一律以 `v` 開頭並由 `npm version` 建立附註 tag。
- 嚴禁移動或刪除已發布的 tag，亦不允許重複發布同一版本：發布工作會拒絕已存在於 npm registry 的版本號。
- 所有使用者可見變更皆記錄於 [CHANGELOG.md](../../CHANGELOG.md)。

## 執行發布

```sh
git switch main && git pull
npm run release:patch     # 或 release:minor / release:major
git push --follow-tags
```

`npm version` 會更新版本號、提交 `chore: release vX.Y.Z` 並建立對應 tag；`git push --follow-tags` 一併推送分支與 tag，觸發 Release 工作流程。

工作流程執行步驟：

1. 檢查 tag 指向的提交是否為 `origin/main` 祖先（會短暫重試，以因應 GitHub 先送達 tag 事件、後完成分支更新的時序）。
2. 以 tag 名稱呼叫 `scripts/check-version.mjs`，版本不符會在建置前直接失敗。
3. 執行型別檢查（原始碼與測試）、測試套件、`scripts/verify.mjs` 與 `scripts/pack-check.mjs`。
4. 若 registry 已存在該版本，拒絕繼續發布。
5. 使用 `--provenance` 發布至 npm，隨後自動產生 Release Notes 並建立 GitHub Release。

## 一次性前置設定

- 於 npmjs.com → 套件設定（Settings）→ **Trusted Publisher** 設定可信發布者：使用者 `wmy2981`、儲存庫 `liandi-cli`、工作流程檔案 `release.yml`、環境 `npm`，允許 `npm publish`。GitHub 不需保存任何 npm token。
- Publish 工作綁定 `npm` 環境，如需人工審查可於該環境設定 required reviewers。
- Publish 工作使用 Node 24（內建 npm 11+），符合 OIDC Trusted Publishing 對 npm 11.5.1+ 的需求。
- 首個版本須由本機手動發布（`npm login --registry https://registry.npmjs.org` 後執行 `npm publish --registry https://registry.npmjs.org --access public`），因套件存在後才能設定 Trusted Publisher。
- Trusted Publisher 生效後，可於 npm 設定啟用 **Require two-factor authentication and disallow tokens**，停用以 token 發布。
- 細粒度 token（Read and write + 勾選 **Bypass 2FA**）僅供暫時過渡（效期最長 90 天，npm 預計於 2027 年 1 月移除）。傳統 automation token 已於 2025 年底停用並撤銷。

## 發布守衛行為（已驗證）

| 情境 | 結果 |
| --- | --- |
| 從 `main` 手動觸發且未勾選 `dry_run` | 發布目前 `package.json` 版本 |
| 手動觸發並勾選 `dry_run` | 執行全部檢查與 `npm pack --dry-run`，不發布 |
| 從功能分支手動觸發且未勾選 `dry_run` | 工作失敗：`Publishing is only allowed from main or from a release tag.` |
| Tag 不在 `main` 上 | 工作失敗：`Tag commit is not on main. Merge to main before tagging.`，略過建置與發布 |
| Tag 與 `package.json` 版本不一致 | 檢查失敗並略過發布 |
| 版本已存在於 npm registry | 發布步驟中止：`Version … is already published. Bump the version first.` |

## 演練發布（Dry run）

於 GitHub Actions 手動觸發 `Release` 工作流程並勾選 `dry_run`，可完整執行檢查與 `npm pack --dry-run` 而不實際發布，適合驗證流水線變更。

## 發布後核驗

```sh
npx liandi@latest --version
npm view liandi version dist.tarball
```

## 跨平台說明

- `bin` 指向含 `#!/usr/bin/env node` 的 `dist/cli.js`，npm 會於 Windows 自動產生 `liandi.cmd` 與 `liandi.ps1`。
- CI 在 `ubuntu-latest`、`macos-latest` 與 `windows-latest` 上執行 Node 20 / 22 / 24 矩陣測試。
- 發布套件僅包含 `dist/`、`skills/`、`docs/`、`CHANGELOG.md`、`README.md`、`README.zh-TW.md`、`README.en.md`、`LICENSE` 與 `THIRD_PARTY_NOTICES.md`；`scripts/pack-check.mjs` 會阻止原始碼或 `node_modules` 混入。
- 全域設定在 Windows 使用 `%APPDATA%`，其他系統使用 `$XDG_CONFIG_HOME`（預設 `~/.config`）。
