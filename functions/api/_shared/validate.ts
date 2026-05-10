import type { ItemRow } from './types'

export const LIMITS = {
  itemIdMax: 64,
  itemNameMax: 500,
  itemQtyMax: 100,
  listNameMax: 500,
  itemsMax: 1000,
  bodyBytesMax: 1_048_576
} as const

const MAX_TIMESTAMP = 4_102_444_800_000

export function validateItem (raw: unknown): ItemRow | null {
  if (raw === null || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>

  if (typeof r.id !== 'string' || r.id.length === 0 || r.id.length > LIMITS.itemIdMax) return null
  if (typeof r.n !== 'string' || r.n.length > LIMITS.itemNameMax) return null
  if (typeof r.u !== 'number' || !Number.isFinite(r.u) || r.u < 0 || r.u > MAX_TIMESTAMP) return null

  const q = r.q === undefined ? '' : r.q
  if (typeof q !== 'string' || q.length > LIMITS.itemQtyMax) return null

  const c = r.c === undefined ? 0 : r.c
  if (c !== 0 && c !== 1) return null

  const d = r.d === undefined ? 0 : r.d
  if (d !== 0 && d !== 1) return null

  return { id: r.id, n: r.n, q, c, u: r.u, d }
}

export async function readJsonBody<T = unknown> (request: Request): Promise<
  { ok: true; body: T } | { ok: false; status: number; error: string }
> {
  const len = request.headers.get('content-length')
  if (len !== null) {
    const n = Number(len)
    if (Number.isFinite(n) && n > LIMITS.bodyBytesMax) {
      return { ok: false, status: 413, error: 'Payload Too Large' }
    }
  }

  let text: string
  try {
    text = await request.text()
  } catch {
    return { ok: false, status: 400, error: 'Invalid body' }
  }
  if (text.length > LIMITS.bodyBytesMax) {
    return { ok: false, status: 413, error: 'Payload Too Large' }
  }

  try {
    return { ok: true, body: JSON.parse(text) as T }
  } catch {
    return { ok: false, status: 400, error: 'Invalid JSON' }
  }
}
