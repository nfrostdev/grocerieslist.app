import { getMeta, removeMeta } from './storage'
import { useListsStore } from '@/stores/lists'

// Removes syncMeta and deletes the list from the local store.
// Does NOT stop the poller or touch pendingOps — callers handle those.
export function cleanupListLocally (listId: string): void {
  if (!getMeta(listId)) return
  removeMeta(listId)
  useListsStore().deleteList(listId)
}
