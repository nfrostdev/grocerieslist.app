import type { ItemRow, ListRow, TokenRow } from './types'
import { generateUlid, generateToken, isUlid } from './ulid'
import { authenticate } from './auth'
import { hashToken } from '../../../shared/crypto'
import { ROLES } from '../../../shared/roles'
import { LIMITS, readJsonBody, validateItem } from './validate'

function invalidListId (): Response {
  return Response.json({ error: 'invalid list id' }, { status: 400 })
}

export async function handleUpsertItem (
  db: D1Database,
  request: Request,
  listId: string,
  itemId: string
): Promise<Response> {
  if (!isUlid(listId)) return invalidListId()
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

  // LWW with strict `>`: on equal `u`, the incoming write is accepted.
  // The client uses the inverse rule (existing wins on equal `u`) so both
  // sides converge to the server's view on rare same-millisecond collisions.
  if (existing && existing.u > incoming.u) {
    return Response.json({ item: existing })
  }

  await db.batch([
    db.prepare(
      `INSERT INTO items (list_id, id, n, q, c, u, d) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(list_id, id) DO UPDATE
       SET n=excluded.n, q=excluded.q, c=excluded.c, u=excluded.u, d=excluded.d`
    ).bind(listId, itemId, incoming.n, incoming.q, incoming.c, incoming.u, incoming.d),
    db.prepare('UPDATE lists SET version = version + 1 WHERE id = ?').bind(listId)
  ])

  return Response.json({ item: incoming })
}

export async function handleProvision (db: D1Database, request: Request): Promise<Response> {
  const parsed = await readJsonBody<{ name?: unknown; items?: unknown }>(request)
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: parsed.status })
  const body = parsed.body

  if (typeof body.name !== 'string' || body.name.length > LIMITS.listNameMax) {
    return Response.json({ error: 'name required' }, { status: 400 })
  }
  const name = body.name.trim()
  if (name.length === 0) {
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
      'INSERT INTO lists (id, name, version, created_at) VALUES (?, ?, 1, ?)'
    ).bind(listId, name, now),
    db.prepare(
      'INSERT INTO list_tokens (token_hash, list_id, role, created_at) VALUES (?, ?, ?, ?)'
    ).bind(tokenHash, listId, ROLES.owner, now),
    ...items.map((item) =>
      db.prepare(
        'INSERT INTO items (list_id, id, n, q, c, u, d) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(listId, item.id, item.n, item.q, item.c, item.u, item.d)
    )
  ])

  return Response.json({ id: listId, authToken, role: ROLES.owner })
}

export async function handlePoll (
  db: D1Database,
  request: Request,
  listId: string
): Promise<Response> {
  if (!isUlid(listId)) return invalidListId()
  const auth = await authenticate(db, request, listId)
  if (auth instanceof Response) return auth

  const url = new URL(request.url)
  const sinceRaw = url.searchParams.get('since')
  const since = sinceRaw === null ? 0 : Number(sinceRaw)
  if (!Number.isInteger(since) || since < 0) {
    return Response.json({ error: 'invalid since' }, { status: 400 })
  }

  const list = await db.prepare(
    'SELECT id, version FROM lists WHERE id = ?'
  ).bind(listId).first<Pick<ListRow, 'id' | 'version'>>()

  if (!list) return Response.json({ error: 'Not Found' }, { status: 404 })

  const { results: items } = await db.prepare(
    'SELECT id, n, q, c, u, d FROM items WHERE list_id = ? AND u > ?'
  ).bind(listId, since).all<ItemRow>()

  const maxItemU = await db.prepare(
    'SELECT COALESCE(MAX(u), 0) AS m FROM items WHERE list_id = ?'
  ).bind(listId).first<{ m: number }>()

  const cursor = maxItemU?.m ?? 0

  return Response.json({ version: list.version, cursor, items })
}

export async function handleJoin (
  db: D1Database,
  request: Request,
  listId: string
): Promise<Response> {
  if (!isUlid(listId)) return invalidListId()
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
    'SELECT id, name FROM lists WHERE id = ?'
  ).bind(listId).first<Pick<ListRow, 'id' | 'name'>>()

  if (!list) return Response.json({ error: 'Not Found' }, { status: 404 })

  const { results: items } = await db.prepare(
    'SELECT id, n, q, c, u, d FROM items WHERE list_id = ? AND d = 0'
  ).bind(listId).all<ItemRow>()

  const maxItemU = await db.prepare(
    'SELECT COALESCE(MAX(u), 0) AS m FROM items WHERE list_id = ?'
  ).bind(listId).first<{ m: number }>()

  const cursor = maxItemU?.m ?? 0

  return Response.json({
    listId: list.id,
    role: ROLES.editor,
    name: list.name,
    cursor,
    items
  })
}

export async function handleMintToken (
  db: D1Database,
  request: Request,
  listId: string
): Promise<Response> {
  if (!isUlid(listId)) return invalidListId()
  const auth = await authenticate(db, request, listId)
  if (auth instanceof Response) return auth
  if (auth.role !== 'owner') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const authToken = generateToken()
  const tokenHash = await hashToken(authToken)
  const now = Date.now()

  // Replace any prior editor rows for this list so enable/disable cycles
  // don't grow list_tokens unbounded over the lifetime of a list.
  await db.batch([
    db.prepare('DELETE FROM list_tokens WHERE list_id = ? AND role = ?').bind(listId, 'editor'),
    db.prepare(
      'INSERT INTO list_tokens (token_hash, list_id, role, created_at) VALUES (?, ?, ?, ?)'
    ).bind(tokenHash, listId, 'editor', now)
  ])

  return Response.json({ token: authToken })
}

export async function handleRevokeToken (
  db: D1Database,
  request: Request,
  listId: string
): Promise<Response> {
  if (!isUlid(listId)) return invalidListId()
  const auth = await authenticate(db, request, listId)
  if (auth instanceof Response) return auth
  if (auth.role !== 'owner') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  await db.prepare(
    'DELETE FROM list_tokens WHERE list_id = ? AND role = ?'
  ).bind(listId, 'editor').run()

  return Response.json({})
}

export async function handleDeleteList (
  db: D1Database,
  request: Request,
  listId: string
): Promise<Response> {
  if (!isUlid(listId)) return invalidListId()
  const auth = await authenticate(db, request, listId)
  if (auth instanceof Response) return auth
  if (auth.role !== 'owner') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  await db.batch([
    db.prepare('DELETE FROM items WHERE list_id = ?').bind(listId),
    db.prepare('DELETE FROM list_tokens WHERE list_id = ?').bind(listId),
    db.prepare('DELETE FROM lists WHERE id = ?').bind(listId)
  ])

  return Response.json({})
}
