# Publishing

Maintainer notes for releasing `liandi` to npm so `npx liandi` and `npm install -g liandi` work on every platform.

## Prerequisites

- npm account with publish rights for the `liandi` name, 2FA enabled.
- Node.js 20+ locally.

```sh
npm login
npm whoami
```

## Pre-flight checks

```sh
npm run typecheck
npm test                    # 106 unit/integration tests
node scripts/verify.mjs     # 113 checks across every command and flag
node scripts/pack-check.mjs # builds the tarball, installs it, runs the binary
```

`prepublishOnly` runs typecheck, tests and the pack check again, so a broken package cannot be published by accident.

## Version and publish

```sh
npm version patch|minor|major   # updates package.json and creates a git tag
git push --follow-tags
npm publish                     # publishConfig.access is public
```

Verify from a clean directory afterwards:

```sh
npx liandi@latest --version
npx liandi@latest article list -j
npm view liandi version dist.tarball
```

## Cross-platform notes

- `bin` points at `dist/cli.js`, which starts with `#!/usr/bin/env node`; npm generates the `liandi.cmd` and `liandi.ps1` shims on Windows automatically.
- CI runs the test suite on ubuntu-latest, macos-latest and windows-latest for Node 20, 22 and 24, plus a tarball install job, so platform regressions show up before publishing.
- The published package ships only `dist/`, `skills/`, `README.md`, `LICENSE` and `THIRD_PARTY_NOTICES.md`. `scripts/pack-check.mjs` fails if sources or `node_modules` sneak in.
- Global config uses `%APPDATA%` on Windows and `$XDG_CONFIG_HOME` (or `~/.config`) elsewhere.

## If the name is taken

`liandi` was unclaimed on the registry as of 2026-11-15. If that changes, publish as `liandi-cli` while keeping `bin` as `liandi`, so the command stays the same:

```json
{ "name": "liandi-cli", "bin": { "liandi": "./dist/cli.js" } }
```
