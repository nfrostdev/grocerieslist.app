# Handoff 01 — Remove duplicate service worker

## Goal

Eliminate two competing service-worker registrations. `vite-plugin-pwa` (autoUpdate, generates `sw.js`) is enabled in `vite.config.js:9-23`, but the app *also* hand-registers a different SW at `service-worker.js` via `register-service-worker`. Two SWs racing → stale-cache and update-loop bugs.

## Current state

- `vite.config.js:9` registers VitePWA with `registerType: 'autoUpdate'` (generates and self-registers `sw.js`)
- `src/main.js:4` imports `'./registerServiceWorker'`
- `src/registerServiceWorker.js` calls `register('${BASE_URL}service-worker.js', …)` from `register-service-worker` package
- `package.json` deps include `register-service-worker ^1.7.2`

## Changes

1. Delete `src/registerServiceWorker.js`
2. `src/main.js`: remove the line `import './registerServiceWorker'`
3. `package.json`: remove `register-service-worker` from `dependencies`
4. `package-lock.json`: regenerate via `npm install` (no `--package-lock-only` shortcut — let npm resolve)

## Verification

- `npm run build` succeeds
- `npm run serve` → DevTools → Application → Service Workers shows exactly **one** active SW with scriptURL ending `/sw.js` (not `/service-worker.js`)
- `npm run test:unit` passes
- `npm run lint` passes

## Out of scope

- PWA manifest changes
- Cache strategy tuning
- Offline page UX
