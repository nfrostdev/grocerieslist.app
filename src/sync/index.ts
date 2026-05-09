import type List from '@/classes/List'
import { useListsStore } from '@/stores/lists'
import { provisionList, joinList, mintToken, revokeToken, deleteListRequest } from './transport'
import { applyJoinPayload } from './reconcile'
import { getMeta, setMeta, getSyncMetaMap, saveSyncMetaMap } from './storage'
import { startPoller, stopPoller } from './poll'
import { startDrainer } from './queue'
import { cleanupListLocally } from './cleanup'
import { hashToken } from './crypto'

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
  startDrainer()
}

export async function mintEditorToken (
  listId: string,
  label: string
): Promise<{ token: string; hash: string; joinUrl: string } | null> {
  const meta = getMeta(listId)
  if (!meta || meta.role !== 'owner') return null

  const result = await mintToken(listId, meta.authToken)
  if (!result.ok) return null

  const { token } = result.data
  const hash = await hashToken(token)
  const joinUrl = `${window.location.origin}/#join=${listId}.${token}`

  const map = getSyncMetaMap()
  const entry = map[listId]
  if (entry) {
    entry.editorTokens = [...(entry.editorTokens ?? []), { token, hash, label }]
    saveSyncMetaMap(map)
  }

  return { token, hash, joinUrl }
}

export async function revokeEditorToken (
  listId: string,
  tokenHash: string
): Promise<boolean> {
  const meta = getMeta(listId)
  if (!meta || meta.role !== 'owner') return false

  const result = await revokeToken(listId, meta.authToken, tokenHash)
  if (!result.ok) return false

  const map = getSyncMetaMap()
  const entry = map[listId]
  if (entry?.editorTokens) {
    entry.editorTokens = entry.editorTokens.filter(t => t.hash !== tokenHash)
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
