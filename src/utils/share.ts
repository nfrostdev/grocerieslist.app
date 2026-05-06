import pako from 'pako'
import type List from '@/classes/List'
import type Item from '@/classes/Item'

const SCHEMA = 1

export const QR_PAYLOAD_LIMIT = 1800

type ItemTuple = [string, string, string, number, number]
type ListTuple = [string, string, ItemTuple[]]

export type DecodeResult =
  | { ok: true; list: List }
  | { ok: false; reason: 'corrupt' | 'newer-schema' }

function base64urlEncode (bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64urlDecode (s: string): Uint8Array {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/') +
    '='.repeat((4 - s.length % 4) % 4)
  const bin = atob(padded)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function listToTuple (list: List): ListTuple {
  const items: ItemTuple[] = list.i
    .filter(item => !item.d)
    .map(item => [item.id, item.n, item.q, item.c, item.u])
  return [list.id, list.n, items]
}

function tupleToList (t: unknown): List {
  if (!Array.isArray(t) || t.length !== 3) throw new Error('shape')
  const [id, n, items] = t as [unknown, unknown, unknown]
  if (typeof id !== 'string' || typeof n !== 'string' || !Array.isArray(items)) {
    throw new Error('shape')
  }
  const i: Item[] = items.map(it => {
    if (!Array.isArray(it) || it.length !== 5) throw new Error('shape')
    const [iid, iname, iq, ic, iu] = it as [unknown, unknown, unknown, unknown, unknown]
    if (typeof iid !== 'string' || typeof iname !== 'string' || typeof iq !== 'string' ||
        typeof ic !== 'number' || typeof iu !== 'number') {
      throw new Error('shape')
    }
    return { id: iid, n: iname, q: iq, c: ic, u: iu, d: 0 }
  })
  return { id, n, i } as List
}

export function encodeList (list: List): string {
  const tuple = listToTuple(list)
  const json = JSON.stringify(tuple)
  const compressed = pako.deflate(json)
  return String(SCHEMA) + base64urlEncode(compressed)
}

export function decodeList (payload: string): DecodeResult {
  if (!payload || payload.length < 2) return { ok: false, reason: 'corrupt' }
  const version = parseInt(payload[0], 10)
  if (Number.isNaN(version)) return { ok: false, reason: 'corrupt' }
  if (version > SCHEMA) return { ok: false, reason: 'newer-schema' }
  if (version !== SCHEMA) return { ok: false, reason: 'corrupt' }
  try {
    const bytes = base64urlDecode(payload.slice(1))
    const json = pako.inflate(bytes, { to: 'string' })
    const tuple: unknown = JSON.parse(json)
    return { ok: true, list: tupleToList(tuple) }
  } catch {
    return { ok: false, reason: 'corrupt' }
  }
}

export function buildShareUrl (list: List, origin: string = window.location.origin): {
  url: string
  payload: string
  tooLarge: boolean
} {
  const payload = encodeList(list)
  const url = `${origin}/#import=${payload}`
  return { url, payload, tooLarge: url.length > QR_PAYLOAD_LIMIT }
}

export function parseImportFragment (hash: string): string | null {
  if (!hash) return null
  const m = /^#import=(.+)$/.exec(hash)
  return m ? m[1] : null
}
