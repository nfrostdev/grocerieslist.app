# Security

## Threat model

grocerieslist.app has no user accounts and stores no PII server-side. Lists are local-only by default. When a user shares a list, the server provisions a row and returns an opaque **capability token** — the only credential needed to read or write that one list. Anyone holding the token has editor access to that list and only that list.

The data at risk per leaked token: the list name and items (item names, quantities, completion state). No other lists, no email, no contacts, no payment data.

## `authToken` storage in `localStorage`

The capability token is persisted in `localStorage` per list — see `SyncMeta.authToken` in `src/sync/types.ts` and the wrapper functions in `src/sync/storage.ts`. We chose `localStorage` over `sessionStorage` or in-memory storage so that:

- Tokens survive page reloads and browser restarts (sharing a list once is enough — users don't re-enter anything).
- Multiple tabs of the same origin can sync in lockstep.
- "Stop sharing" can revoke server-side without needing the client online.

The trade-off: any successful XSS on this origin can read the token from `localStorage` and exfiltrate it. We accept this risk because the blast radius is bounded — one list's contents — and revocation is one click.

## Mitigations

- **CSP** (`public/_headers`): `default-src 'self'`, `script-src 'self'` (no `'unsafe-inline'`, no `'unsafe-eval'`), `connect-src 'self'`, `frame-ancestors 'none'`. Inline scripts and external endpoints are blocked, which substantially reduces XSS exfiltration paths.
- **Revocation** is one click. "Stop sharing" rotates the server-side token store; all editors disconnect on their next 5-second poll.
- **Token scope** is one list. A leaked token never grants access to a second list, even one owned by the same person.
- **Server-side storage**: only `SHA-256(token)` is stored (`hashToken` in `shared/crypto.ts`). The server cannot reconstruct a token from its database row.

## Reporting a vulnerability

Please open a private security advisory via GitHub's "Report a vulnerability" flow on this repository, or email the maintainer (see commit history / GitHub profile). Do not open public issues for security reports.
