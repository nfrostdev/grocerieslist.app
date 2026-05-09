import { pollList } from './transport'
import { applyPollPayload } from './reconcile'
import { getMeta, getSyncMetaMap, saveSyncMetaMap } from './storage'
import { cleanupListLocally } from './cleanup'
import { useListsStore } from '@/stores/lists'
import { useToastStore } from '@/stores/toast'

const POLL_INTERVAL_MS = 5_000
const MAX_BACKOFF_MS = 60_000

interface PollState {
  stopped: boolean
  backoff: number
}

const activePollers = new Map<string, PollState>()

export function startPoller (listId: string): void {
  if (activePollers.has(listId)) return
  const state: PollState = { stopped: false, backoff: 1_000 }
  activePollers.set(listId, state)
  void runPoller(listId, state)
}

export function stopPoller (listId: string): void {
  const state = activePollers.get(listId)
  if (state) {
    state.stopped = true
    activePollers.delete(listId)
  }
}

async function sleep (ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function waitVisible (): Promise<void> {
  if (!document.hidden) return
  return new Promise(resolve => {
    const onVisible = () => {
      if (!document.hidden) {
        document.removeEventListener('visibilitychange', onVisible)
        resolve()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
  })
}

async function runPoller (listId: string, state: PollState): Promise<void> {
  while (!state.stopped) {
    await waitVisible()
    if (state.stopped) break

    const meta = getMeta(listId)
    if (!meta) { stopPoller(listId); break }

    const result = await pollList(listId, meta.authToken, meta.lastVersion)
    if (state.stopped) break

    if (result.ok) {
      state.backoff = 1_000
      applyPollPayload(listId, result.data)
      const map = getSyncMetaMap()
      if (map[listId]) {
        map[listId].lastVersion = result.data.version
        saveSyncMetaMap(map)
      }
      await sleep(POLL_INTERVAL_MS)
    } else if (result.error.kind === 'unauthorized' || result.error.kind === 'not-found') {
      const listName = useListsStore().getListFromId(listId)?.n ?? 'a shared list'
      useToastStore().add(
        result.error.kind === 'unauthorized'
          ? `Access to "${listName}" was revoked.`
          : `"${listName}" was deleted.`,
        'error'
      )
      stopPoller(listId)
      cleanupListLocally(listId)
      break
    } else {
      await sleep(state.backoff)
      state.backoff = Math.min(state.backoff * 2, MAX_BACKOFF_MS)
    }
  }
}
