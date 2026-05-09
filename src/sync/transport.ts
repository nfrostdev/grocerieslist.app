import type { TransportResult, ProvisionResponse, JoinResponse, PollPayload, ItemPayload } from './types'

function normError (status: number) {
  if (status === 401) return { kind: 'unauthorized' as const }
  if (status === 404) return { kind: 'not-found' as const }
  return { kind: 'server' as const, status }
}

export async function provisionList (
  name: string,
  items: ItemPayload[]
): Promise<TransportResult<ProvisionResponse>> {
  try {
    const res = await fetch('/api/lists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, items })
    })
    if (!res.ok) return { ok: false, error: normError(res.status) }
    return { ok: true, data: await res.json() as ProvisionResponse }
  } catch {
    return { ok: false, error: { kind: 'network' } }
  }
}

export async function joinList (
  listId: string,
  token: string
): Promise<TransportResult<JoinResponse>> {
  try {
    const res = await fetch(`/api/lists/${listId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    })
    if (!res.ok) return { ok: false, error: normError(res.status) }
    return { ok: true, data: await res.json() as JoinResponse }
  } catch {
    return { ok: false, error: { kind: 'network' } }
  }
}

export async function pollList (
  listId: string,
  authToken: string,
  since: number
): Promise<TransportResult<PollPayload>> {
  try {
    const res = await fetch(`/api/lists/${listId}?since=${since}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    })
    if (!res.ok) return { ok: false, error: normError(res.status) }
    return { ok: true, data: await res.json() as PollPayload }
  } catch {
    return { ok: false, error: { kind: 'network' } }
  }
}
