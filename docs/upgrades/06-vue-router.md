# 06 — Vue Router major bump

## Why

Backlog calls out `vue-router 4 → 5`. As of writing, `vue-router@4` is
still the current major in the Vue 3 ecosystem; "5" may have shipped by
the time this is executed. Treat this plan as "bump to current stable
major; if that's still 4, this plan is a no-op".

## Surface

The router is one file: `src/router/index.js`. Three routes, all using
`createRouter` / `createWebHistory`. No navigation guards, no
`beforeRouteEnter`, no scroll-behavior config, no per-route meta. The
migration surface is essentially nil — but a major bump means upstream
will have changed *something*, and we want to find out under controlled
conditions.

```
import { createRouter, createWebHistory } from 'vue-router'
import Lists from '../views/Lists.vue'
const routes = [
  { path: '/',     name: 'Lists', component: Lists },
  { path: '/new',  name: 'New',   component: () => import('../views/New.vue') },
  { path: '/:id',  name: 'List',  component: () => import('../views/List.vue') }
]
const router = createRouter({ history: createWebHistory(import.meta.env.BASE_URL), routes })
export default router
```

Templates use `<router-link>` and `<router-view>` (search to confirm).
Components likely call `this.$router.push(...)` — confirm via grep.

## Steps

1. `npm view vue-router version`. If still `4.x`, stop — this plan is
   currently out of scope; revisit when v5 ships.
2. If v5+ exists: read the official upgrade guide end-to-end before
   touching code. Common breaking changes in router majors:
   - Async component syntax for routes
   - History mode constructors renamed
   - `<router-link>` props (e.g. `tag` removal — already gone in v4)
   - Composition-API-only navigation hooks
3. `npm i vue-router@latest`.
4. Apply guide changes to `src/router/index.js`. Search and update any
   `$router` / `$route` / `useRouter` / `useRoute` call sites.
5. Run the test suite and the dev server.

## Verification

```
npm run build
npm run test:unit
npm run serve
```

Manual smoke:

1. Load `/` → Lists view renders.
2. Click "new list" → URL becomes `/new`, New view renders.
3. Submit → URL becomes `/<id>`, List view renders.
4. Browser back button → returns to `/new`, then to `/`.
5. Direct-load `/<id>` for an existing id → List view renders, store
   hydrates correctly.

## Out of scope

Adding navigation guards, scroll behavior, or route-level code splitting
optimizations. The router stays minimal.
