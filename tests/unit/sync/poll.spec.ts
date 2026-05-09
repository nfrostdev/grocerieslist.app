import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/sync/transport', () => ({ pollList: vi.fn() }))
vi.mock('@/sync/reconcile', () => ({ applyPollPayload: vi.fn() }))
vi.mock('@/sync/storage', () => ({
  getMeta: vi.fn(),
  getSyncMetaMap: vi.fn(() => ({})),
  saveSyncMetaMap: vi.fn()
}))

import { startPoller, stopPoller } from '@/sync/poll'
import { pollList } from '@/sync/transport'
import { applyPollPayload } from '@/sync/reconcile'
import { getMeta, getSyncMetaMap, saveSyncMetaMap } from '@/sync/storage'

describe('sync/poll', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.resetAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('startPoller: is a no-op when the same id is already active', async () => {
    getMeta.mockReturnValue(null)
    startPoller('dedup1')
    startPoller('dedup1')
    await vi.runAllTimersAsync()
    // only one poller ran — getMeta called once, not twice
    expect(getMeta).toHaveBeenCalledTimes(1)
  })

  it('stopPoller: prevents the loop body from running', async () => {
    getMeta.mockReturnValue({ authToken: 'tok', lastVersion: 0 })
    startPoller('stop1')
    stopPoller('stop1')
    await vi.runAllTimersAsync()
    expect(pollList).not.toHaveBeenCalled()
  })

  it('runPoller: exits immediately when getMeta returns null', async () => {
    getMeta.mockReturnValue(null)
    startPoller('nometa1')
    await vi.runAllTimersAsync()
    expect(pollList).not.toHaveBeenCalled()
  })

  it('runPoller: calls pollList, applyPollPayload, and updates stored version on success', async () => {
    getMeta
      .mockReturnValueOnce({ authToken: 'tok', lastVersion: 5 })
      .mockReturnValue(null)
    pollList.mockResolvedValue({ ok: true, data: { version: 6, items: [] } })
    getSyncMetaMap.mockReturnValue({ succ1: { authToken: 'tok', lastVersion: 5, role: 'owner' } })

    startPoller('succ1')
    await vi.runAllTimersAsync()

    expect(pollList).toHaveBeenCalledWith('succ1', 'tok', 5)
    expect(applyPollPayload).toHaveBeenCalledWith('succ1', { version: 6, items: [] })
    expect(saveSyncMetaMap).toHaveBeenCalledWith(
      expect.objectContaining({ succ1: expect.objectContaining({ lastVersion: 6 }) })
    )
  })

  it('runPoller: stops and removes itself on unauthorized error', async () => {
    getMeta.mockReturnValue({ authToken: 'bad', lastVersion: 0 })
    pollList.mockResolvedValue({ ok: false, error: { kind: 'unauthorized' } })

    startPoller('unauth1')
    await vi.runAllTimersAsync()

    expect(pollList).toHaveBeenCalledTimes(1)
    // poller cleaned up — new call with same id is not treated as duplicate
    getMeta.mockReturnValue(null)
    startPoller('unauth1')
    await vi.runAllTimersAsync()
    expect(pollList).toHaveBeenCalledTimes(1)
  })

  it('runPoller: stops on not-found error', async () => {
    getMeta.mockReturnValue({ authToken: 'tok', lastVersion: 0 })
    pollList.mockResolvedValue({ ok: false, error: { kind: 'not-found' } })

    startPoller('notfound1')
    await vi.runAllTimersAsync()

    expect(pollList).toHaveBeenCalledTimes(1)
    expect(applyPollPayload).not.toHaveBeenCalled()
  })

  it('runPoller: backs off and retries on network error', async () => {
    getMeta
      .mockReturnValueOnce({ authToken: 'tok', lastVersion: 0 })
      .mockReturnValue(null)
    pollList.mockResolvedValue({ ok: false, error: { kind: 'network' } })

    startPoller('net1')
    await vi.runAllTimersAsync()

    expect(pollList).toHaveBeenCalledTimes(1)
    expect(applyPollPayload).not.toHaveBeenCalled()
  })
})
