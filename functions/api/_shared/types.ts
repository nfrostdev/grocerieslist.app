export interface Env {
  DB: D1Database
}

export interface ListRow {
  id: string
  name: string
  u: number
  version: number
  schema_version: number
}

export interface ItemRow {
  id: string
  n: string
  q: string
  c: number
  u: number
  d: number
}

export interface TokenRow {
  list_id: string
  role: 'owner' | 'editor'
  revoked_at: number | null
}
