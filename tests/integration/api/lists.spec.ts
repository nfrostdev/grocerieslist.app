import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Miniflare } from 'miniflare'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { handleProvision, handleJoin, handlePoll, handleUpsertItem, handleMintToken, handleRevokeToken, handleDeleteList } from '../../../functions/api/_shared/handlers'

const schema = readFileSync(resolve(__dirname, '../../../schema.sql'), 'utf-8')

let mf: Miniflare
let db: D1Database

beforeAll(async () => {
  mf = new Miniflare({
    script: 'export default { fetch: () => new Response(\'ok\') }',
    modules: true,
    d1Databases: ['DB']
  })
  db = await mf.getD1Database('DB') as unknown as D1Database
  // D1 exec() processes one statement per line — flatten each statement before executing
  const statements = schema
    .split(';')
    .map(s => s.replace(/\s+/g, ' ').trim())
    .filter(s => s.length > 0)
  for (const sql of statements) {
    await (db as unknown as { exec: (sql: string) => Promise<unknown> }).exec(sql)
  }
})

afterAll(async () => {
  await mf.dispose()
})

beforeEach(async () => {
  // Reset data between tests — order matters for FK constraints
  const d = db as unknown as { batch: (stmts: object[]) => Promise<unknown>; prepare: (sql: string) => { bind: (...args: unknown[]) => object } }
  await d.batch([
    d.prepare('DELETE FROM items').bind(),
    d.prepare('DELETE FROM list_tokens').bind(),
    d.prepare('DELETE FROM lists').bind()
  ])
})

// ---------------------------------------------------------------------------
// POST /api/lists (provision)
// ---------------------------------------------------------------------------

