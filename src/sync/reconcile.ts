import { useListsStore } from '@/stores/lists'
import type { PollPayload, JoinResponse } from './types'

export function applyPollPayload (listId: string, payload: PollPayload): void {
  const store = useListsStore()
  const existing = store.getListFromId(listId)
  if (!existing) return

  store.mergeList({
    id: listId,
    n: payload.name ?? existing.n,
    i: payload.items.map(item => ({
      id: item.id, n: item.n, q: item.q, c: item.c, u: item.u, d: item.d
    }))
  })
}

export function applyJoinPayload (payload: JoinResponse): void {
  const store = useListsStore()
  store.replaceList({
    id: payload.listId,
    n: payload.name,
    i: payload.items.map(item => ({
      id: item.id, n: item.n, q: item.q, c: item.c, u: item.u, d: item.d
    }))
  })
}
