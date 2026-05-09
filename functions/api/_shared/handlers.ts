import type { ItemRow, ListRow, TokenRow } from './types'
import { generateUlid, generateToken } from './ulid'
import { hashToken, authenticate } from './auth'

const TOMBSTONE_TTL_MS = 90 * 24 * 60 * 60 * 1000

export async function handleUpsertItem (
  db: D1Database,
  request: Request,
  listId: string,
  itemId: string
): Promise<Response> {
  const auth = await authenticate(db, request, listId)
  if (auth instanceof Response) return auth

  let body: { n?: unknown; q?: unknown; c?: unknown; u?: unknown; d?: unknown }
  try {
    body = await request.json() as typeof body
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (typeof body.n !== 'string' || typeof body.u !== 'number') {
    return Response.json({ error: 'n and u required' }, { status: 400 })
  }

  const incoming: ItemRow = {
    id: itemId,
    n: body.n,
    q: typeof body.q === 'string' ? body.q : '',
    c: typeof body.c === 'number' ? body.c : 0,
    u: body.u,
    d: typeof body.d === 'number' ? body.d : 0,
  }

  const existing = await db.prepare(
    'SELECT id, n, q, c, u, d FROM items WHERE list_id = ? AND id = ?'
  ).bind(listId, itemId).first<ItemRow>()

  if (existing && existing.u > incoming.u) {
    return Response.json({ item: existing })
  }

  await db.batch([
    db.prepare(
      `INSERT INTO items (list_id, id, n, q, c, u, d) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(list_id, id) DO UPDATE
       SET n=excluded.n, q=excluded.q, c=excluded.c, u=excluded.u, d=excluded.d`
    ).bind(listId, itemId, incoming.n, incoming.q, incoming.c, incoming.u, incoming.d),
    db.prepare('UPDATE lists SET version = version + 1 WHERE id = ?').bind(listId),
    db.prepare('DELETE FROM items WHERE list_id = ? AND d = 1 AND u < ?').bind(listId, Date.now() - TOMBSTONE_TTL_MS),
  ])

  return Response.json({ item: incoming })
}

export async function handlePatchList (
  db: D1Database,
  request: Request,
  listId: string
): Promise<Response> {
  const auth = await authenticate(db, request, listId)
  if (auth instanceof Response) return auth

  let body: { name?: unknown; u?: unknown }
  try {
    body = await request.json() as typeof body
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (typeof body.name !== 'string' || typeof body.u !== 'number') {
    return Response.json({ error: 'name and u required' }, { status: 400 })
  }

  const list = await db.prepare(
    'SELECT id, name, u, version FROM lists WHERE id = ?'
  ).bind(listId).first<ListRow>()

  if (!list) return Response.json({ error: 'Not Found' }, { status: 404 })

  if (list.u > body.u) {
    return Response.json({ name: list.name, u: list.u })
  }

  await db.batch([
    db.prepare(
      'UPDATE lists SET name = ?, u = ?, version = version + 1 WHERE id = ?'
    ).bind(body.name, body.u, listId),
  ])

  return Response.json({ name: body.name, u: body.u })
}

export async function handleProvision (db: D1Database, request: Request): Promise<Response> {
  let body: { name?: unknown; items?: unknown }
  try {
    body = await request.json() as { name?: unknown; items?: unknown }
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.name || typeof body.name !== 'string') {
    return Response.json({ error: 'name required' }, { status: 400 })
  }

  const items = Array.isArray(body.items) ? body.items as ItemRow[] : []
  const listId = generateUlid()
  const authToken = generateToken()
  const tokenHash = await hashToken(authToken)
  const now = Date.now()

  await db.batch([
    db.prepare(
      'INSERT INTO lists (id, name, u, version, schema_version, created_at) VALUES (?, ?, 0, 1, 1, ?)'
    ).bind(listId, body.name, now),
    db.prepare(
      'INSERT INTO list_tokens (token_hash, list_id, role, created_at) VALUES (?, ?, ?, ?)'
    ).bind(tokenHash, listId, 'owner', now),
    ...items.map((item: ItemRow) =>
      db.prepare(
        'INSERT INTO items (list_id, id, n, q, c, u, d) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(listId, item.id, item.n, item.q, item.c ?? 0, item.u ?? now, item.d ?? 0)
    ),
  ])

  return Response.json({ id: listId, authToken })
}

export async function handlePoll (
  db: D1Database,
  request: Request,
  listId: string
): Promise<Response> {
  const auth = await authenticate(db, request, listId)
  if (auth instanceof Response) return auth

  const url = new URL(request.url)
  const since = parseInt(url.searchParams.get('since') ?? '0', 10)

  const list = await db.prepare(
    'SELECT id, name, u, version FROM lists WHERE id = ?'
  ).bind(listId).first<ListRow>()

  if (!list) return Response.json({ error: 'Not Found' }, { status: 404 })

  const { results: items } = await db.prepare(
    'SELECT id, n, q, c, u, d FROM items WHERE list_id = ? AND u > ?'
  ).bind(listId, since).all<ItemRow>()

  const payload: Record<string, unknown> = { version: list.version, items }
  if (list.u > since) {
    payload.name = list.name
    payload.nameUpdatedAt = list.u
  }

  return Response.json(payload)
}

export async function handleJoin (
  db: D1Database,
  request: Request,
  listId: string
): Promise<Response> {
  let body: { token?: unknown }
  try {
    body = await request.json() as { token?: unknown }
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.token || typeof body.token !== 'string') {
    return Response.json({ error: 'token required' }, { status: 400 })
  }

  const hash = await hashToken(body.token)
  const tokenRow = await db.prepare(
    'SELECT list_id, role, revoked_at FROM list_tokens WHERE token_hash = ? AND list_id = ?'
  ).bind(hash, listId).first<TokenRow>()

  if (!tokenRow || tokenRow.revoked_at != null) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const list = await db.prepare(
    'SELECT id, name, u, version FROM lists WHERE id = ?'
  ).bind(listId).first<ListRow>()

  if (!list) return Response.json({ error: 'Not Found' }, { status: 404 })

  const { results: items } = await db.prepare(
    'SELECT id, n, q, c, u, d FROM items WHERE list_id = ?'
  ).bind(listId).all<ItemRow>()

  return Response.json({
    listId: list.id,
    role: 'editor',
    name: list.name,
    version: list.version,
    items,
  })
}

export async function handleMintToken (
  db: D1Database,
  request: Request,
  listId: string
): Promise<Response> {
  const auth = await authenticate(db, request, listId)
  if (auth instanceof Response) return auth
  if ((auth as TokenRow).role !== 'owner') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const authToken = generateToken()
  const tokenHash = await hashToken(authToken)
  const now = Date.now()

  await db.prepare(
    'INSERT INTO list_tokens (token_hash, list_id, role, created_at) VALUES (?, ?, ?, ?)'
  ).bind(tokenHash, listId, 'editor', now).run()

  return Response.json({ token: authToken })
}

export async function handleRevokeToken (
  db: D1Database,
  request: Request,
  listId: string
): Promise<Response> {
  const auth = await authenticate(db, request, listId)
  if (auth instanceof Response) return auth
  if ((auth as TokenRow).role !== 'owner') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { tokenHash?: unknown }
  try {
    body = await request.json() as typeof body
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (typeof body.tokenHash !== 'string') {
    return Response.json({ error: 'tokenHash required' }, { status: 400 })
  }

  const authHeader = request.headers.get('Authorization')!
  const requesterHash = await hashToken(authHeader.slice(7))
  if (requesterHash === body.tokenHash) {
    return Response.json({ error: 'Cannot revoke own token' }, { status: 400 })
  }

  await db.prepare(
    'UPDATE list_tokens SET revoked_at = ? WHERE token_hash = ? AND list_id = ?'
  ).bind(Date.now(), body.tokenHash, listId).run()

  return Response.json({})
}

export async function handleDeleteList (
  db: D1Database,
  request: Request,
  listId: string
): Promise<Response> {
  const auth = await authenticate(db, request, listId)
  if (auth instanceof Response) return auth
  if ((auth as TokenRow).role !== 'owner') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  await db.batch([
    db.prepare('DELETE FROM items WHERE list_id = ?').bind(listId),
    db.prepare('DELETE FROM list_tokens WHERE list_id = ?').bind(listId),
    db.prepare('DELETE FROM lists WHERE id = ?').bind(listId),
  ])

  return Response.json({})
}