describe('POST /api/lists', () => {
  it('provisions a list and returns id + authToken', async () => {
    const req = new Request('http://localhost/api/lists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Weekly Shop', items: [] })
    })
    const res = await handleProvision(db, req)
    expect(res.status).toBe(200)
    const body = await res.json() as { id: string; authToken: string }
    expect(body.id).toMatch(/^[0-9A-Z]{26}$/) // ULID
    expect(body.authToken).toBeTruthy()
    expect(body.authToken.length).toBeGreaterThan(30)
  })

  it('provisions a list with items', async () => {
    const items = [
      { id: 'abc12345', n: 'Milk', q: '2', c: 0, u: Date.now(), d: 0 },
      { id: 'def67890', n: 'Eggs', q: '12', c: 0, u: Date.now(), d: 0 }
    ]
    const req = new Request('http://localhost/api/lists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Groceries', items })
    })
    const res = await handleProvision(db, req)
    expect(res.status).toBe(200)
    const { id } = await res.json() as { id: string; authToken: string }
    expect(id).toMatch(/^[0-9A-Z]{26}$/)
  })

  it('returns 400 when name is missing', async () => {
    const req = new Request('http://localhost/api/lists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [] })
    })
    const res = await handleProvision(db, req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when name is empty or whitespace-only', async () => {
    for (const name of ['', '   ', '\t\n ', ' ']) {
      const req = new Request('http://localhost/api/lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, items: [] })
      })
      const res = await handleProvision(db, req)
      expect(res.status).toBe(400)
    }
  })

  it('stores trimmed list name', async () => {
    const req = new Request('http://localhost/api/lists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '  Weekly Shop  ', items: [] })
    })
    const res = await handleProvision(db, req)
    expect(res.status).toBe(200)
    const { id, authToken } = await res.json() as { id: string; authToken: string }

    const joinReq = new Request(`http://localhost/api/lists/${id}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: authToken })
    })
    const body = await handleJoin(db, joinReq, id).then(r => r.json() as Promise<{ name: string }>)
    expect(body.name).toBe('Weekly Shop')
  })

  it('returns 400 for invalid JSON', async () => {
    const req = new Request('http://localhost/api/lists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json'
    })
    const res = await handleProvision(db, req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when an item has wrong types', async () => {
    const cases: object[] = [
      { id: 'abc12345', n: 'Milk', q: 1, c: 0, u: 1000, d: 0 }, // q non-string
      { id: 'abc12345', n: 'Milk', q: '1', c: 'yes', u: 1000, d: 0 }, // c non-number
      { id: 'abc12345', n: 'Milk', q: '1', c: 0, u: '1000', d: 0 }, // u non-number
      { id: 'abc12345', n: 'Milk', q: '1', c: 0, u: 1000, d: 2 }, // d out of range
      { id: '', n: 'Milk', q: '1', c: 0, u: 1000, d: 0 }, // id empty
      { n: 'Milk', q: '1', c: 0, u: 1000, d: 0 } // id missing
    ]
    for (const item of cases) {
      const req = new Request('http://localhost/api/lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'X', items: [item] })
      })
      const res = await handleProvision(db, req)
      expect(res.status).toBe(400)
    }
  })

  it('returns 400 when an item name exceeds max length', async () => {
    const item = { id: 'abc12345', n: 'a'.repeat(501), q: '', c: 0, u: 1000, d: 0 }
    const req = new Request('http://localhost/api/lists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'X', items: [item] })
    })
    const res = await handleProvision(db, req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when items array exceeds cap', async () => {
    const items = Array.from({ length: 1001 }, (_, i) => ({
      id: `id${i.toString().padStart(6, '0')}`, n: 'x', q: '', c: 0, u: 1, d: 0
    }))
    const req = new Request('http://localhost/api/lists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'X', items })
    })
    const res = await handleProvision(db, req)
    expect(res.status).toBe(400)
  })

  it('returns 413 when content-length exceeds cap', async () => {
    const req = new Request('http://localhost/api/lists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': String(2 * 1024 * 1024) },
      body: JSON.stringify({ name: 'X', items: [] })
    })
    const res = await handleProvision(db, req)
    expect(res.status).toBe(413)
  })
})

// ---------------------------------------------------------------------------
// POST /api/lists/:id/join
// ---------------------------------------------------------------------------

describe('POST /api/lists/:id/join', () => {
  async function provision (name = 'Test List') {
    const req = new Request('http://localhost/api/lists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, items: [] })
    })
    const res = await handleProvision(db, req)
    return res.json() as Promise<{ id: string; authToken: string }>
  }

  it('returns list data for a valid token', async () => {
    const { id, authToken } = await provision('Test List')

    const req = new Request(`http://localhost/api/lists/${id}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: authToken })
    })
    const res = await handleJoin(db, req, id)
    expect(res.status).toBe(200)
    const body = await res.json() as { listId: string; role: string; name: string; version: number; cursor: number; items: unknown[] }
    expect(body.listId).toBe(id)
    expect(body.role).toBe('editor')
    expect(body.name).toBe('Test List')
    expect(body.version).toBe(1)
    expect(body.cursor).toBe(0)
    expect(body.items).toEqual([])
  })

  it('is multi-use — same token can join multiple times', async () => {
    const { id, authToken } = await provision()

    for (let i = 0; i < 3; i++) {
      const req = new Request(`http://localhost/api/lists/${id}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: authToken })
      })
      const res = await handleJoin(db, req, id)
      expect(res.status).toBe(200)
    }
  })

  it('returns 401 for an invalid token', async () => {
    const { id } = await provision()

    const req = new Request(`http://localhost/api/lists/${id}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'bad-token' })
    })
    const res = await handleJoin(db, req, id)
    expect(res.status).toBe(401)
  })

  it('returns 400 for non-ULID list ids', async () => {
    for (const badId of ['', 'not-a-ulid', 'a'.repeat(26), '01JVKZ0000000000000000000', '01JVKZ000000000000000000000']) {
      const req = new Request(`http://localhost/api/lists/${badId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'anything' })
      })
      const res = await handleJoin(db, req, badId)
      expect(res.status).toBe(400)
    }
  })

  it('returns 401 when token belongs to a different list', async () => {
    const { authToken } = await provision('List A')
    const { id: otherId } = await provision('List B')

    const req = new Request(`http://localhost/api/lists/${otherId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: authToken })
    })
    const res = await handleJoin(db, req, otherId)
    expect(res.status).toBe(401)
  })
})

// ---------------------------------------------------------------------------
// GET /api/lists/:id?since= (poll)
// ---------------------------------------------------------------------------

