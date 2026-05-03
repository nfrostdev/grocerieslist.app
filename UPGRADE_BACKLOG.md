# Upgrade Backlog

Items discovered during the 2026-05 dependency upgrade and architecture review. Ordered by approximate impact / unblocking value. Several items are blocked by the planned Vite migration (see `MIGRATION_VITE_PINIA.md`).

## Blocked by Vite migration

The following are deliberately deferred until Vue CLI / webpack are gone, because Vue CLI 5 hard-pins or shadows them:

- **`tailwindcss` 3 → 4** — v4 is CSS-first config (`@theme`) and assumes Vite or `@tailwindcss/postcss`. Not viable on webpack.
- **`jest` 27 → 30 (or replace with Vitest)** — `@vue/cli-plugin-unit-jest@5.0.9` hard-pins Jest 27. Vitest is the recommended replacement once Vite lands.
- **`@vue/vue3-jest` 27 → 29** — same hard pin.
- **`eslint` 8 → 10 + flat config (`eslint.config.js`)** — Vue CLI 4-era plugins fight flat config. Easier after `vue-cli-service lint` is replaced with `eslint --fix`.
- **`eslint-plugin-vue` 9 → 10** — pairs with ESLint 10 / flat config.
- **`uuid` 9 → 14** — v10+ is ESM-only with optional chaining in distributed code. webpack 4 couldn't transpile node_modules; webpack 5 may handle it but Vite handles it cleanly. After Vite, bump to latest.

## Independent bumps (can do anytime)

- **`vue-router` 4 → 5** — major. Read upgrade guide; small app means small surface, but it's a deliberate bump rather than incidental.
- **`sass-loader` 8 → 16** — drops out entirely with Vite (Vite uses `sass` peer dep directly). Skip if doing Vite.
- **`lint-staged` 9 → 16** — independent. Bump opportunistically.
- **`@vue/eslint-config-standard` 8 → 9** — minor cleanup.

## Architectural items beyond dependency bumps

- **Composition API / `<script setup>`** — current SFCs use Options API. Per-component migration is incremental. Better readability, smaller bundles, and pairs well with TypeScript reintroduction. Out of scope for the Vite/Pinia plan.
- **TypeScript reintroduction** — was removed because unused. With Composition API + Pinia, TS pays off. `<script setup lang="ts">` per-file means no big-bang.
- **Real test coverage** — single smoke test in `tests/unit/example.spec.js` is essentially nothing. Add component tests for `List.vue`, `Lists.vue`, `New.vue` and store tests once on Pinia + Vitest.
- **CI/CD** — GitHub Actions: lint + build on PR, auto-deploy `main` to Firebase Hosting. Add Dependabot or Renovate for ongoing dep hygiene (would have caught half this upgrade incrementally).
- **Node version pinning** — add `.nvmrc` and `engines` field in `package.json`. Avoids future Node-version surprises (we hit OpenSSL/MD4 issues during this upgrade).
- **Drop legacy bundle** — `vue-cli-service build --modern` is gone in CLI 5; current `package.json#scripts.build` still has `--modern` flag (no-op now but worth removing for clarity).
- **Firebase SDK modernization** — currently only Hosting is in use (per `firebase.json`). If runtime Firebase services are added later (Auth, Firestore), adopt the modular `firebase@9+` SDK pattern.

## State after 2026-05 upgrade (reference)

- 5 commits on `main` (`49e4029` → `2b83032`)
- Vulnerabilities: 151 → 40 (12 critical → 1 critical, 30 high → 16 high)
- Vue CLI 5 / webpack 5 / PostCSS 8 / Tailwind 3 / ESLint 8 / Jest 27 / Vue 3.5 / Pinia not yet adopted (still Vuex 4.1)
