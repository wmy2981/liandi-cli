# Publishing

Releases are tag-driven. Pushing a `vMAJOR.MINOR.PATCH` tag that points at a commit on `main` publishes to npm and creates a GitHub release; nothing else publishes.

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
3. Runs typecheck, the test suite, `scripts/verify.mjs` and `scripts/pack-check.mjs`.
4. Refuses to publish a version that already exists on the registry.
5. Publishes with `--provenance`, then creates a GitHub release with generated notes.

## Required setup (once)

- Repository secret `NPM_TOKEN`: an npm automation/granular token with publish rights for the `liandi` package. Without it the publish step fails; everything before it still runs.
- Environment `npm` is referenced by the publish job. Add required reviewers there if you want a manual gate before publishing.
- npm 2FA: use an automation token (or a granular token that bypasses 2FA), because a workflow cannot answer an OTP prompt.

## Dry run

Run the workflow manually (`Actions → Release → Run workflow`) with `publish` left off. It performs every check and runs `npm pack --dry-run` without publishing — useful to validate changes to the pipeline itself.

## After publishing

```sh
npx liandi@latest --version
npm view liandi version dist.tarball
```

## Cross-platform notes

- `bin` points at `dist/cli.js`, which starts with `#!/usr/bin/env node`; npm generates the `liandi.cmd` and `liandi.ps1` shims on Windows automatically.
- CI runs the test suite on ubuntu-latest, macos-latest and windows-latest for Node 20, 22 and 24, so platform regressions surface before a tag is cut.
- The published package ships only `dist/`, `skills/`, `README.md`, `LICENSE` and `THIRD_PARTY_NOTICES.md`. `scripts/pack-check.mjs` fails if sources or `node_modules` sneak in.
- Global config uses `%APPDATA%` on Windows and `$XDG_CONFIG_HOME` (or `~/.config`) elsewhere.

## If the name is taken

`liandi` was unclaimed on the registry as of 2026-11-15. If that changes, publish as `liandi-cli` while keeping `bin` as `liandi`, so the command stays the same:

```json
{ "name": "liandi-cli", "bin": { "liandi": "./dist/cli.js" } }
```
