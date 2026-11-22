---
name: liandi
description: Operate ld246.com (链滴) through the liandi CLI for articles, comments, users, notifications, domains, tags, rankings and server time. Use whenever the user asks to read, publish, edit, reply on, or inspect 链滴/ld246, even if they do not explicitly mention this skill. Includes safe dry-run and confirmation workflows for agents.
---

# Liandi CLI

Use `liandi` for documented ld246.com API operations. If the command is not installed, run it as `npx liandi …`. Commands are short: `article list`, `article post`, `comment post`, `user me`, `notice unread`. Do not construct ad-hoc HTTP requests when a command exists. Read [references/commands.md](references/commands.md) when the exact command or option is unclear, or run `liandi --help` / `liandi <group> --help`.

## Workflow

1. Determine whether the task only reads data or changes remote/local state.
2. For automation, request JSON with `--format json` (or `-j`) and parse the single stdout envelope. The default is human-readable output, which is not meant for parsing.
3. Before publishing, editing, replying, marking read, or installing the skill, run the same command with `--dry-run`. Read this preview to the user in a compact form.
4. Never infer permission to publish merely from a request to draft text. Obtain confirmation for the actual preview, then rerun without `--dry-run` and with `-y` for non-interactive execution.
5. Report the returned `code`, `msg`, relevant IDs, and failures. Do not claim success based only on an HTTP request being attempted.

## Authentication

- `LIANDI_TOKEN` is the API Token from https://ld246.com/settings/account. It is the only credential the CLI uses.
- Resolution: `--token` > process `LIANDI_TOKEN` > `./.env` > `$XDG_CONFIG_HOME/liandi/.env` (normally `~/.config/liandi/.env`, `%APPDATA%\liandi\.env` on Windows).
- When a token is configured it is sent on every v2 request. Without one, ld246.com usually answers `/api/v2/*` with 401 even for nominally public endpoints, so configure a token before expecting reads to work.
- Prefer a protected environment or `.env` file over `--token`, which may appear in shell history/process listings.
- Never display, save, or quote the API token in the conversation.
- There is no login command: the account/password endpoints return a session credential that cannot replace the API Token. If a user asks to sign in through the CLI, tell them to use the website and then paste the API Token.

## Input and output

- Inline text: `--content "text"`; UTF-8 file: `--content-file post.md`. Do not supply both.
- Content type defaults to `markdown`; choose `--content-type html` for HTML.
- Successful JSON: `{ "ok": true, "status": "success", "command": "...", "data": <API response> }`.
- Preview JSON uses `status: "dry-run"`; cancellation uses `status: "cancelled"`.
- Errors use `{ "ok": false, "status": "error", "error": { "code", "message" } }` and a nonzero exit code.
- A non-zero upstream `code` is surfaced as an error with code `API_CODE_<n>` and exit 1, so `ok: true` really means the server accepted the operation.
- Human output is the default even in a pipe, so always pass `--format json` (or `-j`) before parsing stdout.
- With JSON output, stdout is always exactly one JSON object: an interactive write preview goes to stderr, and a refused non-interactive write puts the preview in `error.details`.
- Page size is fixed by the server at 20. Use `-p`, not a page-size option. Events use `-s 1..64`.

## Safety boundaries

- A GET is not necessarily read-only: `notice read` changes remote state and needs confirmation. Fetching broadcast, wallet, or system-announcement notifications may mark them read on the server; disclose this before using those commands when read status matters.
- `--yes` does not bypass the requirement to let the user inspect the intended operation: perform a separate dry run first unless the user has just explicitly approved the exact request.
- Do not use loops for bulk posting. Respect the official usage policy and the 120 requests/minute/IP limit.
- Do not send real writes in tests or examples. Use `--dry-run` or a local mock server.
- Update an article only after `article source <id>`; retain its `articleType` via `--type`.
- Reviewing a preview never needs a token, but actually sending does: run `--dry-run` first even before you have credentials.

## Not supported

Only the documented v2 endpoints exist. These requests cannot be fulfilled, so say so plainly instead of improvising with another endpoint:

- Deleting an article or comment (no delete endpoint; the user must use the web UI).
- Like, thank, good/bad vote, favorite/unfavorite, follow/unfollow, poll or reward writes.
- Search, image/attachment/avatar upload, profile or password edits, point transfers, check-in, direct messages.
- Custom page size (fixed at 20).
- Signing in: there is no `auth` command, and a login session cannot replace the API Token.

Writable operations are exactly: `article post`, `article edit` (own), `comment post`, `comment edit` (own), `notice read`, and the local `skill install`.

## Missing or ambiguous input

When a requested file, ID, tag, or domain is absent or ambiguous, stop and ask rather than inventing content or guessing an identifier. A short path typo should be reported, not silently replaced with a similar-looking file. Never fabricate article bodies, titles, tags, or returned IDs; if a write cannot be previewed truthfully, say so instead of producing a plausible-looking result.
