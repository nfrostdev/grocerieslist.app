# Handoff 06 — PR preview deploys + coverage thresholds

## Goal

Two small CI improvements:

1. Auto-deploy a Firebase preview channel for each PR so reviewers see a live URL
2. Fail the build when test coverage regresses

## Current state

- `.github/workflows/deploy.yml` only fires on push to main
- `.github/workflows/ci.yml` runs lint + tests + build on PR (no deploy, no coverage gate)
- `vite.config.js:26-34` runs coverage but sets no thresholds
- `firebase.json` is preview-channel ready (Hosting only, no Functions)
- Secret `FIREBASE_SERVICE_ACCOUNT` already exists (used by `deploy.yml`)

## Changes

### 1. New workflow `.github/workflows/preview.yml`

```yaml
name: preview
on:
  pull_request:
    branches: [main]
jobs:
  preview:
    runs-on: ubuntu-latest
    permissions:
      checks: write
      contents: read
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: ${{ secrets.GITHUB_TOKEN }}
          firebaseServiceAccount: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
          projectId: grocerieslist-app
          channelId: pr-${{ github.event.number }}
          expires: 7d
```

### 2. Coverage thresholds in `vite.config.js`

Inside `test.coverage`, add:

```js
thresholds: {
  lines: 80,
  functions: 80,
  branches: 75,
  statements: 80
}
```

Pick numbers from current coverage report — run `npm run test:coverage` first and set thresholds at current level minus ~5pp so adding code without tests fails CI but a small dip doesn't.

### 3. Wire coverage into CI

`.github/workflows/ci.yml`: replace `- run: npm run test:unit` with `- run: npm run test:coverage`.

## Verification

- Open a throwaway PR; `preview` workflow runs; bot comments a `https://grocerieslist-app--pr-N-xxxx.web.app` URL; the URL loads the app
- Drop a function in `src/stores/lists.ts` without removing its test → coverage workflow on PR fails with threshold error
- Merge PR to main → `deploy.yml` fires as before, deploys to live channel

## Out of scope

- Auto-deleting preview channels on PR close (the `expires: 7d` covers it)
- Caching `node_modules` beyond `setup-node`'s npm cache
- Renaming workflows or restructuring jobs
