import { describe, it, expect } from 'vitest'
import pako from 'pako'
import { encodeList, decodeList, buildShareUrl, parseImportFragment, QR_PAYLOAD_LIMIT } from '@/utils/share'
import List from '@/classes/List'
import Item from '@/classes/Item'

function toBase64Url (bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

describe('share encode/decode', () => {
  it('roundtrips a list with items', () => {
    const list = new List('Costco', [new Item('Eggs', '1'), new Item('Milk', '2')])
    const encoded = encodeList(list)
    const result = decodeList(encoded)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.list.id).toBe(list.id)
    expect(result.list.n).toBe('Costco')
    expect(result.list.i).toHaveLength(2)
    expect(result.list.i[0]).toMatchObject({ n: 'Eggs', q: '1', c: 0, d: 0 })
    expect(result.list.i[1]).toMatchObject({ n: 'Milk', q: '2', c: 0, d: 0 })
  })

  it('strips soft-deleted items at encode time', () => {
    const live = new Item('Eggs', '1')
    const dead = new Item('Milk', '1')
    dead.d = 1
    const list = new List('L', [live, dead])
    const result = decodeList(encodeList(list))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.list.i).toHaveLength(1)
    expect(result.list.i[0].n).toBe('Eggs')
  })

  it('preserves item timestamps for merge', () => {
    const item = new Item('Eggs', '1')
    item.u = 1700000000000
    item.c = 1
    const list = new List('L', [item])
    const result = decodeList(encodeList(list))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.list.i[0].u).toBe(1700000000000)
    expect(result.list.i[0].c).toBe(1)
  })

  it('rejects empty payload as corrupt', () => {
    expect(decodeList('')).toEqual({ ok: false, reason: 'corrupt' })
    expect(decodeList('1')).toEqual({ ok: false, reason: 'corrupt' })
  })

  it('rejects garbage base64 as corrupt', () => {
    expect(decodeList('1!!!notbase64!!!')).toEqual({ ok: false, reason: 'corrupt' })
  })

  it('rejects valid base64 of garbage as corrupt', () => {
    expect(decodeList('1aGVsbG8')).toEqual({ ok: false, reason: 'corrupt' })
  })

  it('rejects newer schema version', () => {
    const list = new List('L', [])
    const v1 = encodeList(list)
    const v2 = '2' + v1.slice(1)
    expect(decodeList(v2)).toEqual({ ok: false, reason: 'newer-schema' })
  })

  it('rejects non-numeric version prefix as corrupt', () => {
    expect(decodeList('xabcdef')).toEqual({ ok: false, reason: 'corrupt' })
  })

  it('rejects shape-mismatched payload as corrupt', () => {
    const compressed = toBase64Url(pako.deflate(JSON.stringify({ not: 'a tuple' })))
    expect(decodeList('1' + compressed)).toEqual({ ok: false, reason: 'corrupt' })
  })
})

describe('buildShareUrl', () => {
  it('builds a fragment-routed URL containing the payload', () => {
    const list = new List('L', [new Item('Eggs', '1')])
    const { url, payload, tooLarge } = buildShareUrl(list, 'https://grocerieslist.app')
    expect(url).toBe(`https://grocerieslist.app/#import=${payload}`)
    expect(tooLarge).toBe(false)
  })

  it('flags tooLarge when payload exceeds the QR limit', () => {
    const items = Array.from({ length: 500 }, (_, i) => new Item(`item-${i}-with-some-padding`, '1'))
    const list = new List('Big', items)
    const { tooLarge, url } = buildShareUrl(list, 'https://grocerieslist.app')
    expect(tooLarge).toBe(true)
    expect(url.length).toBeGreaterThan(QR_PAYLOAD_LIMIT)
  })
})

describe('parseImportFragment', () => {
  it('extracts payload from #import= hash', () => {
    expect(parseImportFragment('#import=1abc')).toBe('1abc')
  })

  it('returns null for empty hash', () => {
    expect(parseImportFragment('')).toBeNull()
  })

  it('returns null for non-import hash', () => {
    expect(parseImportFragment('#other=1')).toBeNull()
  })
})
