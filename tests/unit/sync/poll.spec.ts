import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { startPoller, stopPoller } from '@/sync/poll'
import { pollList } from '@/sync/transport'
import { applyPollPayload } from '@/sync/reconcile'
import { getMeta, getSyncMetaMap, saveSyncMetaMap } from '@/sync/storage'
import { onAuthLost } from '@/sync/cleanup'

vi.mock('@/sync/transport', () => ({ pollList: vi.fn() }))
vi.mock('@/sync/reconcile', () => ({ applyPollPayload: vi.fn() }))
vi.mock('@/sync/storage', () => ({
  getMeta: vi.fn(),
  getSyncMetaMap: vi.fn(() => ({})),
  saveSyncMetaMap: vi.fn()
}))
vi.mock('@/sync/cleanup', () => ({ cleanupListLocally: vi.fn(), onAuthLost: vi.fn() }))
const mGcTombstones = vi.fn()
vi.mock('@/stores/lists', () => ({ useListsStore: vi.fn(() => ({ getListFromId: vi.fn(() => ({ n: 'Test List' })), gcTombstones: mGcTombstones })) }))

const mGetMeta = vi.mocked(getMeta)
const mPollList = vi.mocked(pollList)
const mGetSyncMetaMap = vi.mocked(getSyncMetaMap)

describe('sync/poll', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.resetAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('startPoller: is a no-op when the same id is already active', async () => {
    mGetMeta.mockReturnValue(null)
    startPoller('dedup1')
    startPoller('dedup1')
    await vi.runAllTimersAsync()
    expect(mGetMeta).toHaveBeenCalledTimes(1)
  })

  it('stopPoller: prevents the loop body from running', async () => {
    mGetMeta.mockReturnValue({ authToken: 'tok', lastCursor: 0, role: 'owner' })
    startPoller('stop1')
    stopPoller('stop1')
    await vi.runAllTimersAsync()
    expect(mPollList).not.toHaveBeenCalled()
  })

  it('runPoller: exits immediately when getMeta returns null', async () => {
    mGetMeta.mockReturnValue(null)
    startPoller('nometa1')
    await vi.runAllTimersAsync()
    expect(mPollList).not.toHaveBeenCalled()
  })

  it('runPoller: invokes gcTombstones after a successful poll', async () => {
    mGetMeta
      .mockReturnValueOnce({ authToken: 'tok', lastCursor: 0, role: 'owner' })
      .mockReturnValue(null)
    mPollList.mockResolvedValue({ ok: true, data: { cursor: 1, items: [] } })

    startPoller('gc1')
    await vi.runAllTimersAsync()

    expect(mGcTombstones).toHaveBeenCalled()
  })

  it('runPoller: does NOT invoke gcTombstones when poll fails (network)', async () => {
    mGetMeta
      .mockReturnValueOnce({ authToken: 'tok', lastCursor: 0, role: 'owner' })
      .mockReturnValue(null)
    mPollList.mockResolvedValue({ ok: false, error: { kind: 'network' } })

    startPoller('gc2')
    await vi.runAllTimersAsync()

    expect(mGcTombstones).not.toHaveBeenCalled()
  })

  it('runPoller: calls pollList, applyPollPayload, and stores returned cursor on success', async () => {
    mGetMeta
      .mockReturnValueOnce({ authToken: 'tok', lastCursor: 1000, role: 'owner' })
      .mockReturnValue(null)
    const payload = { cursor: 2500, items: [] }
    mPollList.mockResolvedValue({ ok: true, data: payload })
    mGetSyncMetaMap.mockReturnValue({ succ1: { authToken: 'tok', lastCursor: 1000, role: 'owner' } })

    startPoller('succ1')
    await vi.runAllTimersAsync()

    expect(mPollList).toHaveBeenCalledWith('succ1', 'tok', 1000)
    expect(vi.mocked(applyPollPayload)).toHaveBeenCalledWith('succ1', payload)
    expect(vi.mocked(saveSyncMetaMap)).toHaveBeenCalledWith(
      expect.objectContaining({ succ1: expect.objectContaining({ lastCursor: 2500 }) })
    )
  })

  it('runPoller: stops and delegates to onAuthLost on unauthorized error', async () => {
    mGetMeta.mockReturnValue({ authToken: 'bad', lastCursor: 0, role: 'editor' })
    mPollList.mockResolvedValue({ ok: false, error: { kind: 'unauthorized' } })

    startPoller('unauth1')
    await vi.runAllTimersAsync()

    expect(mPollList).toHaveBeenCalledTimes(1)
    expect(vi.mocked(onAuthLost)).toHaveBeenCalledWith('unauth1', 'unauthorized')
    mGetMeta.mockReturnValue(null)
    startPoller('unauth1')
    await vi.runAllTimersAsync()
    expect(mPollList).toHaveBeenCalledTimes(1)
  })

  it('runPoller: stops and delegates to onAuthLost on not-found error', async () => {
    mGetMeta.mockReturnValue({ authToken: 'tok', lastCursor: 0, role: 'owner' })
    mPollList.mockResolvedValue({ ok: false, error: { kind: 'not-found' } })

    startPoller('notfound1')
    await vi.runAllTimersAsync()

    expect(mPollList).toHaveBeenCalledTimes(1)
    expect(vi.mocked(applyPollPayload)).not.toHaveBeenCalled()
    expect(vi.mocked(onAuthLost)).toHaveBeenCalledWith('notfound1', 'not-found')
  })

  it('stopPoller: removes the visibilitychange listener registered while hidden', async () => {
    const hiddenDesc = Object.getOwnPropertyDescriptor(Document.prototype, 'hidden')
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
    const addSpy = vi.spyOn(document, 'addEventListener')
    const removeSpy = vi.spyOn(document, 'removeEventListener')
    try {
      mGetMeta.mockReturnValue({ authToken: 'tok', lastCursor: 0, role: 'owner' })
      startPoller('vis1')
      await Promise.resolve()
      const visAdds = addSpy.mock.calls.filter(([type]) => type === 'visibilitychange')
      expect(visAdds.length).toBeGreaterThan(0)

      stopPoller('vis1')
      const visRemoves = removeSpy.mock.calls.filter(([type]) => type === 'visibilitychange')
      expect(visRemoves.length).toBe(visAdds.length)
    } finally {
      if (hiddenDesc) Object.defineProperty(document, 'hidden', hiddenDesc)
      addSpy.mockRestore()
      removeSpy.mockRestore()
    }
  })

  it('runPoller: backs off and retries on network error', async () => {
    mGetMeta
      .mockReturnValueOnce({ authToken: 'tok', lastCursor: 0, role: 'owner' })
      .mockReturnValue(null)
    mPollList.mockResolvedValue({ ok: false, error: { kind: 'network' } })

    startPoller('net1')
    await vi.runAllTimersAsync()

    expect(mPollList).toHaveBeenCalledTimes(1)
    expect(vi.mocked(applyPollPayload)).not.toHaveBeenCalled()
  })
})
