# 01 — Node version pinning

## Why

During the 2026-05 dependency upgrade we hit OpenSSL/MD4 issues caused by
Node version drift between local and CI environments. Pinning the Node
version closes that surface and makes Renovate / contributor onboarding
deterministic.

## Scope

Two artifacts, both in repo root:

- `.nvmrc` — single line, the chosen Node major.minor (e.g. `22.11.0`).
- `engines.node` field in `package.json` — same range.

## Choosing the version

Pick the active LTS that satisfies the current toolchain:

- `vite@^7` — needs Node ≥ 20.19 or ≥ 22.12.
- `vitest@^4` — needs Node ≥ 20.
- `vite-plugin-pwa@^1` — needs Node ≥ 20.

Default: latest **22.x LTS**. Verify with `nvm ls-remote --lts` at
execution time.

## Steps

1. Run `node --version` against the target. Confirm `npm ci && npm run
   build && npm run test:unit && npm run lint` all pass.
2. Write the chosen version to `.nvmrc` (no `v` prefix, no newline noise).
3. Add to `package.json`:
   ```json
   "engines": {
     "node": ">=22.12.0 <23"
   }
   ```
4. Commit: `build: pin node version via .nvmrc and engines field`.

## Verification

```
nvm use
npm ci
npm run build
npm run test:unit
npm run lint
```

All four commands clean, no engine warnings from npm.

## Out of scope

No changes to source files. No CI workflow changes — those land in
`08-ci-cd.md` and will read `.nvmrc` via `actions/setup-node@v4` with
`node-version-file: '.nvmrc'`.