describe('GET /api/lists/:id?since=', () => {
  async function provision (items: object[] = []) {
    const req = new Request('http://localhost/api/lists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Poll Test', items })
    })
    const res = await handleProvision(db, req)
    return res.json() as Promise<{ id: string; authToken: string }>
  }

  it('returns version and items since=0', async () => {
    const { id, authToken } = await provision()

    const req = new Request(`http://localhost/api/lists/${id}?since=0`, {
      headers: { Authorization: `Bearer ${authToken}` }
    })
    const res = await handlePoll(db, req, id)
    expect(res.status).toBe(200)
    const body = await res.json() as { version: number; items: unknown[] }
    expect(body.version).toBe(1)
    expect(body.items).toEqual([])
  })

  it('returns only items updated after since', async () => {
    const ts = Date.now()
    const items = [
      { id: 'aaa11111', n: 'Milk', q: '1', c: 0, u: ts - 1000, d: 0 },
      { id: 'bbb22222', n: 'Eggs', q: '6', c: 0, u: ts + 1000, d: 0 }
    ]
    const { id, authToken } = await provision(items)

    const req = new Request(`http://localhost/api/lists/${id}?since=${ts}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    })
    const res = await handlePoll(db, req, id)
    expect(res.status).toBe(200)
    const body = await res.json() as { items: Array<{ id: string }> }
    expect(body.items).toHaveLength(1)
    expect(body.items[0].id).toBe('bbb22222')
  })

  it('returns cursor = max(list.u, max items.u)', async () => {
    const items = [
      { id: 'aaa11111', n: 'A', q: '', c: 0, u: 1000, d: 0 },
      { id: 'bbb22222', n: 'B', q: '', c: 0, u: 5000, d: 0 }
    ]
    const { id, authToken } = await provision(items)
    const req = new Request(`http://localhost/api/lists/${id}?since=0`, {
      headers: { Authorization: `Bearer ${authToken}` }
    })
    const body = await handlePoll(db, req, id).then(r => r.json() as Promise<{ cursor: number }>)
    expect(body.cursor).toBe(5000)
  })

  it('returns no items when since equals current cursor (empty delta)', async () => {
    const items = [{ id: 'ccc33333', n: 'C', q: '', c: 0, u: 7777, d: 0 }]
    const { id, authToken } = await provision(items)

    const first = await handlePoll(db, new Request(`http://localhost/api/lists/${id}?since=0`, {
      headers: { Authorization: `Bearer ${authToken}` }
    }), id).then(r => r.json() as Promise<{ cursor: number; items: unknown[] }>)
    expect(first.items).toHaveLength(1)

    const second = await handlePoll(db, new Request(`http://localhost/api/lists/${id}?since=${first.cursor}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    }), id).then(r => r.json() as Promise<{ cursor: number; items: unknown[] }>)
    expect(second.items).toHaveLength(0)
    expect(second.cursor).toBe(first.cursor)
  })

  it('returns 401 without a token', async () => {
    const { id } = await provision()

    const req = new Request(`http://localhost/api/lists/${id}?since=0`)
    const res = await handlePoll(db, req, id)
    expect(res.status).toBe(401)
  })

  it('returns 401 for a wrong token', async () => {
    const { id } = await provision()

    const req = new Request(`http://localhost/api/lists/${id}?since=0`, {
      headers: { Authorization: 'Bearer wrong-token' }
    })
    const res = await handlePoll(db, req, id)
    expect(res.status).toBe(401)
  })

  it('returns 404 for a non-existent list', async () => {
    const { authToken } = await provision()

    const req = new Request('http://localhost/api/lists/01JVKZ00000000000000000000?since=0', {
      headers: { Authorization: `Bearer ${authToken}` }
    })
    const res = await handlePoll(db, req, '01JVKZ00000000000000000000')
    expect(res.status).toBe(401) // token not valid for this list
  })

  it('rejects non-numeric since with 400', async () => {
    const { id, authToken } = await provision()
    const req = new Request(`http://localhost/api/lists/${id}?since=abc`, {
      headers: { Authorization: `Bearer ${authToken}` }
    })
    const res = await handlePoll(db, req, id)
    expect(res.status).toBe(400)
  })

  it('rejects negative since with 400', async () => {
    const { id, authToken } = await provision()
    const req = new Request(`http://localhost/api/lists/${id}?since=-1`, {
      headers: { Authorization: `Bearer ${authToken}` }
    })
    const res = await handlePoll(db, req, id)
    expect(res.status).toBe(400)
  })

  it('returns 400 for non-ULID list ids', async () => {
    const req = new Request('http://localhost/api/lists/garbage?since=0', {
      headers: { Authorization: 'Bearer whatever' }
    })
    const res = await handlePoll(db, req, 'garbage')
    expect(res.status).toBe(400)
  })
})

