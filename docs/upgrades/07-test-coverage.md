# 07 — Real test coverage

## Why

`tests/unit/example.spec.js` is a single smoke test. It verifies the
test runner works, nothing else. Renovate / CI / refactors all need
real coverage to be useful: without tests, every dependency bump is a
"hope it builds" exercise.

The pieces needed to write good tests are all in place:

- `vitest@^4` (test runner, jsdom env, globals on)
- `@vue/test-utils@^2.4` (component mounting)
- `pinia@^3` with the canonical `createTestingPinia` story for store
  testing

## Scope

Three classes of test, in priority order:

### 1. Store tests — `src/stores/lists.js`

Highest ROI. Pure logic, no DOM. Cover:

- Initial state shape.
- Each action (add list, remove list, add item, toggle item, remove
  item — whatever the store actually exposes).
- Persistence to localStorage if the store does that (verify with a
  `localStorage` spy, not a real one).

### 2. Component tests — views

- `src/views/Lists.vue` — renders empty state and N-list state.
- `src/views/New.vue` — submit handler creates a list and navigates.
- `src/views/List.vue` — renders items, toggles them, deletes them.

Mount with `createTestingPinia({ initialState })` to inject
deterministic store state. Use `@vue/test-utils` `mount` (not
`shallowMount` — these views are small enough to render fully).

### 3. Component tests — leaves

- `src/components/AppHeader.vue` — title rendering, conditional UI.
- `src/components/ShareButton.vue` — click handler invokes
  `navigator.share` (mock it via `vi.stubGlobal`).

`HelloWorld.vue` is unused boilerplate — delete it instead of testing
it. (Verify it's unimported first: `grep -r "HelloWorld" src/`.)

## Setup work

1. Add coverage tooling:
   ```
   npm i -D @vitest/coverage-v8 @pinia/testing
   ```
2. Add scripts to `package.json`:
   ```json
   "test:unit": "vitest run",
   "test:watch": "vitest",
   "test:coverage": "vitest run --coverage"
   ```
3. Add coverage config to `vite.config.js#test`:
   ```js
   test: {
     environment: 'jsdom',
     globals: true,
     coverage: {
       provider: 'v8',
       reporter: ['text', 'html'],
       include: ['src/**'],
       exclude: ['src/main.js', 'src/registerServiceWorker.js']
     }
   }
   ```
4. Optional: a `tests/setup.js` for global mocks (e.g. `localStorage`,
   `navigator.share`) — wire it via `test.setupFiles`.

## File layout

```
tests/
  unit/
    stores/
      lists.spec.js
    views/
      Lists.spec.js
      New.spec.js
      List.spec.js
    components/
      AppHeader.spec.js
      ShareButton.spec.js
```

Delete `tests/unit/example.spec.js` once at least one real test exists.

## Verification

```
npm run test:coverage
```

Targets — not enforced as gates yet, just informational:

- `src/stores/lists.js` — > 90% lines.
- `src/views/*.vue` — > 70% lines.
- `src/components/*.vue` — > 70% lines.

Once numbers stabilize, plan 08 (CI) will turn these into PR checks.

## Out of scope

E2E tests (Playwright / Cypress). The app is small enough that
component-level coverage plus manual smoke is enough for now.
