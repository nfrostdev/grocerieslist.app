import { getMeta, removeMeta } from './storage'
import { useListsStore } from '@/stores/lists'
import { useToastStore } from '@/stores/toast'

// Removes syncMeta and deletes the list from the local store.
// Does NOT stop the poller or touch pendingOps — callers handle those.
export function cleanupListLocally (listId: string): void {
  if (!getMeta(listId)) return
  removeMeta(listId)
  useListsStore().deleteList(listId)
}

// Shared handler for 401/404 surfaced by poll or queue. The getMeta gate
// dedupes — whichever caller arrives second sees no meta and stays silent,
// so the user gets one toast instead of two.
export function onAuthLost (listId: string, kind: 'unauthorized' | 'not-found'): void {
  if (!getMeta(listId)) return
  const listName = useListsStore().getListFromId(listId)?.n ?? 'a shared list'
  useToastStore().add(
    kind === 'unauthorized'
      ? `Access to "${listName}" was revoked.`
      : `"${listName}" was deleted.`,
    'error'
  )
  cleanupListLocally(listId)
}