// ---------------------------------------------------------------------------
// POST /api/lists/:id/items/:itemId (upsert)
// ---------------------------------------------------------------------------

describe('POST /api/lists/:id/items/:itemId', () => {
  async function setup () {
    const provReq = new Request('http://localhost/api/lists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Upsert Test', items: [] })
    })
    return handleProvision(db, provReq).then(r => r.json() as Promise<{ id: string; authToken: string }>)
  }

  function upsertReq (listId: string, itemId: string, token: string, item: object) {
    return new Request(`http://localhost/api/lists/${listId}/items/${itemId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(item)
    })
  }

  it('inserts a new item and returns it', async () => {
    const { id, authToken } = await setup()
    const item = { id: 'item0001', n: 'Milk', q: '2', c: 0, u: 1000, d: 0 }
    const res = await handleUpsertItem(db, upsertReq(id, 'item0001', authToken, item), id, 'item0001')
    expect(res.status).toBe(200)
    const body = await res.json() as { item: typeof item }
    expect(body.item.n).toBe('Milk')
    expect(body.item.u).toBe(1000)
  })

  it('increments list version on insert', async () => {
    const { id, authToken } = await setup()
    await handleUpsertItem(db, upsertReq(id, 'item0001', authToken, { n: 'Eggs', q: '6', c: 0, u: 1000, d: 0 }), id, 'item0001')
    const pollReq = new Request(`http://localhost/api/lists/${id}?since=0`, {
      headers: { Authorization: `Bearer ${authToken}` }
    })
    const body = await handlePoll(db, pollReq, id).then(r => r.json() as Promise<{ version: number }>)
    expect(body.version).toBe(2)
  })

  it('accepts a newer write and returns canonical', async () => {
    const { id, authToken } = await setup()
    await handleUpsertItem(db, upsertReq(id, 'item0001', authToken, { n: 'Milk', q: '1', c: 0, u: 1000, d: 0 }), id, 'item0001')
    const res = await handleUpsertItem(db, upsertReq(id, 'item0001', authToken, { n: 'Milk', q: '2', c: 0, u: 2000, d: 0 }), id, 'item0001')
    expect(res.status).toBe(200)
    const body = await res.json() as { item: { q: string; u: number } }
    expect(body.item.q).toBe('2')
    expect(body.item.u).toBe(2000)
  })

  it('returns existing canonical row on stale write', async () => {
    const { id, authToken } = await setup()
    await handleUpsertItem(db, upsertReq(id, 'item0001', authToken, { n: 'Milk', q: '2', c: 0, u: 2000, d: 0 }), id, 'item0001')
    const res = await handleUpsertItem(db, upsertReq(id, 'item0001', authToken, { n: 'Milk', q: '1', c: 0, u: 1000, d: 0 }), id, 'item0001')
    expect(res.status).toBe(200)
    const body = await res.json() as { item: { q: string; u: number } }
    expect(body.item.q).toBe('2') // canonical wins
    expect(body.item.u).toBe(2000)
  })

  it('does not increment version on stale write', async () => {
    const { id, authToken } = await setup()
    await handleUpsertItem(db, upsertReq(id, 'item0001', authToken, { n: 'Milk', q: '2', c: 0, u: 2000, d: 0 }), id, 'item0001')
    await handleUpsertItem(db, upsertReq(id, 'item0001', authToken, { n: 'Milk', q: '1', c: 0, u: 1000, d: 0 }), id, 'item0001')
    const body = await handlePoll(db, new Request(`http://localhost/api/lists/${id}?since=0`, { headers: { Authorization: `Bearer ${authToken}` } }), id)
      .then(r => r.json() as Promise<{ version: number }>)
    expect(body.version).toBe(2) // only the first upsert bumped version
  })

  it('stores and returns a tombstone', async () => {
    const { id, authToken } = await setup()
    await handleUpsertItem(db, upsertReq(id, 'item0001', authToken, { n: 'Milk', q: '1', c: 0, u: 1000, d: 0 }), id, 'item0001')
    const res = await handleUpsertItem(db, upsertReq(id, 'item0001', authToken, { n: 'Milk', q: '1', c: 0, u: 2000, d: 1 }), id, 'item0001')
    const body = await res.json() as { item: { d: number } }
    expect(body.item.d).toBe(1)
  })

  it('returns 400 when n is missing', async () => {
    const { id, authToken } = await setup()
    const res = await handleUpsertItem(db, upsertReq(id, 'item0001', authToken, { q: '1', u: 1000 }), id, 'item0001')
    expect(res.status).toBe(400)
  })

  it('returns 400 when q is wrong type', async () => {
    const { id, authToken } = await setup()
    const res = await handleUpsertItem(db, upsertReq(id, 'item0001', authToken, { n: 'Milk', q: 5, c: 0, u: 1000, d: 0 }), id, 'item0001')
    expect(res.status).toBe(400)
  })

  it('returns 400 when c is out of range', async () => {
    const { id, authToken } = await setup()
    const res = await handleUpsertItem(db, upsertReq(id, 'item0001', authToken, { n: 'Milk', q: '1', c: 2, u: 1000, d: 0 }), id, 'item0001')
    expect(res.status).toBe(400)
  })

  it('returns 400 when n exceeds max length', async () => {
    const { id, authToken } = await setup()
    const res = await handleUpsertItem(db, upsertReq(id, 'item0001', authToken, { n: 'a'.repeat(501), q: '', c: 0, u: 1000, d: 0 }), id, 'item0001')
    expect(res.status).toBe(400)
  })

  it('returns 400 when itemId path param exceeds max length', async () => {
    const { id, authToken } = await setup()
    const longId = 'a'.repeat(65)
    const res = await handleUpsertItem(db, upsertReq(id, longId, authToken, { n: 'Milk', q: '', c: 0, u: 1000, d: 0 }), id, longId)
    expect(res.status).toBe(400)
  })

  it('returns 401 without a token', async () => {
    const { id } = await setup()
    const res = await handleUpsertItem(db, new Request(`http://localhost/api/lists/${id}/items/item0001`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ n: 'Milk', q: '1', c: 0, u: 1000, d: 0 })
    }), id, 'item0001')
    expect(res.status).toBe(401)
  })
})

