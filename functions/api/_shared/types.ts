import type { RateLimitBinding } from './rateLimit'

export interface Env {
  DB: D1Database
  RATE_LIMIT_PROVISION?: RateLimitBinding
  RATE_LIMIT_JOIN?: RateLimitBinding
  RATE_LIMIT_MINT?: RateLimitBinding
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
