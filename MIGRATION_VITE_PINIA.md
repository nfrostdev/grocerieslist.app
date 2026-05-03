# Architecture Migration Plan — Vite, then Pinia

## Context

The codebase finished a dependency upgrade (Vue 3.5 / vue-router 4.6 / vuex 4.1 / Vue CLI 5 / webpack 5 / PostCSS 8 / Tailwind 3 / ESLint 8). Several improvements remain blocked behind toolchain choices: Tailwind 4, Vitest, modern uuid, ESLint 9 flat config, and faster dev iteration all assume Vite. Vuex is in maintenance mode; Pinia is the official Vue state-management recommendation. This plan executes both migrations in two clearly separated phases so each can be smoke-tested in isolation.

The codebase is small (7 SFCs ~775 LOC, single-file Vuex store, 4 store consumers, 1 jest smoke test) and clean (no `require.context`, no webpack-specific tricks, all Options API, only PWA metadata in `vue.config.js`). Both migrations are mostly mechanical.

## Working Agreement

- Branch: `chore/vite-pinia-2026-XX` off `main`
- One commit per labeled step. After each commit: pause, smoke test, then continue.
- Verification baseline: `npm run lint`, `npm run test:unit`, `npm run build`, `npm run dev` + manual browser smoke (golden path: create list → add items → check off → reload preserves state).
- Rollback per step: `git revert <commit>`. Each step adds before removing so reverts are clean.
- **Out of scope:** Composition API / `<script setup>` migration, TypeScript reintroduction, ESLint 9 flat config, Tailwind 4, vue-router 5, expanding test coverage, Firebase deploy changes.

---

## Phase 1 — Vue CLI / webpack → Vite

Vuex stays untouched throughout Phase 1 to isolate variables.

### Step 1.1 — Add Vite alongside Vue CLI (parallel build paths)

**Goal:** Land Vite + plugins, prove dev + prod build + PWA work, *without* removing Vue CLI yet.

**Commands:**
```bash
npm i -D vite @vitejs/plugin-vue vite-plugin-pwa
```

**New files:**

`vite.config.js`:
```js
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'robots.txt', 'img/icons/*'],
      manifest: {
        name: 'Groceries List',
        short_name: 'Groceries List',
        theme_color: '#111827',
        background_color: '#111827',
        icons: [
          { src: '/img/icons/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/img/icons/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: '/img/icons/android-chrome-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      }
    })
  ],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } }
})
```

`index.html` (move from `public/index.html`, replace EJS):
```html
<link rel="icon" href="/icon.svg">
<title>Groceries List</title>
<!-- … and add before </body>: -->
<script type="module" src="/src/main.js"></script>
```

Apple/MS meta tags (porting from old `vue.config.js#pwa`):
```html
<meta name="theme-color" content="#111827">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black">
<meta name="msapplication-TileColor" content="#111827">
<link rel="apple-touch-icon" href="/img/icons/apple-touch-icon.png">
```

**Source patches (env vars only — no Vuex/component logic touched):**
- `src/registerServiceWorker.js` line 5: `process.env.NODE_ENV === 'production'` → `import.meta.env.PROD`
- `src/registerServiceWorker.js` line 6: `process.env.BASE_URL` → `import.meta.env.BASE_URL`
- `src/router/index.js` line 23: `process.env.BASE_URL` → `import.meta.env.BASE_URL`
- `src/router/index.js` lines 13/18: strip `/* webpackChunkName: "..." */` comments (cosmetic)

**`package.json` scripts (additive — Vue CLI still default):**
```json
"dev": "vite",
"build:vite": "vite build",
"preview": "vite preview"
```

**Verification:**
- `npm run dev` → golden path on `http://localhost:5173`
- `npm run build:vite && npm run preview` → DevTools › Application › Service Workers shows registered SW. Reload offline still serves shell.
- `npm run serve` and `npm run build` (Vue CLI) still work — fallback intact.

**Rollback:** `git revert`. Vue CLI scripts still produce the original build.

