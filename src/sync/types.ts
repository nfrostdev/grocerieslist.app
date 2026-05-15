import type { Role } from '../../shared/roles'

export type { Role }

export interface SyncMeta {
  authToken: string
  role: Role
  lastCursor: number
  shareToken?: string
}

export type SyncMetaMap = Record<string, SyncMeta>

export interface PollPayload {
  cursor: number
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
  role: Role
}

export interface JoinResponse {
  listId: string
  role: Role
  name: string
  version: number
  cursor: number
  items: ItemPayload[]
}

export interface UpsertItemResponse {
  item: ItemPayload
}

export interface MintTokenResponse {
  token: string
}

export interface UpsertItemOp {
  kind: 'upsertItem'
  opId: string
  listId: string
  item: ItemPayload
}

export type Op = UpsertItemOp

export type SyncError =
  | { kind: 'unauthorized' }
  | { kind: 'not-found' }
  | { kind: 'network' }
  | { kind: 'server'; status: number }

export type TransportResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: SyncError }
