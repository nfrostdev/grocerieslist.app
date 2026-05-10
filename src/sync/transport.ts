import type { TransportResult, ProvisionResponse, JoinResponse, PollPayload, ItemPayload, UpsertItemResponse, MintTokenResponse } from './types'

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

export async function upsertItem (
  listId: string,
  itemId: string,
  authToken: string,
  item: ItemPayload
): Promise<TransportResult<UpsertItemResponse>> {
  try {
    const res = await fetch(`/api/lists/${listId}/items/${itemId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify(item)
    })
    if (!res.ok) return { ok: false, error: normError(res.status) }
    return { ok: true, data: await res.json() as UpsertItemResponse }
  } catch {
    return { ok: false, error: { kind: 'network' } }
  }
}

export async function mintToken (
  listId: string,
  authToken: string
): Promise<TransportResult<MintTokenResponse>> {
  try {
    const res = await fetch(`/api/lists/${listId}/tokens`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` }
    })
    if (!res.ok) return { ok: false, error: normError(res.status) }
    return { ok: true, data: await res.json() as MintTokenResponse }
  } catch {
    return { ok: false, error: { kind: 'network' } }
  }
}

export async function revokeToken (
  listId: string,
  authToken: string
): Promise<TransportResult<Record<string, never>>> {
  try {
    const res = await fetch(`/api/lists/${listId}/tokens/revoke`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` }
    })
    if (!res.ok) return { ok: false, error: normError(res.status) }
    return { ok: true, data: {} as Record<string, never> }
  } catch {
    return { ok: false, error: { kind: 'network' } }
  }
}

export async function deleteListRequest (
  listId: string,
  authToken: string
): Promise<TransportResult<Record<string, never>>> {
  try {
    const res = await fetch(`/api/lists/${listId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` }
    })
    if (!res.ok) return { ok: false, error: normError(res.status) }
    return { ok: true, data: {} as Record<string, never> }
  } catch {
    return { ok: false, error: { kind: 'network' } }
  }
}
