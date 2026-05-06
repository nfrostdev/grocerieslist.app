# grocerieslist.app

PWA grocery list with localStorage sync, hosted on Cloudflare Pages. Built with Vue 3.5, Vue Router 5, Pinia 3, Vite 7, Vitest 4, Tailwind 4, TypeScript 6, and vite-plugin-pwa.

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
