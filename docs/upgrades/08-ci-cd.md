# 08 — CI/CD via GitHub Actions + Renovate

## Why

The project has no automation today. Every check (lint, build, test) is
manual; deploys are manual `firebase deploy`; dependency upgrades are
done in batch every several months and are painful (151 → 40 vulns in
one go, per the May 2026 upgrade).

This plan adds:

- **CI on PRs**: lint + build + test must pass.
- **CD on `main`**: auto-deploy to Firebase Hosting.
- **Renovate**: weekly grouped dependency PRs, so upgrades stay small
  and incremental.

Prereq: plan 07 should land first so CI has real tests to run. Plan 01
(Node pinning) should also be in — workflows read `.nvmrc`.

## Files to add

```
.github/
  workflows/
    ci.yml
    deploy.yml
renovate.json
```

## `.github/workflows/ci.yml`

Triggers: pull requests to `main`. Jobs run in parallel.

```yaml
name: ci
on:
  pull_request:
    branches: [main]
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run test:unit
      - run: npm run build
```

Single job — three steps that gate each other is fine for a project
this small. Splitting into parallel jobs (lint / test / build) only
matters once any single step exceeds ~2 min.

## `.github/workflows/deploy.yml`

Triggers: push to `main` (after PR merge).

```yaml
name: deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
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
          channelId: live
          projectId: <firebase-project-id>
```

**Required GitHub secret**: `FIREBASE_SERVICE_ACCOUNT` — JSON key from
the Firebase project's service account with Hosting Admin role. The
older `FIREBASE_TOKEN` flow (CI tokens) is deprecated; use a service
account.

`<firebase-project-id>` — read from `.firebaserc` if it exists, else
ask the user. Don't hardcode without confirming.

## `renovate.json`

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["config:recommended"],
  "schedule": ["before 6am on Monday"],
  "timezone": "America/Los_Angeles",
  "packageRules": [
    {
      "matchPackagePatterns": ["^vue", "^@vue/", "^vite", "^@vitejs/", "^vitest", "^@vitest/"],
      "groupName": "vue + vite ecosystem"
    },
    {
      "matchPackagePatterns": ["^eslint", "eslint-plugin-", "eslint-config-"],
      "groupName": "eslint ecosystem"
    },
    {
      "matchPackagePatterns": ["^@fortawesome/"],
      "groupName": "fontawesome"
    },
    {
      "matchUpdateTypes": ["patch", "minor"],
      "matchCurrentVersion": "!/^0/",
      "automerge": true,
      "automergeType": "pull-request"
    }
  ]
}
```

Renovate is preferred over Dependabot here because the grouping config
turns the Vue/Vite ecosystem into one PR per week instead of 8 — which
is the failure mode that produced the May 2026 batch upgrade.

Auto-merge is enabled for non-major bumps (above 0.x) so trivial
patches don't accumulate. CI is the gate.

## Steps

1. Confirm Firebase project id (`.firebaserc` or ask).
2. Generate Firebase service account JSON; add as
   `FIREBASE_SERVICE_ACCOUNT` repo secret.
3. Write the three files above.
4. Open a throwaway PR (e.g. add a comment to the README). Confirm
   `ci.yml` runs and passes.
5. Merge the throwaway PR. Confirm `deploy.yml` runs and the live
   site updates.
6. Install the Renovate GitHub app on the repo. Confirm the first
   onboarding PR appears within ~24h.

## Verification

- A red CI on a deliberately-broken PR (e.g. a syntax error) blocks
  merge.
- A green merge to `main` triggers a successful deploy. `firebase
  hosting:channel:list` shows the deploy.
- Renovate's onboarding PR is opened and mergeable.

## Out of scope

- Preview channels per PR (Firebase Hosting supports this; nice-to-have
  but not load-bearing).
- Slack / email notifications on failure — start without; add only if
  failures get ignored.
