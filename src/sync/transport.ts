import type { TransportResult, ProvisionResponse, JoinResponse, PollPayload, ItemPayload, UpsertItemResponse, MintTokenResponse } from './types'

function normError (status: number) {
  if (status === 401) return { kind: 'unauthorized' as const }
  if (status === 404) return { kind: 'not-found' as const }
  return { kind: 'server' as const, status }
}

async function request<T> (
  input: string,
  init: Parameters<typeof fetch>[1],
  opts: { parseJson?: boolean } = {}
): Promise<TransportResult<T>> {
  const { parseJson = true } = opts
  try {
    const res = await fetch(input, init)
    if (!res.ok) return { ok: false, error: normError(res.status) }
    const data = parseJson ? await res.json() as T : {} as T
    return { ok: true, data }
  } catch {
    return { ok: false, error: { kind: 'network' } }
  }
}

export async function provisionList (
  name: string,
  items: ItemPayload[]
): Promise<TransportResult<ProvisionResponse>> {
  return request<ProvisionResponse>('/api/lists', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, items })
  })
}

export async function joinList (
  listId: string,
  token: string
): Promise<TransportResult<JoinResponse>> {
  return request<JoinResponse>(`/api/lists/${listId}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token })
  })
}

export async function pollList (
  listId: string,
  authToken: string,
  since: number
): Promise<TransportResult<PollPayload>> {
  return request<PollPayload>(`/api/lists/${listId}?since=${since}`, {
    headers: { Authorization: `Bearer ${authToken}` }
  })
}

export async function upsertItem (
  listId: string,
  itemId: string,
  authToken: string,
  item: ItemPayload
): Promise<TransportResult<UpsertItemResponse>> {
  return request<UpsertItemResponse>(`/api/lists/${listId}/items/${itemId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`
    },
    body: JSON.stringify(item)
  })
}

export async function mintToken (
  listId: string,
  authToken: string
): Promise<TransportResult<MintTokenResponse>> {
  return request<MintTokenResponse>(`/api/lists/${listId}/tokens`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${authToken}` }
  })
}

export async function revokeToken (
  listId: string,
  authToken: string
): Promise<TransportResult<Record<string, never>>> {
  return request<Record<string, never>>(`/api/lists/${listId}/tokens/revoke`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${authToken}` }
  }, { parseJson: false })
}

export async function deleteListRequest (
  listId: string,
  authToken: string
): Promise<TransportResult<Record<string, never>>> {
  return request<Record<string, never>>(`/api/lists/${listId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${authToken}` }
  }, { parseJson: false })
}
