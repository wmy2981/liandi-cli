# Security policy

## Credentials

Use the API Token from https://ld246.com/settings/account. It is different from login session tokens returned by `auth login` and `auth 2fa`. Do not commit `.env` files or paste tokens into issues, logs, or conversations.

Prefer a `.env` file with mode `0600` over `--token`. Review dry-run output before execution, but do not treat client-side redaction as a substitute for securing your terminal and CI logs.

`auth login` can return a login session token, which `auth 2fa` needs. It is displayed as a result (passwords, codes, cookies and the API token are not), is never written to disk, and should be treated as a secret.

## Reporting

Report vulnerabilities privately through GitHub Security Advisories for https://github.com/wmy2981/liandi-cli when available. Otherwise open an issue without including secrets or exploit credentials. Do not test against other users' accounts or content.