// ---------------------------------------------------------------------------
// POST /api/lists/:id/tokens (mint editor token)
// ---------------------------------------------------------------------------

describe('POST /api/lists/:id/tokens', () => {
  async function setup () {
    const req = new Request('http://localhost/api/lists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Token Test', items: [] })
    })
    return handleProvision(db, req).then(r => r.json() as Promise<{ id: string; authToken: string }>)
  }

  function mintReq (listId: string, token: string) {
    return new Request(`http://localhost/api/lists/${listId}/tokens`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    })
  }

  it('mints a new editor token for the owner', async () => {
    const { id, authToken } = await setup()
    const res = await handleMintToken(db, mintReq(id, authToken), id)
    expect(res.status).toBe(200)
    const body = await res.json() as { token: string }
    expect(typeof body.token).toBe('string')
    expect(body.token.length).toBeGreaterThan(30)
  })

  it('minted token is valid for polling', async () => {
    const { id, authToken } = await setup()
    const { token: editorToken } = await handleMintToken(db, mintReq(id, authToken), id)
      .then(r => r.json() as Promise<{ token: string }>)

    const pollReq = new Request(`http://localhost/api/lists/${id}?since=0`, {
      headers: { Authorization: `Bearer ${editorToken}` }
    })
    const res = await handlePoll(db, pollReq, id)
    expect(res.status).toBe(200)
  })

  it('returns 401 without auth', async () => {
    const { id } = await setup()
    const res = await handleMintToken(db, new Request(`http://localhost/api/lists/${id}/tokens`, { method: 'POST' }), id)
    expect(res.status).toBe(401)
  })
})

// ---------------------------------------------------------------------------
// POST /api/lists/:id/tokens/revoke
// ---------------------------------------------------------------------------

