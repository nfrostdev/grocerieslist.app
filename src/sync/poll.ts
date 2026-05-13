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
  cleanup: (() => void) | null
}

const activePollers = new Map<string, PollState>()

export function startPoller (listId: string): void {
  if (activePollers.has(listId)) return
  const state: PollState = { stopped: false, backoff: 1_000, cleanup: null }
  activePollers.set(listId, state)
  void runPoller(listId, state)
}

export function stopPoller (listId: string): void {
  const state = activePollers.get(listId)
  if (state) {
    state.stopped = true
    state.cleanup?.()
    state.cleanup = null
    activePollers.delete(listId)
  }
}

async function sleep (ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function waitVisible (state: PollState): Promise<void> {
  if (!document.hidden) return
  return new Promise(resolve => {
    const cleanup = () => {
      document.removeEventListener('visibilitychange', onVisible)
      state.cleanup = null
    }
    const onVisible = () => {
      if (!document.hidden) {
        cleanup()
        resolve()
      }
    }
    state.cleanup = () => {
      cleanup()
      resolve()
    }
    document.addEventListener('visibilitychange', onVisible)
  })
}

async function runPoller (listId: string, state: PollState): Promise<void> {
  while (!state.stopped) {
    await waitVisible(state)
    if (state.stopped) break

    const meta = getMeta(listId)
    if (!meta) { stopPoller(listId); break }

    const result = await pollList(listId, meta.authToken, meta.lastCursor ?? 0)
    if (state.stopped) break

    if (result.ok) {
      state.backoff = 1_000
      applyPollPayload(listId, result.data)
      const map = getSyncMetaMap()
      if (map[listId]) {
        map[listId].lastCursor = result.data.cursor
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
