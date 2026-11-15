# Authentication notes

Verified against the [official v2 API documentation](https://ld246.com/article/1488603534762) and public upstream sources on 2026-11-15.

- Normal v2 API authentication is `Authorization: token <API Token>`, using the API Token in the account settings page. It is not a Bearer scheme.
- `POST /api/v2/login` and `/api/v2/login/2fa` return a session credential used in `Cookie: symphony=<session token>`. This is not the API Token and must not be substituted for `LIANDI_TOKEN`.
- The API documentation retains the `symphony` Cookie only for legacy clients. This CLI uses it only for the documented two-factor login request, not for ordinary API operations.
- The current open-source Symphony `master` no longer contains the v2 API handlers or its API Token verification. Its current web Cookie name also differs from the v2 compatibility contract. Therefore this client does not infer ld246.com v2 behavior from current web routes.
- Current v2 behavior follows the official v2 documentation. A missing documented feature should be reported rather than guessed from unrelated endpoints.

Sources:

- Official API: https://ld246.com/article/1488603534762
- Symphony session generation: https://github.com/88250/symphony/blob/c3e204806f98410d7f8484825de4ef9f85c13f9f/src/main/java/org/b3log/symphony/util/Sessions.java#L308-L343
- Login returns the session token: https://github.com/88250/symphony/blob/c3e204806f98410d7f8484825de4ef9f85c13f9f/src/main/java/org/b3log/symphony/processor/LoginProcessor.java#L691-L700
