# 02 — Bump lint-staged 9 → current

## Why

`lint-staged@9.5.0` is several majors behind. v10 dropped the need for
explicit `git add` in the command list (it auto-stages), and modern
versions support concurrent runs and better glob handling. The current
config is also using a deprecated pattern.

## Current state

`package.json`:

```json
"lint-staged": {
  "*.{js,jsx,vue}": [
    "eslint --fix",
    "git add"
  ]
}
```

Pre-commit hook installation: per `MIGRATION_VITE_PINIA.md`, the project
replaced yorkie with `npx lint-staged` directly. Confirm the hook script
in `.husky/` or `.git/hooks/pre-commit` before bumping — if the hook has
gone missing, restore it as part of this work.

## Steps

1. `npm view lint-staged version` to confirm latest major. Bump devDep:
   ```
   npm i -D lint-staged@latest
   ```
2. Simplify config in `package.json`:
   ```json
   "lint-staged": {
     "*.{js,vue}": "eslint --fix"
   }
   ```
   Notes:
   - Drop `jsx` from the glob — no JSX in this project.
   - String form (vs array) is fine for a single command.
   - No `git add` — handled automatically.
3. Confirm pre-commit hook exists and invokes `npx lint-staged`. If not,
   add a husky-free hook (single file, no extra dep):
   ```
   # .git/hooks/pre-commit  (or .husky/pre-commit if husky is added)
   #!/usr/bin/env sh
   npx lint-staged
   ```
   Note: hook files in `.git/hooks/` are not version-controlled. If the
   user wants the hook tracked, install husky as part of this plan and
   bring `.husky/pre-commit` into git.

## Verification

1. Edit `src/components/AppHeader.vue` — introduce a fixable lint error
   (e.g. extra semicolon).
2. `git add src/components/AppHeader.vue && git commit -m "test"`.
3. Confirm: commit succeeds, the file in the commit has the error fixed.
4. `git reset HEAD~1` to undo the test commit.

## Out of scope

ESLint version bump itself — that's `04-eslint-flat-config.md`. This plan
only touches the lint-staged tooling.
