import type { SyncMeta, SyncMetaMap } from './types'

const KEY = 'syncMeta'

export function getSyncMetaMap (): SyncMetaMap {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as SyncMetaMap
  } catch {
    return {}
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
