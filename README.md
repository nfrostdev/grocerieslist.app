# grocerieslist.app

PWA grocery list with live sync, hosted on Cloudflare Pages. Built with Vue 3.5, Vue Router 5, Pinia 3, Vite 7, Vitest 4, Tailwind 4, TypeScript 6, and vite-plugin-pwa.

## Sharing

Lists are local-only by default. Tap the share button on any list to provision it on the server and get a join link. Anyone with the link can join and edits sync in both directions via 5-second polling. No accounts — capability tokens are the only credential. Stop sharing at any time to revoke all editors at once.

## Setup

```
nvm use && npm ci
```

## Scripts

| Command | Description |
|---|---|
| `npm run serve` | Dev server with hot reload |
| `npm run build` | Type-check + production build |
| `npm run type-check` | TypeScript type checking only |
| `npm run test:unit` | Run unit tests once |
| `npm run test:watch` | Run unit tests in watch mode |
| `npm run test:coverage` | Run unit tests with coverage report |
| `npm run lint` | Lint and fix files |
| `npm run preview` | Preview production build locally |
| `npm run test:e2e` | Run Playwright e2e tests (includes axe accessibility checks) |

## Accessibility

Target: WCAG 2.2 AAA where feasible; AA floor on color contrast (4.5:1 minimum, 7:1 target).
All routes are verified via axe-core at `serious`/`critical` severity — run `npm run test:e2e` to check.

## Deploy

Cloudflare Pages auto-deploys on push to `main`. Pull requests get preview deploys automatically.
