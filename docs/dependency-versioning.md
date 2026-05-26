# Dependency versioning (apps vs libraries)

This repository is an **application** (an MCP server you run or deploy), not a library consumed via `require()` by other npm packages. For that reason, dependencies in `package.json` are pinned to **exact versions** (no `^` or `~` ranges).

## Why pin versions in applications?

| Goal | What pinning gives you |
|------|-------------------------|
| **Reproducibility** | The version in `package.json` matches what is installed; no drift between `package.json` and `package-lock.json` after `npm audit fix` or Renovate updates. |
| **Predictability** | A fresh `npm install` without a lockfile still resolves to the same versions you tested. |
| **Security** | You choose when to upgrade; a compromised patch release cannot slip in silently via a semver range. |
| **Debugging** | You can see the real installed version at a glance in `package.json`. |

The lockfile (`package-lock.json`) already pins the full dependency tree, but **ranges in `package.json` still matter**: tools may update only the lockfile while leaving ranges broad, so the declared contract and what you actually run can diverge.

## Why use ranges (`^`) in libraries?

When you publish an npm **library**, consumers install it alongside their own dependencies. If your library pins exact versions of its dependencies, npm often cannot deduplicate packages and users end up with multiple copies of the same dependency at slightly different versions — larger installs and harder-to-debug conflicts.

Libraries typically declare **semver ranges** (usually caret `^`) in `dependencies` so consumers can share a single compatible version. Applications that are not imported by other packages do not have that constraint.

## Rules of thumb

1. **Applications** (web apps, CLIs, servers like this MCP server): pin exact versions in `package.json`.
2. **Libraries** published to npm: use semver ranges in `dependencies`; pinning `devDependencies` is often fine.
3. **Always** commit `package-lock.json` and prefer `npm ci` in CI and production installs.

## Further reading

- [Renovate — Should you pin your JavaScript dependencies?](https://docs.renovatebot.com/dependency-pinning/) — apps vs libraries, lockfiles, and when pinning causes duplicate packages
- [Pin your dependencies in package.json](https://thetshaped.dev/p/pin-your-dependencies-in-packagejson) — consistency across environments
- [Hardening your Node.js app (supply chain)](https://dev.to/walosha/hardening-your-nodejs-app-against-supply-chain-remote-code-execution-attacks-2n2a) — explicit pins and deliberate upgrades
- [Semantic versioning ranges explained](https://jsonic.io/guides/semver-version-ranges) — caret, tilde, and when to pin build tooling

## Upgrading dependencies

Pinning does not mean “never update”. Use Dependabot, Renovate, or manual PRs to bump versions deliberately, run tests, and merge when green.
