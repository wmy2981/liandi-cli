# liandi

[简体中文](README.md) | [繁體中文](README.zh-TW.md) | English

Human and agent friendly CLI for the [ld246.com (链滴)](https://ld246.com) community API. Written in TypeScript, covering every endpoint listed in the [official v2 community client API documentation](https://ld246.com/article/1488603534762).

## Features

- Full coverage of articles, comments, domains, tags, users, notifications, leaderboards, and server time.
- Human-readable terminal output by default: aligned tables or compact blocks for lists, field summaries for details; `--format json` (shorthand `-j`) returns a single stable machine-readable envelope.
- Internationalized terminal output and documentation in English (`en`), Simplified Chinese (`zh-CN`), and Traditional Chinese (`zh-TW`), with automatic system locale detection and `--lang` / `LIANDI_LANG` overrides; JSON output remains locale-independent.
- Tables adapt to terminal width and count CJK/wide characters as two cells so rows do not wrap awkwardly.
- Safe write workflow: every write previews the request before interactive confirmation; `-d, --dry-run` previews without sending, `-y, --yes` confirms non-interactively.
- Inline body with `--content` or UTF-8 Markdown/HTML files with `--content-file`.
- Layered API Token configuration with credential redaction in previews and error details.
- Built-in `liandi/<version>` User-Agent and installable agent skill.
- Node.js 20+, cross-platform on Windows/macOS/Linux, with only `commander` as a runtime dependency.
- Semver tag-driven releases; CI tests across all three platforms × Node 20/22/24 plus packaging smoke checks.

## Installation & Usage

Requires Node.js 20 or newer on Windows, macOS, or Linux.

```sh
# Run without installing (npx fetches the latest release)
npx liandi --help

# Or install globally
npm install -g liandi
liandi --help
```

### Configuration paths by platform

| Platform | Global `.env` path |
| --- | --- |
| Linux / macOS | `$XDG_CONFIG_HOME/liandi/.env`, or `~/.config/liandi/.env` when unset |
| Windows | `%APPDATA%\liandi\.env` (falls back to `~/.config/liandi/.env` if `APPDATA` is unset) |

A local `./.env` in the current working directory takes precedence over the global config file. `.env` supports CRLF line endings and UTF-8 BOM.

Set a temporary token in Windows PowerShell:

```powershell
$env:LIANDI_TOKEN = "your API token"
liandi user me -j
```

For regular use, store the token in a restricted `.env` file so it does not appear in shell history.

### From source

```sh
git clone https://github.com/wmy2981/liandi-cli.git
cd liandi-cli
npm install && npm run build
npm link          # exposes `liandi` globally
# or run directly: node dist/cli.js --help
```

## API Token & Authentication

Obtain your **API Token** from [ld246.com Account Settings](https://ld246.com/settings/account). Requests authenticate with:

```http
Authorization: token <API Token>
```

This is neither `Bearer` auth nor the web `symphony` session cookie. This CLI only uses the API Token: the `/api/v2/login` and `/api/v2/login/2fa` endpoints return a one-time session credential that cannot replace `LIANDI_TOKEN`, so the `auth` group has been removed—sign in via the website instead. See [docs/authentication.md](docs/authentication.md).

Whenever a token is configured, the CLI sends it on every v2 request; without one, anonymous reads are still attempted. In live testing, ld246.com returns HTTP 401 for unauthenticated `/api/v2/*` calls, so configuring a token is recommended for all usage.

Token resolution priority (highest to lowest):

1. `-t, --token <API Token>`
2. Process environment variable `LIANDI_TOKEN`
3. `LIANDI_TOKEN` in `./.env`
4. `$XDG_CONFIG_HOME/liandi/.env` (or `~/.config/liandi/.env` / `%APPDATA%\liandi\.env`)

Prefer a protected `.env` file over `--token` (which may appear in shell history or process lists):

```sh
cp .env.example .env
chmod 600 .env
# Edit .env and set LIANDI_TOKEN
```

`.env` is gitignored. Supported syntax includes `KEY=value`, single/double quotes, `export KEY=value`, and `#` comments without shell evaluation. Use `LIANDI_BASE_URL` or `-b, --base-url` to point at a private/test server (default: `https://ld246.com`).

## Output Conventions

### Human-readable (default)

`--format human` is the default even in pipes: list commands render aligned tables or compact blocks, and detail commands render field summaries. Errors go to stderr:

```text
Error [AUTH_REQUIRED]: API token required. Set --token, LIANDI_TOKEN, ./.env, or ~/.config/liandi/.env
```

Article lists print three lines per post (title / author · time · replies · views / permalink):

```text
 1. Why does the cursor jump to the start of the line after pasting?
    inessence · 2026-11-22 11:27:13 · 6 replies · 10 views
    https://ld246.com/article/1795318034189

Showing 20 · 2991 pages
```

Short-field lists (users, tags, domains) use aligned tables that shrink gracefully to fit the terminal width:

```text
Username         Nickname  Articles  Comments  Points  Profile
───────────────  ────────  ────────  ────────  ──────  ───────────────────────────────────────
yoss             Yoss             6       167    2270  https://ld246.com/member/yoss
```

`user me`, `article get`, `tag get`, and `domain get` print field summaries followed by the body, comments, or description. If an upstream payload shape changes unexpectedly, the renderer degrades cleanly to raw `data` JSON instead of printing an empty table.

### Explicit format selection

```sh
liandi article list                  # human-readable (default)
liandi article list --format human   # explicit human mode
liandi article list --format json    # stable JSON envelope
liandi article list -j               # shorthand for --format json
```

`--format json` and `-j` produce byte-identical output. Conflicting combinations like `-j --format human` fail with `INVALID_INPUT` (exit code 2).

### Language settings (i18n)

Terminal output (help text, human-readable lists/summaries, status lines, interactive prompts, and human-mode error messages) supports three languages: `en` (English), `zh-CN` (Simplified Chinese), and `zh-TW` (Traditional Chinese).

```sh
liandi article list --lang en
liandi article list --lang zh-CN
liandi article list --lang zh-TW
liandi --help --lang zh-TW
```

Locale resolution priority (highest to lowest):

1. `--lang <locale>` (accepts canonical codes and standard tags such as `en`/`en-US`, `zh-CN`/`zh-Hans`/`zh`, `zh-TW`/`zh-HK`/`zh-Hant`)
2. Process environment variable `LIANDI_LANG`
3. POSIX environment variables `LC_ALL` > `LC_MESSAGES` > `LANG`
4. System locale (auto-detected on Windows / macOS / Linux), falling back to `en`

`--format json` (`-j`) is strictly locale-independent and unaffected by `--lang` or system locale, keeping the machine contract stable for scripts and agents.

### Terminal colors

In an interactive terminal, only status lines and hints are colored: red for errors, yellow for dry-run/cancelled notices, and cyan for hints. Response data stays plain text, and JSON output never contains ANSI escapes.

Color is auto-detected independently for stdout and stderr, or controlled via `--color auto|always|never` and `--no-color`. Priority: CLI flag > `FORCE_COLOR` (`0`/`false` disables, any other value enables) > `NO_COLOR` (any non-empty value disables) > TTY detection.

### Agent / Automation

Pass `--format json`, `-j`, or `--json` at any argument position. stdout always contains exactly one JSON object:

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

`data` preserves the full upstream response without dropping fields. `status` is one of `success`, `dry-run`, `cancelled`, or `error`. In JSON mode, stdout always holds one JSON object: interactive write previews are written to stderr, and refused non-interactive writes include the preview in `error.details`. Example error:

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

Exit codes: `0` success/dry-run/cancelled, `1` upstream business/network/runtime error, `2` invalid input, configuration, or confirmation error.

Errors from all three layers map to the same error envelope:

1. Non-2xx HTTP responses (e.g. 401/403/5xx) or non-JSON bodies;
2. **Upstream JSON `code != 0`** (HTTP 200 business failure), mapped to `API_CODE_<code>` with the upstream `msg`;
3. Local argument/configuration validation errors.

## Safe Write Workflow

Publishing articles, editing articles, posting/editing comments, marking notifications read, and installing the skill are all treated as writes.

```sh
# 1. Preview only without sending a request
liandi article post \
  --title "CLI Release" \
  --tags "CLI,Markdown" \
  --content-file ./post.md \
  --dry-run

# 2. Preview in an interactive terminal and type y to confirm
liandi article post --title "CLI Release" \
  --tags "CLI,Markdown" --content-file ./post.md

# 3. Non-interactive: inspect the preview above, then rerun with --yes
liandi article post --title "CLI Release" \
  --tags "CLI,Markdown" --content-file ./post.md --yes --json
```

- `--dry-run` makes no network request and **does not require a token**, letting you review the payload before configuring credentials.
- Missing tokens fail before sending with `AUTH_REQUIRED` (exit code 2).
- Without `--yes`, interactive terminals preview the request and require `y`/`yes`; any other answer cancels.
- Non-TTY terminals without `--yes` refuse execution instead of hanging on stdin.
- `--dry-run` and `--yes` are rejected on read commands.
- `notice read` uses HTTP GET upstream but mutates state, so the CLI enforces write confirmation.
- Per official docs, fetching `broadcast`, `wallet`, and `sys-announce` notifications automatically marks them read on the server.
- API tokens never appear in previews or output; previews only include `method`, `url`, and request `body`.

## Common Commands

```sh
# Latest, hot, good, reply, and perfect article feeds
liandi article list --sort hot --page 1
liandi article list --tag Java --sort perfect
liandi article list --domain Java
liandi article get 1488603534762 --page 1

# Fetch raw source and articleType before editing
liandi article source 1488603534762
liandi article edit 1488603534762 \
  --title "Title" --tags "CLI,Markdown" --type 0 --content-file post.md

# Comments and replies
liandi comment post 1488603534762 --content-file reply.md
liandi comment post 1488603534762 -c "Reply text" --reply-to 1488603534763
liandi comment edit 1488603534763 -c "Updated text" --visible false

# Users, domains, and tags
liandi user me --json
liandi user get 88250
liandi user get 1 --number
liandi user events 88250 --size 16
liandi user followers 88250 --page 1
liandi domain list
liandi tag get Java

# Notifications, leaderboards, and server time
liandi notice unread
liandi notice at --page 1
liandi notice read at --dry-run
liandi top followers
liandi time
```

Commands stay concise: `article list|get|post|edit|source`, `comment post|edit`, `user me|get|articles|comments|events|watches|follows|tags|stars|followers`, `notice unread|<type>|read`, `domain|tag list|get`, `top newbies|followers`, `time`. Aliases `a`/`c`/`u`/`n`/`dom`/`tags`/`tops` are also supported. See `liandi <group> --help` or the [skill command reference](skills/liandi/references/commands.md).

### Body content files

Provide either `-c, --content <text>` or `-f, --content-file <path>` (not both). Default `--content-type` is `markdown`; pass `--content-type html` for HTML. Article posting/editing also supports `--reward-content` and `--reward-point`; editing requires `--type` from `article source`. Edits overwrite the whole article payload.

## Agent Skill

```sh
liandi skill install --dry-run
liandi skill install --yes
```

Installs or updates `~/.agents/skills/liandi` without touching other skill directories. The skill includes safety rules and a command reference (evaluation fixtures live in `evals/` in the repository and are not installed).

## Development

```sh
npm install
npm run typecheck
npm run build
npm test
npm run test:coverage
node scripts/verify.mjs        # full offline CLI/flag/i18n verification
npm pack --dry-run
```

`node scripts/verify.mjs` spins up a local mock HTTP server and verifies every command, flag, confirmation flow, output format, locale switch, token precedence rule, and error mapping. CI runs it on every push.

Unit and integration tests use mocks and a local HTTP server—never hitting ld246.com or requiring a real token.

## Live Verification

Read endpoints and minimal write operations were verified against the live ld246.com service. Findings (payload shapes, error mappings, anonymous 401 behavior) are documented in [docs/live-verification.md](docs/live-verification.md); authentication notes are in [docs/authentication.md](docs/authentication.md).

## Unsupported Capabilities

Only endpoints documented in the official v2 API are implemented. The following requests **cannot** be fulfilled by this CLI:

| Request | Status | Reason |
| --- | --- | --- |
| Delete article / delete comment | Unsupported | No v2 delete endpoint; use the web UI |
| Like / thank / downvote (`good`, `bad`, `thank`) | Unsupported | No public v2 endpoint; read-only counters only |
| Star / unstar, follow / unfollow | Unsupported | Read-only lists only; no write endpoints |
| Poll / bounty write actions | Unsupported | No public v2 endpoint |
| Search articles, users, or tags | Unsupported | Not in the official API docs |
| Upload images / attachments / avatars | Unsupported | No public v2 upload endpoint |
| Edit nickname, avatar, bio, password, email | Unsupported | Account settings routes are not part of the client API |
| Point transfers, check-in, invite codes | Unsupported | No public v2 endpoint |
| Direct messages / chat | Unsupported | No public v2 endpoint |
| `auth login` / `2fa` / `logout` | Removed | Login endpoints only return one-time web sessions, not reusable API tokens |
| Custom page size | Unsupported | Fixed at 20 items per page server-side |

Supported writes are strictly: `article post`, `article edit` (own), `comment post`, `comment edit` (own), `notice read`, and local `skill install`.

## Scope & Limits

- Strictly implements documented v2 endpoints only.
- Server-side page size is fixed at 20; `user events --size` accepts 1–64.
- Respect the official rate limit of 120 requests per IP per minute; avoid automated bulk posting.
- The live ld246.com v2 service differs from the open-source Symphony repository; the official v2 docs are the contract.

## Versioning & Releases

Follows semver. Pushing a `vX.Y.Z` tag on `main` automatically publishes to npm (via OIDC trusted publishing) and creates a GitHub Release. Manual runs of the Release workflow publish from `main` or a tag unless `dry_run` is checked. See [docs/publishing.md](docs/publishing.md) and [CHANGELOG.md](CHANGELOG.md).

```sh
npm run release:patch   # or release:minor / release:major
git push --follow-tags  # triggers the Release workflow
```

## License

[MIT](LICENSE) © 2026 wmy2981. Third-party dependencies and API notices are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). This is an independent client and is not affiliated with or endorsed by ld246.com.
