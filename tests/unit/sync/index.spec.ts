import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setMeta } from '@/sync/storage'
import { isSynced, startPolling } from '@/sync'
import { startPoller } from '@/sync/poll'

vi.mock('@/sync/poll', () => ({ startPoller: vi.fn() }))

describe('sync/index', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  describe('isSynced', () => {
    it('returns false when no meta stored', () => {
      expect(isSynced('abc')).toBe(false)
    })

    it('returns true when meta is present', () => {
      setMeta('abc', { authToken: 'tok', role: 'owner', lastCursor: 1 })
      expect(isSynced('abc')).toBe(true)
    })
  })

  describe('startPolling', () => {
    it('calls startPoller for each syncMeta entry', () => {
      setMeta('id1', { authToken: 't1', role: 'owner', lastCursor: 1 })
      setMeta('id2', { authToken: 't2', role: 'editor', lastCursor: 2 })
      startPolling()
      expect(startPoller).toHaveBeenCalledTimes(2)
      expect(startPoller).toHaveBeenCalledWith('id1')
      expect(startPoller).toHaveBeenCalledWith('id2')
    })

    it('does nothing when syncMeta is empty', () => {
      startPolling()
      expect(startPoller).not.toHaveBeenCalled()
    })
  })
})
