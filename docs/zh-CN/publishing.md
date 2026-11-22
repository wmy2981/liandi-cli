# 发布说明

简体中文 | [繁體中文](../zh-TW/publishing.md) | [English](../publishing.md)

发布由 Git Tag 驱动。向 `main` 分支上的提交推送 `vMAJOR.MINOR.PATCH` tag 会自动发布到 npm 并创建 GitHub Release；普通分支推送永远不会触发发布。

手动触发 Release 工作流同样会执行发布，但仅允许从 `main` 或 release tag 触发；演练模式需显式勾选 `dry_run` 输入项。

## 版本策略

语义化版本约束两个稳定契约：CLI 接口面（命令、选项、退出码）与 JSON 输出信封，Agent 强依赖这两者。

| 变更类型 | 版本号递增 | 示例 |
| --- | --- | --- |
| 破坏性 CLI 或输出契约变更 | major | 重命名 `article list`、修改信封字段、修改退出码或错误码、移除选项 |
| 新增命令、选项或向后兼容的输出字段 | minor | 新增 `notice read`、新增 `--domain`、新增 `--lang`、在信封中增加 `hint` |
| 修复、文档、内部重构 | patch | Bug 修复、文案调整、依赖小版本升级 |

规则：

- `1.0.0` 之前，破坏性变更使用 **minor** 递增（`0.1` → `0.2`）；`1.0.0` 留待对外契约冻结后使用。
- `package.json`、`package-lock.json` 与 tag 必须一致，`scripts/check-version.mjs` 会在 CI 与发布守卫中强制检查。
- Tag 始终以 `v` 开头并由 `npm version` 生成带注释的 tag。
- 严禁移动或删除已发布的 tag，也不允许重复发布同一版本：发布任务会拒绝已存在于 npm registry 的版本号。
- 所有用户可见变更记录在 [CHANGELOG.md](../../CHANGELOG.md)。

## 执行发布

```sh
git switch main && git pull
npm run release:patch     # 或 release:minor / release:major
git push --follow-tags
```

`npm version` 会更新版本号、提交 `chore: release vX.Y.Z` 并创建对应 tag；`git push --follow-tags` 一并推送分支与 tag，触发 Release 工作流。

工作流执行步骤：

1. 校验 tag 指向的提交是否为 `origin/main` 祖先（会短暂重试，以兼容 GitHub 先投递 tag 事件、后完成分支更新的时序）。
2. 以 tag 名调用 `scripts/check-version.mjs`，版本不匹配会在构建前直接失败。
3. 执行类型检查（源码与测试）、测试套件、`scripts/verify.mjs` 与 `scripts/pack-check.mjs`。
4. 若 registry 已存在该版本，拒绝继续发布。
5. 使用 `--provenance` 发布至 npm，随后自动生成 Release Notes 并创建 GitHub Release。

## 一次性前置配置

- 在 npmjs.com → 包设置（Settings）→ **Trusted Publisher** 配置可信发布者：用户 `wmy2981`、仓库 `liandi-cli`、工作流文件 `release.yml`、环境 `npm`，允许 `npm publish`。GitHub 无需保存任何 npm token。
- Publish 任务绑定 `npm` 环境，如需人工审批可在该环境配置 required reviewers。
- Publish 任务使用 Node 24（自带 npm 11+），满足 OIDC Trusted Publishing 对 npm 11.5.1+ 的要求。
- 首个版本需从本机手动发布（`npm login --registry https://registry.npmjs.org` 后执行 `npm publish --registry https://registry.npmjs.org --access public`），因为只有在包已存在后才能配置 Trusted Publisher。
- Trusted Publisher 生效后，可在 npm 设置中开启 **Require two-factor authentication and disallow tokens**，禁止通过 token 发布。
- 细粒度 token（Read and write + 勾选 **Bypass 2FA**）仅作临时过渡方案（有效期最长 90 天，且 npm 计划于 2027 年 1 月移除）。传统 automation token 已于 2025 年底停用并撤销。

## 发布守卫行为（已验证）

| 场景 | 结果 |
| --- | --- |
| 从 `main` 手动触发且不勾选 `dry_run` | 发布当前 `package.json` 版本 |
| 手动触发并勾选 `dry_run` | 运行全部检查与 `npm pack --dry-run`，不发布 |
| 从特性分支手动触发且未勾选 `dry_run` | 任务失败：`Publishing is only allowed from main or from a release tag.` |
| Tag 不在 `main` 上 | 任务失败：`Tag commit is not on main. Merge to main before tagging.`，跳过构建与发布 |
| Tag 与 `package.json` 版本不一致 | 校验失败并跳过发布 |
| 版本已存在于 npm registry | 发布步骤中止：`Version … is already published. Bump the version first.` |

## 演练发布（Dry run）

在 GitHub Actions 中手动触发 `Release` 工作流并勾选 `dry_run`，可完整执行检查与 `npm pack --dry-run` 而不实际发布，适合验证流水线变更。

## 发布后核验

```sh
npx liandi@latest --version
npm view liandi version dist.tarball
```

## 跨平台说明

- `bin` 指向带 `#!/usr/bin/env node` 的 `dist/cli.js`，npm 会在 Windows 自动生成 `liandi.cmd` 与 `liandi.ps1`。
- CI 在 `ubuntu-latest`、`macos-latest` 与 `windows-latest` 上覆盖 Node 20 / 22 / 24 矩阵测试。
- 发布包仅包含 `dist/`、`skills/`、`docs/`、`CHANGELOG.md`、`README.md`、`README.zh-TW.md`、`README.en.md`、`LICENSE` 与 `THIRD_PARTY_NOTICES.md`；`scripts/pack-check.mjs` 会阻止源码或 `node_modules` 混入。
- 全局配置在 Windows 使用 `%APPDATA%`，其他系统使用 `$XDG_CONFIG_HOME`（默认 `~/.config`）。
