import type List from '@/classes/List'
import { useListsStore } from '@/stores/lists'
import { provisionList, joinList } from './transport'
import { applyJoinPayload } from './reconcile'
import { getMeta, setMeta, getSyncMetaMap } from './storage'
import { startPoller } from './poll'

export { getMeta, getSyncMetaMap, saveSyncMetaMap } from './storage'

export function isSynced (listId: string): boolean {
  return getMeta(listId) != null
}

export async function provision (
  list: List
): Promise<{ joinUrl: string; listId: string } | null> {
  const store = useListsStore()
  const items = list.i.filter(i => !i.d)
  const result = await provisionList(list.n, items)
  if (!result.ok) return null

  const { id: newListId, authToken } = result.data

  store.updateListId(list.id, newListId)
  setMeta(newListId, { authToken, role: 'owner', lastVersion: 1 })
  startPoller(newListId)

  const joinUrl = `${window.location.origin}/#join=${newListId}.${authToken}`
  return { joinUrl, listId: newListId }
}

export async function join (listId: string, token: string): Promise<boolean> {
  const result = await joinList(listId, token)
  if (!result.ok) return false

  applyJoinPayload(result.data)
  setMeta(listId, {
    authToken: token,
    role: result.data.role,
    lastVersion: result.data.version
  })
  startPoller(listId)
  return true
}

export function startPolling (): void {
  const map = getSyncMetaMap()
  for (const listId of Object.keys(map)) {
    startPoller(listId)
  }
}
