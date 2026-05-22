# grocerieslist.app — project guide

PWA grocery list with live sync. Vue 3.5 + Pinia 3 SPA, Cloudflare Pages + Pages Functions + D1 backend, no user accounts, capability tokens only.

**Status: maintenance mode.** Modernization (2026-05-04) and live-sync MVP (2026-05-09) both shipped. Expect defensive polish, bug fixes, dep bumps — not new features.

## Layout

| Path | Purpose |
|---|---|
| `src/` | Vue SPA (views, components, stores, classes, composables) |
| `src/sync/` | Sync runtime — `index.ts` (public API), `poll.ts`, `queue.ts`, `reconcile.ts`, `storage.ts`, `transport.ts`, `cleanup.ts`, `types.ts` |
| `functions/api/` | Cloudflare Pages Functions. Route files are one-line `PagesFunction` adapters around `_shared/handlers.ts` |
| `functions/api/_shared/` | `handlers.ts` (all handler bodies), `auth.ts`, `validate.ts`, `ulid.ts`, `types.ts` |
| `shared/` | Code reused on both sides — `crypto.ts` (sha256 hash), `roles.ts` (`'owner' \| 'editor'`) |
| `tests/unit/` | Vitest + jsdom, ~80% coverage thresholds |
| `tests/integration/` | Vitest against real D1 via miniflare |
| `tests/e2e/` | Playwright + axe-core (`smoke.spec.ts`, `sync.spec.ts`) |
| `schema.sql` | D1 schema — three tables: `lists`, `list_tokens`, `items` |
| `public/_headers`, `public/_redirects` | CSP + SPA fallback |
| `.github/workflows/` | `ci.yml` (lint + tests + build + e2e on PR), `gc-tombstones.yml` (nightly D1 sweep) |

## Stack

Vite 8, Vue 3.5, Pinia 3 (setup syntax), Vue Router 5, vue-tsc 3 / TypeScript 6, Tailwind 4 via `@tailwindcss/postcss`, ESLint 10 flat config + typescript-eslint, Vitest 4 + coverage, Playwright 1.60, vite-plugin-pwa, wrangler 4. Node `>=22.22.1 <23` (`.nvmrc`).

## Sync model (do not silently undo)

- **Polling** every 5s while tab visible — no Durable Objects, no WebSockets. Free tier only. Upgrade door is clean (same schema).
- **Per-list opt-in.** Lists never shared never leave the device.
- **Capability tokens, no accounts.** Tokens persisted in `localStorage` per list; sha256-hashed at rest server-side.
- **Owner vs editor.** Owner tokens are **not shareable** — server rejects them at `/join` (`functions/api/_shared/handlers.ts`). Sharing mints one editor token per list; revoke kills all editors at once. Role union lives in `shared/roles.ts`.
- **Item model = LWW per item row** (`{ id, n, q, c, u, d }`), not snapshot blob, not ops log. Soft-delete via `d=1`.
- **Equal-timestamp tie:** client uses strict `>` (existing wins on equal `u`); server upsert uses strict `>` (incoming wins on equal `u`). Inverse rules on purpose so two-clients-same-millisecond converges to server's view. See `src/stores/lists.ts:mergeList` and `functions/api/_shared/handlers.ts:handleUpsertItem`.
- **Optimistic local writes + durable op queue** (`src/sync/queue.ts`). Any 4xx → drop op. 5xx → backoff retry. 401/404 → shared `onAuthLost` handler (toast once, cleanup local).
- **Server-minted ULID** for list IDs (`functions/api/_shared/ulid.ts`). Client `crypto.randomUUID` only for item IDs and local-only list IDs.
- **Tombstones GC'd** on every successful poll server-side (`fix(sync): GC tombstones after every successful poll`) and locally by `useListsStore.gcTombstones` past `lastCursor` + 90d.

## Conventions

