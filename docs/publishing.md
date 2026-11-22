# Publishing

Releases are tag-driven. Pushing a `vMAJOR.MINOR.PATCH` tag that points at a commit on `main` publishes to npm and creates a GitHub release. Ordinary branch pushes never publish.

Manually running the Release workflow also publishes, but only from `main` or from a release tag; a dry run has to be requested explicitly with the `dry_run` input.

## Version policy

Semver applies to two things: the CLI surface (commands, flags, exit codes) and the JSON output envelope. Use them as the contract, since agents depend on both.

| Change | Bump | Examples |
| --- | --- | --- |
| Breaking CLI or output contract | major | renaming `article list`, changing the envelope fields, changing exit codes or error codes, removing a flag |
| New command, flag, or additive output field | minor | adding `notice read`, adding `--domain`, adding `hint` to a payload |
| Fixes, docs, internal refactors | patch | bug fixes, wording, dependency bumps |

Rules:

- `package.json`, `package-lock.json` and the tag must agree. `scripts/check-version.mjs` enforces this and runs in CI and in the release guard.
- Tags are always `v`-prefixed and annotated by `npm version`.
- Never move or delete a published tag, and never publish the same version twice: the release job refuses an existing version on the registry.
- Record user-visible changes in [CHANGELOG.md](../CHANGELOG.md).

## Cutting a release

```sh
git switch main && git pull
npm run release:patch     # or release:minor / release:major
git push --follow-tags
```

`npm version` writes the version, commits `chore: release vX.Y.Z`, and creates the matching tag. `git push --follow-tags` pushes both, which starts the release workflow.

The workflow then:

1. Refuses to continue unless the tag commit is an ancestor of `origin/main` (it retries briefly, because GitHub can deliver the tag event before the branch update).
2. Runs `scripts/check-version.mjs` with the tag name, so a mismatched version fails before anything is built.
3. Runs typecheck (sources and tests), the test suite, `scripts/verify.mjs` and `scripts/pack-check.mjs`.
4. Refuses to publish a version that already exists on the registry.
5. Publishes with `--provenance`, then creates a GitHub release with generated notes.

## Required setup (once)

- Repository secret `NPM_TOKEN`: a **granular access token** with Read and write permission for `All packages`, created on npmjs.com → Access Tokens. Without it the publish step fails; everything before it still runs.
- Environment `npm` is referenced by the publish job. Add required reviewers there if you want a manual gate before publishing.
- The token must have **Bypass two-factor authentication** checked, because a workflow cannot answer an OTP prompt. Classic automation tokens no longer exist (creation was disabled in November 2025 and every remaining token was revoked in December 2025), so a granular token is the only option.
- Write tokens are capped at a 90-day lifetime, so the secret has to be rotated. npm plans to remove direct publishing with bypass-2FA tokens in January 2027; after the package exists, move to [trusted publishing](https://docs.npmjs.com/trusted-publishers) (OIDC) instead, which needs no secret at all.

## Guard behaviour (verified)

| Scenario | Result |
| --- | --- |
| Manual run from `main` without inputs | publishes the current `package.json` version |
| Manual run with `dry_run` enabled | checks pass, `npm pack --dry-run` runs, nothing published |
| Manual run from a feature branch without `dry_run` | job fails with `Publishing is only allowed from main or from a release tag.` |
| Tag on a commit outside `main` | job fails with `Tag commit is not on main. Merge to main before tagging.`; build and publish are skipped |
| Tag whose version differs from `package.json` | fails with `version check failed: tag vX.Y.Z does not match package version; expected vA.B.C`; publish is skipped |
| Version already on the registry | publish step stops with `Version … is already published. Bump the version first.` |

## Dry run

Run the workflow manually (`Actions → Release → Run workflow`) with `dry_run` enabled. It performs every check and runs `npm pack --dry-run` without publishing — useful to validate changes to the pipeline itself. Leaving `dry_run` off on a manual run publishes, so only use it from `main`.

## After publishing

```sh
npx liandi@latest --version
npm view liandi version dist.tarball
```

## Cross-platform notes

- `bin` points at `dist/cli.js`, which starts with `#!/usr/bin/env node`; npm generates the `liandi.cmd` and `liandi.ps1` shims on Windows automatically.
- CI runs the test suite on ubuntu-latest, macos-latest and windows-latest for Node 20, 22 and 24, so platform regressions surface before a tag is cut.
- The published package ships only `dist/`, `skills/`, `docs/`, `CHANGELOG.md`, `README.md`, `LICENSE` and `THIRD_PARTY_NOTICES.md`. `scripts/pack-check.mjs` fails if sources or `node_modules` sneak in.
- Global config uses `%APPDATA%` on Windows and `$XDG_CONFIG_HOME` (or `~/.config`) elsewhere.

## If the name is taken

`liandi` was unclaimed on the registry as of 2026-11-15. If that changes, publish as `liandi-cli` while keeping `bin` as `liandi`, so the command stays the same:

```json
{ "name": "liandi-cli", "bin": { "liandi": "./dist/cli.js" } }
```