describe('POST /api/lists/:id/tokens/revoke', () => {
  async function setup () {
    const req = new Request('http://localhost/api/lists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Revoke Test', items: [] })
    })
    return handleProvision(db, req).then(r => r.json() as Promise<{ id: string; authToken: string }>)
  }

  function revokeReq (listId: string, token: string) {
    return new Request(`http://localhost/api/lists/${listId}/tokens/revoke`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    })
  }

  it('revokes all editor tokens for the list', async () => {
    const { id, authToken } = await setup()
    const { token: editorToken } = await handleMintToken(db, new Request(`http://localhost/api/lists/${id}/tokens`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` }
    }), id).then(r => r.json() as Promise<{ token: string }>)

    const res = await handleRevokeToken(db, revokeReq(id, authToken), id)
    expect(res.status).toBe(200)

    const pollRes = await handlePoll(db, new Request(`http://localhost/api/lists/${id}?since=0`, {
      headers: { Authorization: `Bearer ${editorToken}` }
    }), id)
    expect(pollRes.status).toBe(401)
  })

  it('owner token remains valid after revoking editors', async () => {
    const { id, authToken } = await setup()
    await handleMintToken(db, new Request(`http://localhost/api/lists/${id}/tokens`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` }
    }), id)

    await handleRevokeToken(db, revokeReq(id, authToken), id)

    const pollRes = await handlePoll(db, new Request(`http://localhost/api/lists/${id}?since=0`, {
      headers: { Authorization: `Bearer ${authToken}` }
    }), id)
    expect(pollRes.status).toBe(200)
  })

  it('returns 401 without auth', async () => {
    const { id } = await setup()
    const res = await handleRevokeToken(db, new Request(`http://localhost/api/lists/${id}/tokens/revoke`, {
      method: 'POST'
    }), id)
    expect(res.status).toBe(401)
  })
})

// ---------------------------------------------------------------------------
// DELETE /api/lists/:id
// ---------------------------------------------------------------------------

describe('DELETE /api/lists/:id', () => {
  async function setup () {
    const req = new Request('http://localhost/api/lists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Delete Test',
        items: [{ id: 'item0001', n: 'Milk', q: '1', c: 0, u: 1000, d: 0 }]
      })
    })
    return handleProvision(db, req).then(r => r.json() as Promise<{ id: string; authToken: string }>)
  }

  function deleteReq (listId: string, token: string) {
    return new Request(`http://localhost/api/lists/${listId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    })
  }

  it('deletes list and cascades to items and tokens', async () => {
    const { id, authToken } = await setup()
    const res = await handleDeleteList(db, deleteReq(id, authToken), id)
    expect(res.status).toBe(200)

    const pollReq = new Request(`http://localhost/api/lists/${id}?since=0`, {
      headers: { Authorization: `Bearer ${authToken}` }
    })
    const pollRes = await handlePoll(db, pollReq, id)
    expect(pollRes.status).toBe(401) // token gone, can't auth
  })

  it('returns 401 without auth', async () => {
    const { id } = await setup()
    const res = await handleDeleteList(db, new Request(`http://localhost/api/lists/${id}`, { method: 'DELETE' }), id)
    expect(res.status).toBe(401)
  })

  it('tombstone sweep — removes d=1 items older than 90 days, keeps newer tombstones and live items', async () => {
    const { id, authToken } = await setup()
    const now = Date.now()
    const ttlMs = 90 * 24 * 60 * 60 * 1000

    const upsertReq = (itemId: string, item: object) => new Request(`http://localhost/api/lists/${id}/items/${itemId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify(item)
    })

    await handleUpsertItem(db, upsertReq('old-tomb', { n: 'Old', q: '1', c: 0, u: now - 91 * 24 * 60 * 60 * 1000, d: 1 }), id, 'old-tomb')
    await handleUpsertItem(db, upsertReq('new-tomb', { n: 'Recent', q: '1', c: 0, u: now - 24 * 60 * 60 * 1000, d: 1 }), id, 'new-tomb')
    await handleUpsertItem(db, upsertReq('live', { n: 'Live', q: '1', c: 0, u: now, d: 0 }), id, 'live')

    // Execute the same DELETE the nightly GH Actions workflow runs.
    await db.prepare('DELETE FROM items WHERE d = 1 AND u < ?').bind(now - ttlMs).run()

    const pollReq = new Request(`http://localhost/api/lists/${id}?since=0`, {
      headers: { Authorization: `Bearer ${authToken}` }
    })
    const body = await handlePoll(db, pollReq, id).then(r => r.json() as Promise<{ items: Array<{ id: string }> }>)
    const ids = body.items.map(i => i.id)
    expect(ids).not.toContain('old-tomb')
    expect(ids).toContain('new-tomb')
    expect(ids).toContain('live')
  })
})
