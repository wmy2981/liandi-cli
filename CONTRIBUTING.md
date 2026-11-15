# Contributing

1. Use Node.js 20 or newer.
2. Run `npm install`, then `npm run typecheck`, `npm run build`, and `npm test` before submitting changes.
3. Keep command names and the JSON envelope stable for agents.
4. All remote state changes and local skill installations must support `--dry-run` and require confirmation unless `--yes` is explicitly supplied.
5. Never commit `.env`, tokens, passwords, session cookies, or real login responses.
6. Tests must use mocks or a local HTTP server, never real writes to ld246.com.
7. Cover every newly supported endpoint with a request-mapping test and update `skills/liandi/references/commands.md`.
   Evaluation cases live in `evals/liandi.json`, outside the installed skill directory, so the shipped skill cannot leak its own expected answers.
8. Keep the runtime dependency footprint small. Do not introduce cookie-based authentication as a replacement for the documented API Token flow.

9. Maintainer releases follow [docs/publishing.md](docs/publishing.md); CI must be green on all three platforms first.

Report issues at https://github.com/wmy2981/liandi-cli/issues.
