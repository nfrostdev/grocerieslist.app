# 10 — TypeScript reintroduction

## Why

TypeScript was removed from this project earlier because it wasn't
pulling its weight in the Options-API + Vuex era. With Composition API
(plan 09) and Pinia (already done), the calculus changes:

- `<script setup lang="ts">` types props, emits, and store calls
  inline. No separate type-files needed.
- Pinia stores are fully typed once the state and getters are typed —
  every consumer benefits.
- The class-based domain model (`Item`, `List`) is the highest-ROI
  surface for typing — it's central, small, and silently shared
  across the app.

This plan does **not** aim for 100% TS. It aims for typing the spots
where types catch real bugs, and leaving the rest as `.js` until they
need it.

## Prerequisites

- Plan 09 must be partially landed: at minimum, the components you
  intend to type must already be on `<script setup>`. `<script setup
  lang="ts">` only works on Composition-API SFCs.
- Plan 04 (ESLint flat config) should be in. Adding TS-aware lint
  rules to a legacy `.eslintrc.js` is wasted work.

## Steps

### 1. Toolchain

```
npm i -D typescript vue-tsc @vue/tsconfig
```

Add `tsconfig.json` at root:

```json
{
  "extends": "@vue/tsconfig/tsconfig.dom.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] },
    "allowJs": true,
    "checkJs": false,
    "strict": true
  },
  "include": ["src/**/*", "tests/**/*", "vite.config.js"]
}
```

`allowJs + checkJs: false` means TS happily ignores existing `.js`
files. We opt into typing per-file.

Update `package.json`:

```json
"build": "vue-tsc --noEmit && vite build",
"type-check": "vue-tsc --noEmit"
```

### 2. Type the domain model first

Highest ROI, smallest surface.

- `src/classes/Item.js` → `src/classes/Item.ts`
- `src/classes/List.js` → `src/classes/List.ts`

Start by promoting fields to typed properties, constructor params, and
methods. The uuid `substring(0, 8)` returns `string` — the truncated id
type is `string`, not `UUID`, and that's fine.

### 3. Type the Pinia store

`src/stores/lists.js` → `src/stores/lists.ts`. Pinia's `defineStore`
infers types from the state initializer; getters and actions get
typed automatically. Spot-check by hovering over `useListsStore()` in
a consumer — every member should be typed.

### 4. Convert components opportunistically

For each `<script setup>` component, change the opening tag to
`<script setup lang="ts">` and add types to:

- `defineProps<{ id: string }>()`  (note: generic form, not the runtime
  object form)
- `defineEmits<{ submit: [list: List] }>()`
- `ref<Item[]>([])`
- function parameters and returns where non-obvious

Start with the components most touched by the domain model: `List.vue`,
`Lists.vue`, `New.vue`. Leaves can stay `.js` until they're touched.

### 5. ESLint integration

Once at least one `.ts` file exists, add `typescript-eslint` to
`eslint.config.js`:

```
npm i -D typescript-eslint
```

```js
import tseslint from 'typescript-eslint'

export default [
  // ...existing config
  ...tseslint.configs.recommended
]
```

Don't enable `recommended-type-checked` yet — it's strict and the
incremental migration would fight it. Plain `recommended` is fine.

## Verification

```
npm run type-check
npm run build
npm run test:unit
npm run lint
```

All four clean. The first time `vue-tsc --noEmit` runs against a
`.ts` consumer of the Pinia store, it should catch any latent shape
mismatches.

In an editor: open `src/views/List.vue` (once converted), invoke
"Go to Definition" on `store.items` — confirm it lands on the typed
field in `src/stores/lists.ts`.

## Out of scope

- Converting test files to `.ts` — deferred until a test actually
  benefits from typing (rare for this app).
- Strict-mode upgrades to existing JS (`checkJs: true`). The cost of
  retrofitting JSDoc types is higher than just converting the file
  to `.ts` when it's touched.
- `vue-tsc` perf tuning. Project is small — full check is a few
  seconds.
