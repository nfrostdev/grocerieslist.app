import type { TokenRow } from './types'
import { hashToken } from '../../../shared/crypto'

export async function authenticate (
  db: D1Database,
  request: Request,
  listId: string
): Promise<TokenRow | Response> {
  const auth = request.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const hash = await hashToken(auth.slice(7))
  const row = await db.prepare(
    'SELECT list_id, role, revoked_at FROM list_tokens WHERE token_hash = ? AND list_id = ?'
  ).bind(hash, listId).first<TokenRow>()

  if (!row || row.revoked_at != null) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return row
}
