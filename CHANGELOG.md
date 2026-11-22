# Changelog

Notable, user-visible changes. The CLI surface (commands, flags, exit codes) and the JSON output envelope are the versioned contract; see [docs/publishing.md](docs/publishing.md) for the bump rules.

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
