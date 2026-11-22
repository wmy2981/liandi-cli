# Changelog

Notable, user-visible changes. The CLI surface (commands, flags, exit codes) and the JSON output envelope are the versioned contract; see [docs/publishing.md](docs/publishing.md) for the bump rules.

## v0.2.0 — 2026-11-22

Read commands now render for people by default, and `--format` makes the choice explicit.

- **Breaking:** the default output is human-readable. Article feeds print one block per post (title, then author · time · replies · views, then permalink); users, tags and domains print aligned tables that respect the terminal width and count CJK characters as two cells; `user me`, `article get`, `article source`, `tag get` and `domain get` print field summaries with the body, comments or description underneath. Comments, notifications and activity are compact blocks rather than truncated table cells. Scripts that parsed the previous default output must pass `--format json`.
- `--format human|json` selects the format explicitly. `-j, --json` is now shorthand for `--format json`, produces byte-identical output, and `-j --format human` is rejected with `INVALID_INPUT` (exit 2).
- **Breaking:** the `auth` group is removed (`auth login`, `auth 2fa`, `auth logout`). The account/password endpoints return a session credential in the `symphony` cookie, which cannot replace the API Token; the API Token is the only credential the CLI sends. The package no longer exports `md5`.
- A dry-run preview now prints the method and URL on one line above the body.
- A payload that does not match the expected shape falls back to the raw `data` as JSON, so a server-side change cannot produce an empty table.

## v0.1.1 — 2026-11-22

- Releases are published by CI through npm trusted publishing (OIDC); no long-lived npm token is stored in the repository.
- `0.1.0` was published from a workstation to bootstrap the package name, so it carries no provenance; releases from `0.1.1` are built and published by CI with a provenance statement and a GitHub release.
- `scripts/pack-check.mjs` runs on Windows again; Node refuses to spawn the `npm.cmd` shim without a shell.
- Corrected the npm credential instructions in [docs/publishing.md](docs/publishing.md): classic automation tokens no longer exist.

## v0.1.0 — 2026-11-22

Initial release.

- Commands covering every endpoint in the official ld246.com client API: `article list|get|post|edit|source`, `comment post|edit`, `domain|tag list|get`, `user me|get|articles|comments|events|watches|follows|tags|stars|followers`, `notice unread|<type>|read`, `top newbies|followers`, `auth login|2fa|logout`, `time`, `skill install`.
- `-j, --json` prints one stable envelope for agents; `-d, --dry-run` previews writes without touching the network; `-y, --yes` confirms non-interactively.
- API token resolution: `--token` > `LIANDI_TOKEN` > `./.env` > `%APPDATA%`/`$XDG_CONFIG_HOME` config file.
- Content input from an inline flag or a UTF-8 file; custom `liandi/<version>` User-Agent.
- Non-zero upstream codes fail the command instead of reporting success; login `code 10` returns the 2FA hint.
- Bundled agent skill, installed with `liandi skill install` into `~/.agents/skills/liandi`.
- Unexpected internal failures exit `1` instead of `0`, and `--password-stdin` reads one masked line, failing with `INVALID_INPUT` (exit 2) when stdin is closed.
- `-j` always writes exactly one JSON object to stdout: an interactive write preview goes to stderr, and a refused non-interactive write carries the preview in `error.details`.
- Closing the pipe early (`liandi … | head`) ends the process without an EPIPE stack trace.
- Human-readable output colors status lines and hints in a TTY; `--color auto|always|never` and `--no-color` control it, `NO_COLOR`/`FORCE_COLOR` are honored, and `-j` stays free of ANSI escapes.