- **Routed views must have a single root element.** Vue fragments break `<Transition mode="out-in">` in real browsers (jsdom doesn't catch it). Wrap in a `<div>`. Regression guard: `tests/unit/views/List.spec.ts` asserts `wrapper.element.parentElement.childNodes.length === 1`.
- **Tailwind 4 + Vue SFC:** every `<style lang="scss">` that uses `@apply` needs `@reference "../assets/main.css";` at the top (path relative to the component). `@reference "tailwindcss"` is not enough — `@theme` tokens live in `main.css`.
- **Vitest spec files:** all `import` statements before any `vi.mock()` call (ESLint `import-x/first` enforces textual order). Use `vi.resetAllMocks()` in `beforeEach` whenever any test sets `mockReturnValue`/`mockResolvedValue` — `clearAllMocks` leaves return-value overrides in place.
- **Explicit-consent friction for surprising mutations.** Prompt rather than silently auto-do (e.g. `ConfirmModal` for destructive ops).
- **No console.log in shipped code.** ESLint warns in production; `console.warn` is fine for recoverable storage failures.
- **No comments that describe *what*** — let names do that. Reserve comments for non-obvious *why*: invariant, prior incident, deliberate trade-off (the LWW tie-break comments are the model).

## What's gone — do not reintroduce

- Firebase hosting — moved to Cloudflare Pages (`3459a5d`). No `firebase.json`.
- QR snapshot share flow — `src/utils/share.ts`, `ImportModal.vue`, `pako` dep all deleted in M4. `qrcode` retained only to render the live-sync share URL in `ShareSheet.vue`.
- `uuid` dep — server mints ULIDs.
- `lists.u`, `lists.version`, `lists.name_ciphertext`, `items_by_tombstone` index, list-rename wiring — all dropped post-MVP as unused.
- `SyncMeta.editorTokens[]` (labelled per-editor tokens) — replaced by single `SyncMeta.shareToken?`.
- In-app rate-limit code — never landed (#61 closed). Live as zone-level WAF rules. See [Rate limiting](#rate-limiting).

## Rate limiting

Enforced at Cloudflare zone level (Security → WAF → Rate Limiting Rules), not in app code. Active rule: `(starts_with(http.request.uri.path, "/api/lists") and http.request.method eq "POST")` — 15 req / 10s per IP, block 10s. Only on the custom domain, not `*.pages.dev`. New limits = new WAF rule first, reach for code only if WAF can't express it.

## Dependency maintenance

`renovate.json` is checked in but **Renovate is not installed on this repo** — config is dormant, no bot has ever opened a PR. Dependabot also off. Manual bumps:

```
npm update
npm run lint && npm run type-check && npm run test:unit
```

Caret ranges generally cover patch/minor without touching `package.json`. Recent example: `153de45 chore(deps): bump patch/minor versions via npm update`.

## Commands

| Command | What |
|---|---|
| `npm ci` | Install (after `nvm use`) |
| `npm run serve` | Vite dev server with HMR |
| `npm run build` | `vue-tsc --noEmit && vite build` |
| `npm run type-check` | Type-check only |
| `npm run lint` | ESLint with `--fix` |
| `npm run test:unit` | Unit tests (vitest + jsdom) |
| `npm run test:coverage` | Unit tests + coverage report |
| `npm run test:integration` | Integration tests against miniflare D1 |
| `npm run test:e2e` | Playwright + axe accessibility checks |
| `npm run dev:pages` | `wrangler pages dev dist/` (serves built app + Functions) |

CI on PR runs lint → coverage → integration:coverage → build → e2e. All must pass.

## Threat model snapshot

Zero PII server-side. One leaked token = one list's name + items, nothing else. CSP blocks inline scripts and third-party origins. Tokens sha256-hashed in D1. Revocation rotates server-side; old editors disconnect on next 5s poll. Full writeup in `SECURITY.md`.

## When you propose a change

- "Modernization" / "migration" work is done — don't suggest it.
- Don't propose adding accounts, WebSockets, Durable Objects, end-to-end encryption, or default-on sync. Each was deliberately chosen against. If a real user constraint changes, revisit the decision rather than patching around it.
- Match the post-MVP work shape: defensive polish, bug fixes, dep bumps. Small PRs against `main`. Cloudflare Pages auto-deploys on push.
