# Handoff 03 — Finish TypeScript migration

## Goal

Bring the last JS holdouts into TS. Most of the app already uses `<script setup lang="ts">` (views, store, classes). Remaining JS files are small.

## Current state

JS files left in `src/`:

- `src/main.js` — bootstrap (Vue, Pinia, Router, FA, mount)
- `src/router/index.js` — vue-router config, three routes
- `src/components/AppHeader.vue` — `<script setup>` (no `lang="ts"`), but it has no script logic — only template + style. Add `lang="ts"` only if a script block exists; otherwise skip this file.
- `src/components/ShareButton.vue` — `<script setup>` JS; types needed for `defineProps({ list: Object })` → use `defineProps<{ list: List }>()` with import from `@/classes/List`

After Handoff 01 lands, `src/registerServiceWorker.js` no longer exists.

## Changes

1. Rename `src/main.js` → `src/main.ts`. No type-only changes needed; ensure `index.html` script tag still resolves (Vite handles `.ts` automatically via the same import path; confirm `index.html` references `/src/main.ts` or via `<script type="module" src="/src/main.ts">`).
2. Rename `src/router/index.js` → `src/router/index.ts`. Type the routes with `RouteRecordRaw[]` from `vue-router`.
3. `src/components/ShareButton.vue`: change `<script setup>` to `<script setup lang="ts">`. Replace runtime `defineProps({ list: Object })` with `defineProps<{ list: List }>()` and `import type List from '@/classes/List'`. Type the local helpers (`copyToClipboard(text: string)`, `shareList(list: List)`).
4. `src/components/AppHeader.vue`: only touch if there's a `<script>` block. If template-only, leave alone.
5. `tsconfig.json`: after migration, flip `"allowJs": false` (or remove it — defaults to false). Leave `checkJs` removed since no JS remains. Keep `strict: true`.
6. `vite.config.js`: optional — rename to `.ts` if you want config typing, but not required for this handoff.

## Verification

- `npm run type-check` (vue-tsc --noEmit) clean
- `npm run build` succeeds
- `npm run test:unit` passes (existing tests import from `@/stores/lists` etc.)
- App boots in `npm run serve`, shares a list via ShareButton without runtime error

## Out of scope

- Migrating `tests/unit/**/*.spec.js` to `.spec.ts` (they already work; do separately if desired)
- Tightening `tsconfig` flags beyond removing `allowJs`
- Renaming domain-model property keys (`n`, `i`, etc. — separate handoff if pursued)
