export interface SyncMeta {
  authToken: string
  role: 'owner' | 'editor'
  lastVersion: number
  label?: string
}

export type SyncMetaMap = Record<string, SyncMeta>

export interface PollPayload {
  version: number
  name?: string
  nameUpdatedAt?: number
  items: ItemPayload[]
}

export interface ItemPayload {
  id: string
  n: string
  q: string
  c: number
  u: number
  d: number
}

export interface ProvisionResponse {
  id: string
  authToken: string
}

export interface JoinResponse {
  listId: string
  role: 'owner' | 'editor'
  name: string
  version: number
  items: ItemPayload[]
}

export interface UpsertItemResponse {
  item: ItemPayload
}

export interface PatchListResponse {
  name: string
  u: number
}

export interface UpsertItemOp {
  kind: 'upsertItem'
  listId: string
  item: ItemPayload
}

export interface PatchListOp {
  kind: 'patchList'
  listId: string
  name: string
  u: number
}

export type Op = UpsertItemOp | PatchListOp

export type SyncError =
  | { kind: 'unauthorized' }
  | { kind: 'not-found' }
  | { kind: 'network' }
  | { kind: 'server'; status: number }

export type TransportResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: SyncError }
