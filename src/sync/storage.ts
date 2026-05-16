import type { SyncMeta, SyncMetaMap } from './types'

const KEY = 'syncMeta'
const CORRUPTED_PREFIX = 'syncMeta.corrupted.'

// Parsed-map cache. This tab only ever mutates `syncMeta` through
// saveSyncMetaMap, so the cache stays authoritative until then. A `storage`
// event means another tab wrote the key, so we drop the cache and re-parse
// on the next read. getMeta/getSyncMetaMap sit on sync hot paths (every poll
// and every drain iteration); without the cache each call re-parsed JSON.
let cache: SyncMetaMap | null = null

function parseFromStorage (): SyncMetaMap {
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

export function getSyncMetaMap (): SyncMetaMap {
  if (cache === null) cache = parseFromStorage()
  return cache
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
  cache = map
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

// Drop the cache when another tab rewrites syncMeta (or clears storage).
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e: StorageEvent) => {
    if (e.key === KEY || e.key === null) cache = null
  })
}

// Clears the in-memory cache. Tests manipulate localStorage directly, which
// bypasses saveSyncMetaMap; the unit setup calls this before each test.
export function _resetForTest (): void {
  cache = null
}
