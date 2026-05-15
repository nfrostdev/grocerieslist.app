import { useListsStore } from '@/stores/lists'
import { useToastStore } from '@/stores/toast'
import { getMeta } from './storage'
import { upsertItem } from './transport'
import { reconcileServerItem } from './reconcile'
import { cleanupListLocally } from './cleanup'
import type { Op, UpsertItemOp } from './types'

const QUEUE_KEY = 'pendingOps'
const CORRUPTED_PREFIX = 'pendingOps.corrupted.'
const MAX_BACKOFF_MS = 60_000

let flushRunning = false
let backoffMs = 1_000

function loadQueue (): Op[] {
  let raw: string | null
  try {
    raw = localStorage.getItem(QUEUE_KEY)
  } catch (err) {
    console.warn('[sync/queue] localStorage unavailable for read', err)
    return []
  }
  if (raw === null) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    console.warn('[sync/queue] corrupted pendingOps — preserving and discarding', err)
    quarantineCorrupted(raw)
    return []
  }
  if (!Array.isArray(parsed)) {
    console.warn('[sync/queue] pendingOps not an array — preserving and discarding')
    quarantineCorrupted(raw)
    return []
  }

  const ops = parsed as Array<Op & { opId?: string }>
  let migrated = false
  for (const op of ops) {
    if (op && !op.opId) {
      op.opId = crypto.randomUUID()
      migrated = true
    }
  }
  if (migrated) {
    try {
      saveQueue(ops as Op[])
    } catch (err) {
      console.warn('[sync/queue] failed to persist migrated queue', err)
    }
  }
  return ops as Op[]
}

function quarantineCorrupted (raw: string): void {
  try {
    localStorage.setItem(`${CORRUPTED_PREFIX}${Date.now()}`, raw)
    localStorage.removeItem(QUEUE_KEY)
  } catch {
    // Quota or storage gone — drop the live key best-effort.
    try { localStorage.removeItem(QUEUE_KEY) } catch { /* nothing more to do */ }
  }
}

function saveQueue (q: Op[]): void {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q))
}

function removeOpById (opId: string): void {
  saveQueue(loadQueue().filter(o => o.opId !== opId))
}

function removeOpsByListId (listId: string): void {
  saveQueue(loadQueue().filter(o => o.listId !== listId))
}

export function enqueue (op: Omit<UpsertItemOp, 'opId'>): void {
  const q = loadQueue()
  q.push({ ...op, opId: crypto.randomUUID() })
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
      removeOpsByListId(op.listId)
      continue
    }

    const result = await upsertItem(op.listId, op.item.id, meta.authToken, op.item)

    if (result.ok) {
      backoffMs = 1_000
      reconcileServerItem(op.listId, result.data.item)
      removeOpById(op.opId)
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
      removeOpsByListId(op.listId)
      cleanupListLocally(op.listId)
    } else {
      await sleep(backoffMs)
      backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS)
    }
  }
}
