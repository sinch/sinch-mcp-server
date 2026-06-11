# Contributing

## GitHub Actions

All `uses:` references in `.github/workflows/` must be pinned to a full commit SHA with a version comment (for example, `actions/checkout@<sha> # v4.3.1`). Version tags such as `@v4` are mutable and are not allowed. CI enforces this policy via `.github/workflows/pinact.yml`.

When adding or updating a third-party action, pin it before opening a pull request:

```bash
# Install pinact: https://github.com/suzuki-shunsuke/pinact#installation
pinact run .github/workflows/<your-workflow>.yml
```

Alternatively, look up the release SHA on GitHub and add it manually with a version comment. See [GitHub's hardening guide](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions#using-third-party-actions).

## Defining new tools

### Updating dependencies

Dependencies are pinned to **exact versions** in `package.json` (no `^` ranges). To upgrade a package:

1. Set the new version in `package.json` for the package you want to bump.
2. Run `npm install` and commit both `package.json` and `package-lock.json`.
3. Run `npm run lint`, `npm run build`, and `npm test` locally (or rely on CI after opening a PR).
4. Prefer `npm ci` in CI and clean environments so installs match the lockfile.

When bumping `@modelcontextprotocol/sdk` or `zod`, test the server startup and your transport path (stdio, SSE, or Streamable HTTP) — some version combinations have been problematic in the past.

Tools are registered in the `src/index.ts` file.

- Conversation tools: send various types of messages, list conversation apps, templates
- Verification tools: lookup for a number, perform a verification flow
- Voice tools: make a TTS call, create a conference call, manage participants
- Email tools: send emails, retrieve email information

Tools are defined under `src/tools/` and are registered in the `index.ts` file of their respective domain folder.

- Conversation tools: `src/tools/conversation/index.ts`
- Verification tools: `src/tools/verification/index.ts`
- Voice tools: `src/tools/voice/index.ts`
- Email tools: `src/tools/email/index.ts`
