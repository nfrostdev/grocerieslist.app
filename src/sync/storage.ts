import type { SyncMeta, SyncMetaMap } from './types'

const KEY = 'syncMeta'
const CORRUPTED_PREFIX = 'syncMeta.corrupted.'

export function getSyncMetaMap (): SyncMetaMap {
  const raw = localStorage.getItem(KEY)
  if (raw === null) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      backupCorrupted(raw, 'unexpected shape')
      return {}
    }
    return parsed as SyncMetaMap
  } catch (err) {
    backupCorrupted(raw, err)
    return {}
  }
}

function backupCorrupted (raw: string, reason: unknown): void {
  const backupKey = `${CORRUPTED_PREFIX}${Date.now()}`
  console.warn('[sync/storage] corrupted syncMeta — preserving to', backupKey, reason)
  try {
    localStorage.setItem(backupKey, raw)
    localStorage.removeItem(KEY)
  } catch {
    // Quota or storage gone — caller will continue with an empty map regardless.
  }
}

export function saveSyncMetaMap (map: SyncMetaMap): void {
  localStorage.setItem(KEY, JSON.stringify(map))
}

export function getMeta (listId: string): SyncMeta | null {
  return getSyncMetaMap()[listId] ?? null
}

export function setMeta (listId: string, meta: SyncMeta): void {
  const map = getSyncMetaMap()
  map[listId] = meta
  saveSyncMetaMap(map)
}

export function removeMeta (listId: string): void {
  const map = getSyncMetaMap()
  delete map[listId]
  saveSyncMetaMap(map)
}
