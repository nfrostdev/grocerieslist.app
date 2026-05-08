# Live Sync MVP — Implementation Plan

**Status:** Drafted 2026-05-08. Not yet started.
**Replaces:** Existing QR snapshot share (`src/utils/share.ts`, `src/components/ImportModal.vue`, pako encoding). Those go away in M4.

## 1. Goal

Allow two or more devices to keep a grocery list in sync continuously, with edits propagating in seconds. Replace the current one-shot QR snapshot share with a persistent shared-list model.

## 2. Design constraints (locked)

- **Zero PII on the server.** No users table, no email, no name, no OAuth. Capability tokens are the only credential.
- **Low surface area.** Five endpoints, two D1 tables, one Pages Functions deploy. No third-party services.
- **Opt-in per list.** Lists are local-only by default. Sharing a list is the deliberate action that provisions it on the server.
- **Offline-first.** Mutations apply locally instantly. Network is a background reconciler, not a gate.
- **No accounts, no recovery.** Lose all devices that hold a list's tokens, lose the list. Documented tradeoff.

## 3. Architecture

```
Browser                     Cloudflare Pages
─────────                   ────────────────────────────────
Vue + Pinia        ─HTTPS─► Pages Functions  ──► D1 (SQLite)
src/sync/                   functions/api/...     lists, list_tokens, items
  queue                                           
  poll                                            
  transport
```

No Durable Objects, no WebSockets, no Workers Paid plan. Polling-based sync over plain HTTPS to Pages Functions, free tier.

### 3.1 Cost model

At free tier:
- Pages Functions: 100k invocations/day
- D1: 5M reads/day, 100k writes/day, 5 GB storage

Capacity headroom comfortably supports ~1.5k MAU at 5s polling. Past that, $5/mo Workers Paid lifts the ceilings. Upgrade to Durable Objects + WebSockets becomes economic only past several thousand active users.

## 4. Data model

### 4.1 Client (`src/classes/`)

- `List` unchanged in shape. Gains an optional `u: number` field for list-level LWW (rename). Existing localStorage blobs without `u` are read as `u = 0`.
- `Item` unchanged.
- No `synced` flag on `List` — presence in `syncMeta` is the source of truth.

### 4.2 Client-side localStorage keys

- `lists` (existing) — full lists blob, written on every mutation.
- `syncMeta` (new) — `{ [listId]: { authToken, role: 'owner' | 'editor', lastVersion: number, label?: string } }`. Token never co-located with list contents.
- `pendingOps` (new) — FIFO `Op[]` for the durable op queue.

### 4.3 Server (D1)

```sql
CREATE TABLE lists (
  id TEXT PRIMARY KEY,             -- ULID, server-minted at provision
  name_ciphertext TEXT,            -- plain in MVP (E2E deferred), keep column name future-compat
  name TEXT NOT NULL,
  u INTEGER NOT NULL DEFAULT 0,    -- name_updated_at, for LWW
  version INTEGER NOT NULL DEFAULT 1,  -- bumped on any mutation; clients poll ?since=<version>
  schema_version INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE TABLE list_tokens (
  token_hash TEXT PRIMARY KEY,     -- sha256(authToken), base64url
  list_id TEXT NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  role TEXT NOT NULL,              -- 'owner' | 'editor'
  created_at INTEGER NOT NULL,
  revoked_at INTEGER
);
CREATE INDEX list_tokens_by_list ON list_tokens(list_id);

CREATE TABLE items (
  list_id TEXT NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  id TEXT NOT NULL,                -- client uuid (8-char) — keep client-minted, scope is per-list
  n TEXT NOT NULL,                 -- name
  q TEXT NOT NULL,                 -- quantity
  c INTEGER NOT NULL DEFAULT 0,    -- checked
  u INTEGER NOT NULL,              -- updated timestamp
  d INTEGER NOT NULL DEFAULT 0,    -- tombstone
  PRIMARY KEY (list_id, id)
);
CREATE INDEX items_by_version ON items(list_id, u);
```

Notes:
- `list_tokens.token_hash` is the primary key. The cleartext token is never stored. Server hashes incoming tokens to look up.
- `items.id` stays client-minted (existing 8-char uuid prefix). Collision risk is per-list, not global, so 32 bits is fine for grocery list sizes.
- `items` table retains tombstones (`d=1`) forever in MVP. GC deferred.
- `lists.version` is a monotonic counter incremented in the same transaction as any item or list-level write. Clients poll `?since=<version>` to receive only changed rows.

## 5. Endpoints

All endpoints live under `functions/api/` and authenticate via the `Authorization: Bearer <authToken>` header. Auth tokens are never sent in URLs.

### 5.1 `POST /api/lists` — provision

Promotes a local list to a synced list. Owner-side action.