**Abort if:** vite-plugin-pwa can't generate a manifest matching the iOS install behavior (revisit icon paths).

**Commit:** `build: add vite toolchain alongside vue-cli`

---

### Step 1.2 — Cut over to Vite, remove Vue CLI

**Goal:** Vite is canonical. Webpack stack gone.

**Commands:**
```bash
npm uninstall @vue/cli-service \
  @vue/cli-plugin-babel @vue/cli-plugin-eslint @vue/cli-plugin-pwa \
  @vue/cli-plugin-router @vue/cli-plugin-vuex @vue/cli-plugin-unit-jest \
  sass-loader
```

**Files touched:**
- Delete `vue.config.js`
- Delete `babel.config.js`
- Delete `public/index.html` (root-level `index.html` from 1.1 is now canonical)
- `package.json`: `"serve": "vite"`, `"build": "vite build"`, drop `"build:vite"`, swap `lint-staged` glob runner from `vue-cli-service lint` → `eslint --fix`. Add top-level `"lint": "eslint . --ext .js,.vue"`.
- `.eslintrc.js`: drop `parserOptions.babelOptions` block (no more `@vue/cli-plugin-babel/preset`). Keep `parser: '@babel/eslint-parser'` with `requireConfigFile: false`. Add `parserOptions.ecmaVersion: 'latest'` and `sourceType: 'module'`.

**Verification:** `npm run serve`, `npm run build`, `npm run lint` all green. Smoke test the golden path. `dist/` deployable to Firebase Hosting unchanged.

**Rollback:** `git revert`.

**Abort if:** ESLint can't parse SFCs without the babel preset (unlikely — modern ECMAScript syntax is in espree's defaults).

**Commit:** `build: remove vue-cli, vite is canonical`

---

### Step 1.3 — Jest 27 → Vitest

**Goal:** Tests reuse Vite config; unblock further Jest-related upgrades.

**Commands:**
```bash
npm uninstall jest jest-environment-jsdom @vue/vue3-jest
npm i -D vitest jsdom
```

**Files touched:**
- Delete `jest.config.js`
- `vite.config.js`: add `test: { environment: 'jsdom', globals: true }` (Vitest reads it)
- `package.json`: `"test:unit": "vitest run"`
- `tests/unit/example.spec.js`: with `globals: true` no import changes needed; verify it runs as-is
- `.eslintrc.js`: drop the `overrides` block (jest env) since the only spec uses globals matching standard test names. Re-add if it surfaces lint errors.

**Verification:** `npm run test:unit` passes. `npm run lint` clean.

**Rollback:** `git revert`.

**Abort if:** `@vue/test-utils@2` misbehaves under Vitest (extremely unlikely — documented combo).

**Commit:** `test: migrate jest smoke spec to vitest`

### --- PAUSE: Phase 1 complete, smoke-test before Phase 2 ---

---

## Phase 2 — Vuex → Pinia

### Step 2.1 — Install Pinia, create store, wire into main.js (Vuex still mounted)

**Goal:** Both stores exist for one commit. Per-component cutover follows.

**Commands:**
```bash
npm i pinia
```

**New file:** `src/stores/lists.js` (Pinia convention is plural `stores/`):
```js
import { defineStore } from 'pinia'

export const useListsStore = defineStore('lists', {
  state: () => ({ lists: [] }),
  getters: {
    getListFromId: (state) => (id) => state.lists.find(list => list.id === id)
  },
  actions: {
    init () {
      const raw = localStorage.getItem('lists')
      if (raw) this.lists = JSON.parse(raw)
    },
    createList (list) {
      this.lists.push(list)
      this.persist()
    },
    updateList (list) {
      list.i.sort((a, b) => a.n > b.n ? 1 : -1)
      const i = this.lists.findIndex(l => l.id === list.id)
      this.lists[i] = list
      this.persist()
    },
    deleteList (id) {
      this.lists.splice(this.lists.findIndex(l => l.id === id), 1)
      this.persist()
    },
    persist () {
      localStorage.setItem('lists', JSON.stringify(this.lists))
    }
  }
})
```

