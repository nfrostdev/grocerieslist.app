import type List from '@/classes/List'
import { useListsStore } from '@/stores/lists'
import { provisionList, joinList, mintToken, revokeToken, deleteListRequest } from './transport'
import { applyJoinPayload } from './reconcile'
import { getMeta, setMeta, getSyncMetaMap, saveSyncMetaMap } from './storage'
import { startPoller, stopPoller } from './poll'
import { startDrainer, enqueue } from './queue'
import { cleanupListLocally } from './cleanup'

export { getMeta, getSyncMetaMap, saveSyncMetaMap } from './storage'
export { enqueue } from './queue'

export function isSynced (listId: string): boolean {
  return getMeta(listId) != null
}

export async function provision (
  list: List
): Promise<{ joinUrl: string; listId: string } | null> {
  const store = useListsStore()
  const items = list.i.filter(i => !i.d)
  // Snapshot id→u for the items sent in the provision body so we can detect
  // items added or modified while the POST was in flight.
  const sentSnapshot = new Map(items.map(i => [i.id, i.u]))
  const result = await provisionList(list.n, items)
  if (!result.ok) return null

  const { id: newListId, authToken, role } = result.data
  const lastCursor = items.reduce((m, i) => Math.max(m, i.u), 0)

  store.updateListId(list.id, newListId)
  setMeta(newListId, { authToken, role, lastCursor })

  // Items added or modified between the provision call and its response
  // could not be enqueued at the time (no meta yet) and were not in the
  // provision body. Enqueue them now so they reach the server.
  const currentList = store.getListFromId(newListId)
  if (currentList) {
    for (const it of currentList.i) {
      if (sentSnapshot.get(it.id) !== it.u) {
        enqueue({
          kind: 'upsertItem',
          listId: newListId,
          item: { id: it.id, n: it.n, q: it.q, c: it.c, u: it.u, d: it.d }
        })
      }
    }
  }

  startPoller(newListId)

  const joinUrl = `${window.location.origin}/#join=${newListId}.${authToken}`
  return { joinUrl, listId: newListId }
}

export type JoinResult = { ok: true } | { ok: false; reason: 'network' | 'invalid' }

export async function join (listId: string, token: string): Promise<JoinResult> {
  const result = await joinList(listId, token)
  if (!result.ok) {
    return { ok: false, reason: result.error.kind === 'network' ? 'network' : 'invalid' }
  }

  applyJoinPayload(result.data)
  setMeta(listId, {
    authToken: token,
    role: result.data.role,
    lastCursor: result.data.cursor
  })
  startPoller(listId)
  return { ok: true }
}

export function startPolling (): void {
  const map = getSyncMetaMap()
  for (const listId of Object.keys(map)) {
    startPoller(listId)
  }
  startDrainer()
}

export async function enableSharing (listId: string): Promise<string | null> {
  const meta = getMeta(listId)
  if (!meta || meta.role !== 'owner') return null

  if (meta.shareToken) {
    return `${window.location.origin}/#join=${listId}.${meta.shareToken}`
  }

  const result = await mintToken(listId, meta.authToken)
  if (!result.ok) return null

  const { token } = result.data
  const map = getSyncMetaMap()
  const entry = map[listId]
  if (entry) {
    entry.shareToken = token
    saveSyncMetaMap(map)
  }

  return `${window.location.origin}/#join=${listId}.${token}`
}

export async function disableSharing (listId: string): Promise<boolean> {
  const meta = getMeta(listId)
  if (!meta || meta.role !== 'owner') return false

  const result = await revokeToken(listId, meta.authToken)
  if (!result.ok) return false

  const map = getSyncMetaMap()
  const entry = map[listId]
  if (entry) {
    delete entry.shareToken
    saveSyncMetaMap(map)
  }

  return true
}

export async function deleteList (listId: string): Promise<boolean> {
  const meta = getMeta(listId)
  if (!meta || meta.role !== 'owner') return false

  const result = await deleteListRequest(listId, meta.authToken)
  if (!result.ok) return false

  stopPoller(listId)
  cleanupListLocally(listId)
  return true
}

export function leaveList (listId: string): void {
  stopPoller(listId)
  cleanupListLocally(listId)
}
