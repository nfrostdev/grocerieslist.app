# Handoff 02 — Strip dead build deps

## Goal

Remove leftover Vue-CLI / Babel-era deps that no longer do work under Vite 7 + Node 22. Net deletion only.

## Current state

- `package.json` deps include `core-js ^3.49.0` — only useful for Babel polyfill injection. No Babel in this build.
- `.browserslistrc` exists at repo root with `> 1%, last 2 versions, not dead`. Vite uses `build.target` (esbuild) for syntax, not browserslist. PostCSS Autoprefixer would read it, but Tailwind 4 doesn't use Autoprefixer.
- `package.json` has a top-level `"prettier": { … }` config block, but neither `prettier` nor `eslint-config-prettier` is installed. Dead config.

## Changes

1. `package.json`: remove `core-js` from `dependencies`
2. Delete `.browserslistrc`
3. `package.json`: remove the top-level `"prettier": { … }` block (decision: drop — user is not running prettier; lint-staged only invokes eslint)
4. `npm install` to regenerate lockfile

## Verification

- `npm run build` succeeds and dist size unchanged or smaller
- `npm run lint`, `npm run test:unit` pass
- `git grep -i 'core-js\|browserslist\|prettier'` returns nothing meaningful in tracked files (package.json, configs)

## Out of scope

- Adding Prettier (separate decision)
- Changing Vite `build.target` (default `'modules'` is fine for a PWA)
- Tailwind / PostCSS plugin changes
