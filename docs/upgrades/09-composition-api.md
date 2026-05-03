# 09 — Composition API / `<script setup>` migration

## Why

Current SFCs are Options API. Composition API + `<script setup>` gives:

- Smaller bundles (the `setup` compiler hoists more aggressively).
- Better TypeScript ergonomics — prerequisite for plan 10.
- Direct `useListsStore()` calls instead of `mapStores`, removing a
  layer of indirection introduced during the Pinia migration.
- Better readability for components with several reactive concerns.

This is incremental. Each component is one PR. There is no big-bang
rewrite, and there is no goal of converting 100% — convert components
when you're already touching them, and convert the views proactively
because that's where the size is.

## Order

Leaf-first. Each layer should be green before moving to the next.

1. **`src/components/AppHeader.vue`** — likely the smallest, least
   stateful. Good warm-up.
2. **`src/components/ShareButton.vue`** — has a click handler and
   probably a `navigator.share` call. Still small.
3. **`src/components/HelloWorld.vue`** — only convert if it's still
   used. Per plan 07, this is probably dead code; delete instead.
4. **`src/views/New.vue`** — form view. Form bindings + submit handler
   + router push. Tractable.
5. **`src/views/List.vue`** — most complex view. Item list, toggles,
   deletions. Convert after the simpler ones to absorb patterns.
6. **`src/views/Lists.vue`** — list of lists. Should be straightforward
   after the others.

## Per-component template

```vue
<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useListsStore } from '@/stores/lists'

const router = useRouter()
const listsStore = useListsStore()

// reactive state from data() → ref()
// computed from computed: { } → computed(() => ...)
// methods → plain functions (no `this`)
// lifecycle hooks → onMounted etc.
// emits → defineEmits(['eventName'])
// props → defineProps({ ... })
</script>

<template>
  <!-- unchanged -->
</template>

<style scoped>
  /* unchanged */
</style>
```

Mechanical mapping reference:

| Options API                | Composition API                        |
| -------------------------- | -------------------------------------- |
| `data() { return {...} }`  | `const x = ref(...)` per field         |
| `computed: { foo() {} }`   | `const foo = computed(() => ...)`      |
| `methods: { bar() {} }`    | `function bar() {}`                    |
| `props: {...}`             | `const props = defineProps({...})`     |
| `emits: [...]`             | `const emit = defineEmits([...])`      |
| `mounted() {}`             | `onMounted(() => {})`                  |
| `this.$router`             | `useRouter()`                          |
| `this.$route`              | `useRoute()`                           |
| `mapStores(useListsStore)` | `const store = useListsStore()`        |
| `this.listsStore.items`    | `store.items` (no `.value` for stores) |

## Per-component steps

1. Write or update the component test first (or confirm the test from
   plan 07 covers behaviour you care about).
2. Convert the component.
3. Run `npm run test:unit -- <test-file>`.
4. Run `npm run lint`.
5. Run `npm run serve` and click through the relevant flow.
6. Commit: `refactor(<component>): migrate to <script setup>`.

## Verification

After all six are done:

- `grep -rn "export default {" src/` → no matches in `.vue` files
  (Options API is gone, modulo `App.vue` if you choose to keep it).
- `grep -rn "mapStores\|mapState\|mapActions" src/` → no matches.
- All component tests pass.
- All views render correctly under manual smoke.

## Out of scope

- TypeScript — that's plan 10 and depends on this one.
- Renaming files. Keep `Lists.vue` / `List.vue` / `New.vue` — the
  collision risk is paid for, it's familiar to the codebase, and
  renaming is a separate decision.
- Splitting components further. Some views may grow `useXxx()`
  composables for reuse — fine if obvious, otherwise leave inline.
