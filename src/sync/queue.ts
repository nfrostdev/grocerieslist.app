import { useListsStore } from '@/stores/lists'
import { useToastStore } from '@/stores/toast'
import { getMeta } from './storage'
import { upsertItem } from './transport'
import { reconcileServerItem } from './reconcile'
import { cleanupListLocally } from './cleanup'
import type { Op } from './types'

const QUEUE_KEY = 'pendingOps'
const MAX_BACKOFF_MS = 60_000

let flushRunning = false
let backoffMs = 1_000

function loadQueue (): Op[] {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]') as Op[] } catch { return [] }
}

function saveQueue (q: Op[]): void {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q))
}

export function enqueue (op: Op): void {
  const q = loadQueue()
  q.push(op)
  saveQueue(q)
  scheduleFlush()
}

export function startDrainer (): void {
  scheduleFlush()
}

export function _resetForTest (): void {
  flushRunning = false
  backoffMs = 1_000
}

function scheduleFlush (): void {
  if (flushRunning) return
  flushRunning = true
  void flush()
}

function sleep (ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function flush (): Promise<void> {
  while (true) {
    const q = loadQueue()
    if (q.length === 0) {
      flushRunning = false
      backoffMs = 1_000
      return
    }

    const op = q[0]
    const meta = getMeta(op.listId)
    if (!meta) {
      saveQueue(q.filter(o => o.listId !== op.listId))
      continue
    }

    const result = await upsertItem(op.listId, op.item.id, meta.authToken, op.item)

    if (result.ok) {
      backoffMs = 1_000
      reconcileServerItem(op.listId, result.data.item)
      saveQueue(loadQueue().slice(1))
    } else if (
      result.error.kind === 'unauthorized' ||
      result.error.kind === 'not-found'
    ) {
      const listName = useListsStore().getListFromId(op.listId)?.n ?? 'a shared list'
      useToastStore().add(
        result.error.kind === 'unauthorized'
          ? `Access to "${listName}" was revoked.`
          : `"${listName}" was deleted.`,
        'error'
      )
      saveQueue(loadQueue().filter(o => o.listId !== op.listId))
      cleanupListLocally(op.listId)
    } else {
      await sleep(backoffMs)
      backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS)
    }
  }
}
