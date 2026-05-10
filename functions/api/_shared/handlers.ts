import type { ItemRow, ListRow, TokenRow } from './types'
import { generateUlid, generateToken } from './ulid'
import { hashToken, authenticate } from './auth'
import { LIMITS, readJsonBody, validateItem } from './validate'

const TOMBSTONE_TTL_MS = 90 * 24 * 60 * 60 * 1000

export async function handleUpsertItem (
  db: D1Database,
  request: Request,
  listId: string,
  itemId: string
): Promise<Response> {
  const auth = await authenticate(db, request, listId)
  if (auth instanceof Response) return auth

  const parsed = await readJsonBody<Record<string, unknown>>(request)
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: parsed.status })

  const incoming = validateItem({ ...parsed.body, id: itemId })
  if (incoming === null) {
    return Response.json({ error: 'invalid item' }, { status: 400 })
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
    db.prepare('DELETE FROM items WHERE list_id = ? AND d = 1 AND u < ?').bind(listId, Date.now() - TOMBSTONE_TTL_MS)
  ])

  return Response.json({ item: incoming })
}

export async function handleProvision (db: D1Database, request: Request): Promise<Response> {
  const parsed = await readJsonBody<{ name?: unknown; items?: unknown }>(request)
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: parsed.status })
  const body = parsed.body

  if (typeof body.name !== 'string' || body.name.length === 0 || body.name.length > LIMITS.listNameMax) {
    return Response.json({ error: 'name required' }, { status: 400 })
  }

  const rawItems = Array.isArray(body.items) ? body.items : []
  if (rawItems.length > LIMITS.itemsMax) {
    return Response.json({ error: 'too many items' }, { status: 400 })
  }
  const items: ItemRow[] = []
  for (const raw of rawItems) {
    const item = validateItem(raw)
    if (item === null) return Response.json({ error: 'invalid item' }, { status: 400 })
    items.push(item)
  }

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
    ...items.map((item) =>
      db.prepare(
        'INSERT INTO items (list_id, id, n, q, c, u, d) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(listId, item.id, item.n, item.q, item.c, item.u, item.d)
    )
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

  const maxItemU = await db.prepare(
    'SELECT COALESCE(MAX(u), 0) AS m FROM items WHERE list_id = ?'
  ).bind(listId).first<{ m: number }>()

  const cursor = Math.max(list.u, maxItemU?.m ?? 0)

  const payload: Record<string, unknown> = { version: list.version, cursor, items }
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
  const parsed = await readJsonBody<{ token?: unknown }>(request)
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: parsed.status })
  const body = parsed.body

  if (!body.token || typeof body.token !== 'string' || body.token.length > 256) {
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

  const maxItemU = items.reduce((m, i) => Math.max(m, i.u), 0)
  const cursor = Math.max(list.u, maxItemU)

  return Response.json({
    listId: list.id,
    role: 'editor',
    name: list.name,
    version: list.version,
    cursor,
    items
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

  await db.prepare(
    'UPDATE list_tokens SET revoked_at = ? WHERE list_id = ? AND role = ?'
  ).bind(Date.now(), listId, 'editor').run()

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
    db.prepare('DELETE FROM lists WHERE id = ?').bind(listId)
  ])

  return Response.json({})
}
