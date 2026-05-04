# Handoff 04 — Refresh README

## Goal

README is stuck in Vue-CLI era. Replace with current Vite + Pinia + TS + Vitest + Firebase reality.

## Current state

`README.md` references `npm run serve` (Vite — still works), `npm run build`, `npm run test:unit`, `npm run lint`, plus a "See Configuration Reference" link to `cli.vuejs.org/config/` (dead context). Firebase commands are accurate.

## Changes

Rewrite `README.md` to cover, concisely:

- One-line what-is description (PWA grocery list, localStorage, Firebase Hosting)
- Tech stack bullet list (Vue 3.5, Vue Router 5, Pinia 3, Vite 7, Vitest 4, Tailwind 4, TypeScript 6, vite-plugin-pwa)
- Setup: `nvm use && npm ci`
- Scripts: `serve`, `build`, `type-check`, `test:unit`, `test:watch`, `test:coverage`, `lint`, `preview`
- Deploy: keep the existing two `firebase` commands (preview channel + production)
- Drop the `cli.vuejs.org` link

Keep it short. No badges, no logos, no contributing section.

## Verification

- `npm ci && npm run build` matches README's claim
- All script names listed match `package.json` scripts block
- `firebase deploy --project grocerieslist-app` and the preview-channel command both still resolve (don't actually run them — just verify spelling against `firebase.json` projectId)

## Out of scope

- Adding architecture docs
- Screenshots
- Contribution guidelines
