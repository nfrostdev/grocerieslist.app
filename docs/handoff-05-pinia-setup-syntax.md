# Handoff 05 — Pinia store → setup syntax

## Goal

Convert `useListsStore` from options-style (`state/getters/actions`) to setup syntax. Better TS inference, matches the rest of the codebase's `<script setup>` style.

## Current state

`src/stores/lists.ts:4-32`:

```ts
export const useListsStore = defineStore('lists', {
  state: () => ({ lists: [] as List[] }),
  getters: {
    getListFromId: (state) => (id: string) => state.lists.find(l => l.id === id)
  },
  actions: {
    init () { … },
    createList (list: List) { … },
    updateList (list: List) { … },
    deleteList (id: string) { … },
    persist () { … }
  }
})
```

Consumers: `src/App.vue:24`, `src/views/Lists.vue:24`, `src/views/List.vue:98`, `src/views/New.vue:24`. They use `useListsStore()`, then `.lists`, `.getListFromId`, `.createList`, `.updateList`, `.deleteList`, `.init`. Test file: `tests/unit/stores/lists.spec.js`.

## Changes

1. Rewrite `src/stores/lists.ts` with setup syntax:

   ```ts
   export const useListsStore = defineStore('lists', () => {
     const lists = ref<List[]>([])
     function getListFromId(id: string) { return lists.value.find(l => l.id === id) }
     function init() { /* reads localStorage, sets lists.value */ }
     function createList(list: List) { /* … */ }
     function updateList(list: List) { /* … */ }
     function deleteList(id: string) { /* … */ }
     function persist() { /* … */ }
     return { lists, getListFromId, init, createList, updateList, deleteList }
   })
   ```

   Note: `getListFromId` was a curried getter — under setup syntax it becomes a plain function returning the result directly. Update call sites if any used the curried form. (Audit shows call sites use `getListFromId(id)` as a function call, so this is a no-op.)

2. Don't export `persist` — it's internal.
3. Verify `tests/unit/stores/lists.spec.js` still passes; setup-syntax stores are still introspectable via `store.lists`, `store.createList(…)`, etc.

## Verification

- `npm run type-check` clean
- `npm run test:unit` passes — especially the `lists` store spec
- Manual: create a list, add an item, refresh → list persists (localStorage round-trip works)

## Out of scope

- Renaming `getListFromId` (could become `getById` but breaks call sites)
- Adding new actions (persist-on-change watcher, etc.)
- Migrating other stores (none exist)
