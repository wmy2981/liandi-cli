# Authentication notes

[简体中文](zh-CN/authentication.md) | [繁體中文](zh-TW/authentication.md) | English

Verified against the [official v2 API documentation](https://ld246.com/article/1488603534762) and public upstream sources on 2026-11-15.

- Normal v2 API authentication is `Authorization: token <API Token>`, using the API Token in the [account settings page](https://ld246.com/settings/account). It is not a Bearer scheme.
- The API Token is the only credential this CLI uses. It resolves it from `--token`, `LIANDI_TOKEN`, `./.env`, then `~/.config/liandi/.env` (`%APPDATA%\liandi\.env` on Windows), and sends it on every request when present.
- `POST /api/v2/login` and `POST /api/v2/login/2fa` return a **session** credential used as `Cookie: symphony=<session token>`. That session is not an API Token and cannot replace `LIANDI_TOKEN`, so the CLI does not implement the login endpoints at all; sign in through the website instead.
- The current open-source Symphony `master` no longer contains the v2 API handlers or its API Token verification. Its current web Cookie name also differs from the v2 compatibility contract. Therefore this client does not infer ld246.com v2 behavior from current web routes.
- Current v2 behavior follows the official v2 documentation. A missing documented feature should be reported rather than guessed from unrelated endpoints.

Sources:

- Official API: https://ld246.com/article/1488603534762
- Symphony session generation: https://github.com/88250/symphony/blob/c3e204806f98410d7f8484825de4ef9f85c13f9f/src/main/java/org/b3log/symphony/util/Sessions.java#L308-L343
- Login returns the session token: https://github.com/88250/symphony/blob/c3e204806f98410d7f8484825de4ef9f85c13f9f/src/main/java/org/b3log/symphony/processor/LoginProcessor.java#L691-L700
