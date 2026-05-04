# grocerieslist.app

PWA grocery list with localStorage sync and Firebase Hosting. Built with Vue 3.5, Vue Router 5, Pinia 3, Vite 7, Vitest 4, Tailwind 4, TypeScript 6, and vite-plugin-pwa.

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

## Deploy

```
# Preview channel
firebase hosting:channel:deploy preview --project grocerieslist-app

# Production
firebase deploy --project grocerieslist-app
```
