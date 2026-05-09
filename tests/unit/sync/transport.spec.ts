import { describe, it, expect, vi, afterEach } from 'vitest'
import { provisionList, joinList, pollList, mintToken, revokeToken, deleteListRequest } from '@/sync/transport'

const mockFetch = (ok: boolean, status: number, data: unknown) =>
  vi.fn().mockResolvedValue({ ok, status, json: () => Promise.resolve(data) })

const mockNetworkError = () =>
  vi.fn().mockRejectedValue(new TypeError('fetch failed'))

describe('sync/transport', () => {
  afterEach(() => vi.unstubAllGlobals())

  describe('provisionList', () => {
    it('returns data on 200', async () => {
      vi.stubGlobal('fetch', mockFetch(true, 200, { id: 'ulid1', authToken: 'tok' }))
      const result = await provisionList('My List', [])
      expect(result).toEqual({ ok: true, data: { id: 'ulid1', authToken: 'tok' } })
    })

    it('returns server error on 500', async () => {
      vi.stubGlobal('fetch', mockFetch(false, 500, {}))
      const result = await provisionList('My List', [])
      expect(result).toEqual({ ok: false, error: { kind: 'server', status: 500 } })
    })

    it('returns unauthorized on 401', async () => {
      vi.stubGlobal('fetch', mockFetch(false, 401, {}))
      const result = await provisionList('My List', [])
      expect(result).toEqual({ ok: false, error: { kind: 'unauthorized' } })
    })

    it('returns network error when fetch throws', async () => {
      vi.stubGlobal('fetch', mockNetworkError())
      const result = await provisionList('My List', [])
      expect(result).toEqual({ ok: false, error: { kind: 'network' } })
    })
  })

  describe('joinList', () => {
    const JOIN_DATA = { listId: 'abc', role: 'editor', name: 'Test', version: 1, items: [] }

    it('returns data on 200', async () => {
      vi.stubGlobal('fetch', mockFetch(true, 200, JOIN_DATA))
      const result = await joinList('abc', 'tok')
      expect(result).toEqual({ ok: true, data: JOIN_DATA })
    })

    it('returns unauthorized on 401', async () => {
      vi.stubGlobal('fetch', mockFetch(false, 401, {}))
      expect(await joinList('abc', 'bad')).toEqual({ ok: false, error: { kind: 'unauthorized' } })
    })

    it('returns not-found on 404', async () => {
      vi.stubGlobal('fetch', mockFetch(false, 404, {}))
      expect(await joinList('abc', 'tok')).toEqual({ ok: false, error: { kind: 'not-found' } })
    })

    it('returns network error when fetch throws', async () => {
      vi.stubGlobal('fetch', mockNetworkError())
      expect(await joinList('abc', 'tok')).toEqual({ ok: false, error: { kind: 'network' } })
    })
  })

  describe('pollList', () => {
    it('returns data on 200', async () => {
      const data = { version: 2, items: [] }
      vi.stubGlobal('fetch', mockFetch(true, 200, data))
      expect(await pollList('abc', 'tok', 1)).toEqual({ ok: true, data })
    })

    it('returns unauthorized on 401', async () => {
      vi.stubGlobal('fetch', mockFetch(false, 401, {}))
      expect(await pollList('abc', 'tok', 0)).toEqual({ ok: false, error: { kind: 'unauthorized' } })
    })

    it('returns not-found on 404', async () => {
      vi.stubGlobal('fetch', mockFetch(false, 404, {}))
      expect(await pollList('abc', 'tok', 0)).toEqual({ ok: false, error: { kind: 'not-found' } })
    })

    it('returns network error when fetch throws', async () => {
      vi.stubGlobal('fetch', mockNetworkError())
      expect(await pollList('abc', 'tok', 0)).toEqual({ ok: false, error: { kind: 'network' } })
    })
  })

  describe('mintToken', () => {
    it('returns token on 200', async () => {
      vi.stubGlobal('fetch', mockFetch(true, 200, { token: 'new-tok' }))
      expect(await mintToken('list1', 'owner-tok')).toEqual({ ok: true, data: { token: 'new-tok' } })
    })

    it('returns unauthorized on 403', async () => {
      vi.stubGlobal('fetch', mockFetch(false, 403, {}))
      expect(await mintToken('list1', 'editor-tok')).toEqual({ ok: false, error: { kind: 'server', status: 403 } })
    })

    it('returns network error when fetch throws', async () => {
      vi.stubGlobal('fetch', mockNetworkError())
      expect(await mintToken('list1', 'tok')).toEqual({ ok: false, error: { kind: 'network' } })
    })
  })

  describe('revokeToken', () => {
    it('returns ok on 200', async () => {
      vi.stubGlobal('fetch', mockFetch(true, 200, {}))
      const result = await revokeToken('list1', 'owner-tok')
      expect(result.ok).toBe(true)
    })

    it('returns unauthorized on 401', async () => {
      vi.stubGlobal('fetch', mockFetch(false, 401, {}))
      expect(await revokeToken('list1', 'bad')).toEqual({ ok: false, error: { kind: 'unauthorized' } })
    })

    it('returns network error when fetch throws', async () => {
      vi.stubGlobal('fetch', mockNetworkError())
      expect(await revokeToken('list1', 'tok')).toEqual({ ok: false, error: { kind: 'network' } })
    })
  })

  describe('deleteListRequest', () => {
    it('returns ok on 200', async () => {
      vi.stubGlobal('fetch', mockFetch(true, 200, {}))
      expect((await deleteListRequest('list1', 'tok')).ok).toBe(true)
    })

    it('returns unauthorized on 401', async () => {
      vi.stubGlobal('fetch', mockFetch(false, 401, {}))
      expect(await deleteListRequest('list1', 'bad')).toEqual({ ok: false, error: { kind: 'unauthorized' } })
    })

    it('returns network error when fetch throws', async () => {
      vi.stubGlobal('fetch', mockNetworkError())
      expect(await deleteListRequest('list1', 'tok')).toEqual({ ok: false, error: { kind: 'network' } })
    })
  })
})