Note: drops the cosmetic `setTimeout(..., 0) → Promise` wrap from each Vuex action. It served no purpose; Pinia actions are intentionally synchronous. Consumers using `.then()` get inlined in 2.2.

**`src/main.js`:** add `import { createPinia } from 'pinia'` and `.use(createPinia())` *before* `.use(store)`. Vuex still imported and mounted.

**Verification:** App runs unchanged (consumers still use Vuex). Vue DevTools → Pinia tab shows empty `lists` store.

**Commit:** `feat(store): introduce pinia alongside vuex`

---

### Step 2.2 — Migrate 4 consumers to `mapStores`

**Goal:** Flip every `this.$store.*` reference to Pinia. Mechanical edit, single commit.

Pattern (Options API friendly):
```js
import { mapStores } from 'pinia'
import { useListsStore } from '@/stores/lists'

computed: {
  ...mapStores(useListsStore)  // exposes this.listsStore
}
```

**Per-file diffs:**
- `src/App.vue` — `this.$store.state.lists` → `this.listsStore.lists`. `dispatch('init').then(...)` → `this.listsStore.init(); /* inline then-body */`. `dispatch('updateList', x)` → `this.listsStore.updateList(x)`. `dispatch('createList', x)` → `this.listsStore.createList(x)`.
- `src/views/Lists.vue` — `state.lists` → `listsStore.lists`; `dispatch('deleteList', id)` → `listsStore.deleteList(id)`.
- `src/views/New.vue` — `dispatch('createList', x)` → `listsStore.createList(x)`. Inline the `.then` body. Read-after-write `state.lists[length-1].id` → `listsStore.lists.at(-1).id`.
- `src/views/List.vue` — `getters.getListFromId(id)` → `listsStore.getListFromId(id)`. Five `dispatch('updateList', x).then(() => updateLocalList())` → `listsStore.updateList(x); this.updateLocalList()` (sync chain).

**Verification:** `npm run test:unit`, `npm run lint`, full golden-path smoke test on every route. `localStorage` persistence preserved across reload.

**Rollback:** `git revert`. Vuex still wired in main.js; rolled-back consumers go back to using it.

**Commit:** `refactor: migrate consumers from vuex to pinia via mapStores`

---

### Step 2.3 — Remove Vuex

**Goal:** Final cleanup.

**Commands:**
```bash
npm uninstall vuex
```

**Files touched:**
- Delete `src/store/index.js` (and the empty `src/store/` directory)
- `src/main.js`: drop `import store from './store'` and `.use(store)`

**Verification:** `npm run build`, `npm run test:unit`, golden-path smoke. `grep -r 'vuex\|\$store' src/` returns nothing.

**Commit:** `chore: remove vuex, pinia is canonical`

---

## Final Verification (after Step 2.3)

- `npm run build` clean
- `npm run test:unit` green (Vitest)
- `npm run lint` clean
- `npm run dev` golden path: create list → name → add items → check off → reload (state preserved) → delete list → all routes load
- `npm run preview` (prod build) → DevTools › Application › Service Workers active; offline reload serves shell
- `npm audit` no new criticals
- `grep -r 'vue-cli-service\|vuex\|\$store\|process\.env' src/ vite.config.js` returns nothing
- Files gone: `vue.config.js`, `babel.config.js`, `jest.config.js`, `public/index.html`, `src/store/index.js`
- Files added: `vite.config.js`, `index.html` (root), `src/stores/lists.js`

## Critical Files

**Created:**
- `vite.config.js`
- `index.html` (repo root)
- `src/stores/lists.js`

**Modified:**
- `package.json`
- `.eslintrc.js`
- `src/main.js`
- `src/registerServiceWorker.js`
- `src/router/index.js`
- `src/App.vue`
- `src/views/List.vue` (largest consumer diff: 1 getter + 5 dispatches)
- `src/views/Lists.vue`
- `src/views/New.vue`

**Deleted:**
- `vue.config.js`
- `babel.config.js`
- `jest.config.js`
- `public/index.html`
- `src/store/index.js`
