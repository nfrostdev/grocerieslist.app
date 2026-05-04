# Handoff 08 — Playwright E2E smoke

## Goal

One end-to-end smoke spec covering the critical path: create list → add item → toggle checked → reload (persistence) → share-link round-trip via `?import=`. Catches the kinds of regressions vite-plugin-pwa caching, Pinia rewrites, or browser-API drift introduce.

## Current state

- Vitest unit tests exist for stores/views/components (`tests/unit/**`)
- No E2E framework
- App is single-origin, localStorage-backed — Playwright handles this trivially

## Changes

1. `npm i -D @playwright/test`
2. `npx playwright install --with-deps chromium` (only Chromium for CI speed)
3. New `playwright.config.ts`:

   ```ts
   import { defineConfig } from '@playwright/test'
   export default defineConfig({
     testDir: './tests/e2e',
     fullyParallel: true,
     reporter: 'list',
     use: {
       baseURL: 'http://localhost:4173',
       trace: 'on-first-retry'
     },
     webServer: {
       command: 'npm run build && npm run preview -- --port 4173',
       url: 'http://localhost:4173',
       reuseExistingServer: !process.env.CI,
       timeout: 120_000
     },
     projects: [{ name: 'chromium', use: { browserName: 'chromium' } }]
   })
   ```

4. New `tests/e2e/smoke.spec.ts`:
   - Visit `/`
   - Click "create one" → land on `/new`
   - Type list name "Test", submit → land on `/:id`
   - Add item "Apples" qty 3 → assert visible
   - Toggle checked → assert moves to "Checked Items" section
   - Reload page → assert item still present (localStorage persists)
   - Read URL by clicking share button (or programmatically build the `?import=` URL via `btoa(JSON.stringify(...))`); navigate to it in a fresh context with cleared storage; assert list imports
5. `package.json` scripts: add `"test:e2e": "playwright test"`
6. `.github/workflows/ci.yml`: add a step `- run: npx playwright install --with-deps chromium` then `- run: npm run test:e2e` after the unit tests.
7. `.gitignore`: add `/playwright-report` and `/test-results`

## Verification

- `npm run test:e2e` passes locally
- CI workflow on PR runs E2E and passes
- Intentionally break `useListsStore.persist()` (e.g. comment out the localStorage write) → reload assertion fails

## Out of scope

- Multi-browser matrix (firefox/webkit)
- Visual regression
- Accessibility (axe) checks — separate handoff if pursued
- Mobile emulation