```
Request:  { name: string, items: Item[] }
Response: { id: ULID, authToken: string, encKey?: never (deferred to M5) }
```

Server:
1. Generates ULID for `lists.id`.
2. Generates 256-bit `authToken` (base64url ~43 chars).
3. Inserts `lists`, `list_tokens` (role='owner'), and all `items` in one transaction.
4. Returns the cleartext token exactly once.

### 5.2 `POST /api/lists/:id/join` — join via link

Recipient action. Token is supplied in the request body (came from the share link's fragment).

```
Request:  { token: string }
Response: { listId, role: 'editor', name, version, items: Item[] }
          OR 401 if token invalid/revoked, 404 if list missing
```

The server marks the token as `editor` if not already present (multi-use links — see §7.2).

### 5.3 `GET /api/lists/:id?since=<version>` — poll

```
Auth:     Bearer authToken
Response: { version, name?, nameUpdatedAt?, items: Item[] }
          OR 401 (token revoked), 404 (list deleted)
```

`name` and `nameUpdatedAt` returned only if changed since `since`. `items` includes only rows where `u > since`. Client merges via the existing per-item LWW logic, applies tombstones (extending current `mergeList`), and updates `syncMeta[listId].lastVersion`.

### 5.4 `POST /api/lists/:id/items/:itemId` — upsert item

Idempotent upsert, keyed by `(list_id, id)`.

```
Request:  Item ({ id, n, q, c, u, d })
Response: 200 { item: Item }   — canonical server row (echoes request if accepted, or returns winning row if stale)
          OR 401, 404
```

If the supplied `u` is `<` the existing row's `u`, server returns the existing row unchanged (canonical). Client reconciles immediately rather than waiting for the next poll.

In the same transaction, `lists.version` is incremented.

### 5.5 `PATCH /api/lists/:id` — rename list

```
Request:  { name: string, u: number }
Response: 200 { name, u } (canonical) OR 401, 404
```

LWW on `lists.u`. Increments `lists.version`.

### 5.6 `POST /api/lists/:id/tokens` — mint editor token (owner-only)

```
Auth:     Bearer ownerAuthToken
Response: { token: string }   — fresh editor token, returned once
```

Used when the owner wants to issue a *new* link rather than reuse the original. Optional UI; the original link is multi-use.

### 5.7 `POST /api/lists/:id/tokens/revoke` — revoke a token (owner-only)

```
Request:  { tokenHash: string }   — hash, since cleartext is unknown to server-side UI
Response: 200
```

Sets `revoked_at`. Future requests using that token return `401`. Owner cannot revoke their own owner token via this endpoint.

### 5.8 `DELETE /api/lists/:id` — hard delete (owner-only)

Cascade-deletes `items` and `list_tokens`. Other devices' next poll receives `404`.

## 6. Client implementation

### 6.1 Module layout

```
src/sync/
├── index.ts          — public API: provision(), join(), revoke(), deleteList(), startPolling()
├── queue.ts          — pendingOps in localStorage, drainer with retry+backoff
├── poll.ts           — visibility-aware poll loop per list
├── transport.ts      — fetch wrappers, Authorization header, error normalization
├── reconcile.ts      — apply server payload → store mutations
└── types.ts
```

### 6.2 Pinia integration

`src/stores/lists.ts` mutations gain a single line at the end:

```ts
function updateItem (listId, itemId, patch) {
  writeList(listId, l => { ... })
  const meta = sync.getMeta(listId)
  if (meta) sync.enqueue({ kind: 'upsertItem', listId, item: updatedItem })
}
```

Same pattern for `addItem`, `softDeleteItem`, list rename, list delete. The store remains synchronous and never awaits. Sync is fire-and-forget into the queue.

Existing `mergeList` is reused for incoming server payloads, with one fix: it must respect tombstones (`d=1` overrides locally). This is a small fix needed regardless of sync — the current behavior is buggy.

### 6.3 Op queue lifecycle

```
1. User mutates: store updates locally, persists `lists`, enqueues op into `pendingOps`.
2. Drainer (idle promise loop): pops head, POSTs, on 200 removes it, on network failure backs off.
3. Server returns canonical row → drainer hands it to reconcile module → store applies LWW → re-persists.
4. Polling runs in parallel and is unaware of the queue.
```

The drainer processes ops strictly in order per list (ordering across lists doesn't matter). Failure modes:
- Network error → exponential backoff (1s, 2s, 4s, ..., capped at 60s), op stays in queue.
- `401` (revoked) → drop the queue for that list, remove `syncMeta[listId]`, remove the list locally, surface a toast.
- `404` (deleted) → same as `401` but different toast copy.
- `409`/other → log, leave op queued for now (no expected case in MVP — 409 isn't used).

### 6.4 Polling lifecycle

One poller per synced list, started on app mount and on join. Each poller:

```
loop:
  if document.hidden: await visibilitychange
  fetch GET /api/lists/:id?since=<lastVersion>
  on 200: reconcile(payload), update lastVersion
  on 401/404: cleanup, exit
  on network error: backoff
  await min(5s, sleepUntilNextTick)
```

Visible→hidden pauses; hidden→visible triggers an immediate poll before resuming the 5s rhythm.

### 6.5 Provision flow (existing local list → synced)

User taps **Share** on a local list:

```
1. POST /api/lists with { name, items: stripTombstones(list.i) }
2. Server returns { id: ULID, authToken }
3. Client: rename local list (lists[idx].id = ULID), write syncMeta[ULID] = { authToken, role: 'owner', lastVersion: 1 }
4. ShareSheet displays join link: https://app/#join=<ULID>.<authToken>
   Renders QR of that URL (qrcode dep stays). Web Share + Copy buttons reuse existing UI.
```

### 6.6 Join flow (recipient opens link)

`App.vue` parses `#join=` on mount and on `hashchange`:

```
1. Split fragment → { listId, authToken }
2. If syncMeta[listId] exists already: history.replaceState to strip fragment, router.push, done.
3. POST /api/lists/:listId/join with { token: authToken }
4. On 200: store.replaceList(payload), syncMeta[listId] = { authToken, role: 'editor', lastVersion: payload.version }
5. history.replaceState to strip #join= from URL
6. router.push to /list/:listId
7. Start poller for this list
```

### 6.7 Revoke and delete (owner UI)

In a list's settings panel (owner only):

- A list of editor tokens with their client-side labels (e.g., "Sarah's iPhone" — labels live in owner's localStorage, never sent to server).
- Revoke button per editor → `POST /api/lists/:id/tokens/revoke`.
- "Delete shared list" button → `DELETE /api/lists/:id` → local removal + leaves the list page.

Editors don't see this panel.

### 6.8 What gets deleted in M4

- `src/utils/share.ts` (replaced by `src/sync/`)
- `src/components/ImportModal.vue` (no more import-as-copy / merge / replace UX)
- `pako` dependency
- `@types/pako` dev dependency
- Related tests under `tests/unit/share.spec.ts` and `tests/unit/ImportModal.spec.ts`
- The QR snapshot encoding/decoding logic; `qrcode` stays for rendering join links.

## 7. Open questions to revisit

These were flagged during planning and should be re-resolved before M3:

### 7.1 List-level mutation details (Q9 revisit)

Specifically the tombstone retention strategy and whether list-level fields beyond `name` (e.g., a hypothetical `archived` flag) are in scope. Current plan assumes:

- Tombstones retained forever in MVP. GC deferred until a list demonstrably crosses a size threshold.
- Hard delete on owner action; recipients learn via 404 next poll.
- 401 vs 404 status differentiation for "revoked" vs "deleted/missing."

Revisit before M3.

### 7.2 Token reuse semantics edge cases

Multi-use editor tokens are the chosen default. Open subtleties:
- Should the server cap how many devices can join via one token? (No, in MVP.)
- Should joining a second time from the same device replace the previous join entry? (Currently a no-op — `syncMeta` already exists.)
- Does the owner see "5 devices joined via this link" in the revoke panel? (Out of scope until UI is built.)

## 8. Milestones

Each milestone is one PR. Each leaves the app in a deployable, internally-consistent state.

### M1 — Read-only sync (provisioning + join + polling)

- D1 schema + migration via `wrangler d1 execute`
- Endpoints: `POST /api/lists`, `POST /api/lists/:id/join`, `GET /api/lists/:id?since=`
- ULID generation utility (server-side)
- Token hashing (sha256, base64url)
- `src/sync/` skeleton: types, transport, poll, reconcile (no queue yet)
- ShareSheet repurposed to call provision + render join link as QR
- App.vue parses `#join=`, calls join endpoint
- Owner edits don't sync to recipient yet (recipient sees provision-time snapshot + any future server-state changes via poll)
- Integration tests against miniflare for the three endpoints

**Scope check:** at end of M1, two devices can see the same list, but only the owner's edits visible to themselves. Useful as a checkpoint for verifying the data plane.

### M2 — Bidirectional edits

- Endpoints: `POST /api/lists/:id/items/:itemId`, `PATCH /api/lists/:id`
- `src/sync/queue.ts` — durable op queue, drainer, retry/backoff
- Store actions enqueue ops on synced lists
- Server returns canonical row on stale `u`; client reconciles
- `mergeList` fix to respect `d=1` tombstones (separately useful)
- Integration tests for upsert idempotency, stale `u` handling, tombstone propagation

**Scope check:** at end of M2, sync works.

### M3 — Revoke and delete

- Endpoints: `POST /api/lists/:id/tokens`, `POST /api/lists/:id/tokens/revoke`, `DELETE /api/lists/:id`
- Owner UI: device list with labels, revoke buttons, delete-list button
- Client handles `401` and `404` distinctly (toast copy + local removal)
- List rename gets `u` field client-side, PATCH endpoint server-side
- **Q9 revisit before merging this milestone**

### M4 — Cleanup + e2e

- Delete `src/utils/share.ts`, `src/components/ImportModal.vue`, related tests
- Drop pako and `@types/pako` from package.json
- Playwright e2e: two browser contexts, full flow (provision → join → mutate → revoke)
- a11y assertions on new sync UI (revoke panel, share dialog)
- Update README with the new sharing model

## 9. Test strategy

- **Unit (Vitest):** queue logic, poll state machine, reconciliation/LWW with tombstones, transport with mocked fetch, ULID format. Threshold: ≥80% line coverage on `src/sync/`.
- **Integration (Vitest + miniflare):** endpoints against ephemeral D1 (`:memory:`). Each endpoint gets a focused suite. Token-auth, role-enforcement, idempotency, version monotonicity, cascade delete.
- **E2E (Playwright, M4 only):** two browser contexts, full provision → join → mutate → revoke flow. Adds axe a11y on new UI.

CI updates: GitHub Actions `ci.yml` adds a step that runs `wrangler d1 execute --local --file=schema.sql` against an ephemeral DB before integration tests.

## 10. Future work (explicit non-goals for this MVP)

These were considered and deferred. Revisit when there's a concrete reason.

- **End-to-end encryption.** Plan exists (token + separate `encKey` in share link, AES-GCM per item, server stores ciphertext). Adds ~1 milestone of work. Worth it if the use case shifts to anything sensitive, or for a privacy-marketing claim. Schema columns reserved (`name_ciphertext` placeholder) so adoption doesn't break shape.
- **Account/OAuth upgrade path.** No identity provider, no users table. If "lose all devices = lose list" becomes a real complaint, add Google OAuth as an optional account-link without changing the capability-token model.
- **Push notifications.** No Web Push subscriptions. PWA shell stays.
- **Roles beyond owner/editor.** No viewers, no per-item permissions.
- **Tombstone GC.** When/if any list crosses ~1k items including tombstones, add a Cron Trigger.
- **Live presence indicators.** No "spouse is editing" cursors.
- **CRDT.** Per-item LWW is sufficient for grocery-list edit patterns. Yjs/Automerge deferred indefinitely.
- **Cross-list operations on the server.** No "list all my lists" endpoint, no list discovery.
- **Server-side rate limiting beyond Cloudflare's edge defaults.**
- **Schema migrations.** `schema_version = 1` only. Bumping is a future-Claude problem.
- **Item history / audit log.** Server stores current state, not change log.
- **Owner transfer.** No "promote editor to owner" or "transfer ownership."
- **Real-time over WebSockets / Durable Objects.** Polling is sufficient at projected scale; upgrade to DO + WS becomes economic past several thousand active users.

## 11. Decisions log

Captured during the planning interview, 2026-05-08:

- Q1: Live sync replaces QR snapshot share entirely. Sender authoritative on first share. No merge UX.
- Q2: Per-list opt-in. Lists local-only by default. Sharing is the deliberate promote action.
- Q3: Server data model is per-item rows mirroring the `Item` shape. Polling via `?since=<version>`.
- Q4: Owner + editor token roles. Owner can revoke and delete.
- Q5: Optimistic local writes + durable op queue. Server returns canonical row on stale `u`.
- Q6: Visibility-aware polling, 5s visible / paused hidden, immediate poll on focus, exponential backoff on errors.
- Q7: Sync logic in store actions; new `src/sync/` module; `syncMeta` and `pendingOps` in separate localStorage keys; no `synced` flag on `List`.
- Q8: Server-minted IDs. Provision happens at Share. Re-join is a navigate. Strip fragment after consumption. Multi-use editor tokens.
- Q9: List rename gains `u` for LWW. Hard delete on owner action. 404/401/200 status differentiation. Tombstones retained forever in MVP. **Flagged for revisit before M3.**
- Q10: ULID for server-minted list IDs. Plain JSON wire format. Pako deleted.
- Q11: Test strategy is unit + integration via miniflare in M1-M3, E2E added in M4. ≥80% coverage on `src/sync/`.
- Q12: Vertical-slice milestones M1-M4 as described above. No feature flag.
- Q13: E2E encryption deferred. Reasoning: grocery list content not sensitive enough to justify the additional complexity. Plan retained for future adoption.
