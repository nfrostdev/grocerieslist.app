import type { ItemRow, ListRow, TokenRow } from './types'
import { generateUlid, generateToken } from './ulid'
import { hashToken, authenticate } from './auth'

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
