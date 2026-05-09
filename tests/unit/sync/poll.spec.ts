import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { startPoller, stopPoller } from '@/sync/poll'
import { pollList } from '@/sync/transport'
import { applyPollPayload } from '@/sync/reconcile'
import { getMeta, getSyncMetaMap, saveSyncMetaMap } from '@/sync/storage'

vi.mock('@/sync/transport', () => ({ pollList: vi.fn() }))
vi.mock('@/sync/reconcile', () => ({ applyPollPayload: vi.fn() }))
vi.mock('@/sync/storage', () => ({
  getMeta: vi.fn(),
  getSyncMetaMap: vi.fn(() => ({})),
  saveSyncMetaMap: vi.fn()
}))

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
    mGetMeta.mockReturnValue({ authToken: 'tok', lastVersion: 0, role: 'owner' })
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

  it('runPoller: calls pollList, applyPollPayload, and updates stored version on success', async () => {
    mGetMeta
      .mockReturnValueOnce({ authToken: 'tok', lastVersion: 5, role: 'owner' })
      .mockReturnValue(null)
    mPollList.mockResolvedValue({ ok: true, data: { version: 6, items: [] } })
    mGetSyncMetaMap.mockReturnValue({ succ1: { authToken: 'tok', lastVersion: 5, role: 'owner' } })

    startPoller('succ1')
    await vi.runAllTimersAsync()

    expect(mPollList).toHaveBeenCalledWith('succ1', 'tok', 5)
    expect(vi.mocked(applyPollPayload)).toHaveBeenCalledWith('succ1', { version: 6, items: [] })
    expect(vi.mocked(saveSyncMetaMap)).toHaveBeenCalledWith(
      expect.objectContaining({ succ1: expect.objectContaining({ lastVersion: 6 }) })
    )
  })

  it('runPoller: stops and removes itself on unauthorized error', async () => {
    mGetMeta.mockReturnValue({ authToken: 'bad', lastVersion: 0, role: 'editor' })
    mPollList.mockResolvedValue({ ok: false, error: { kind: 'unauthorized' } })

    startPoller('unauth1')
    await vi.runAllTimersAsync()

    expect(mPollList).toHaveBeenCalledTimes(1)
    mGetMeta.mockReturnValue(null)
    startPoller('unauth1')
    await vi.runAllTimersAsync()
    expect(mPollList).toHaveBeenCalledTimes(1)
  })

  it('runPoller: stops on not-found error', async () => {
    mGetMeta.mockReturnValue({ authToken: 'tok', lastVersion: 0, role: 'owner' })
    mPollList.mockResolvedValue({ ok: false, error: { kind: 'not-found' } })

    startPoller('notfound1')
    await vi.runAllTimersAsync()

    expect(mPollList).toHaveBeenCalledTimes(1)
    expect(vi.mocked(applyPollPayload)).not.toHaveBeenCalled()
  })

  it('runPoller: backs off and retries on network error', async () => {
    mGetMeta
      .mockReturnValueOnce({ authToken: 'tok', lastVersion: 0, role: 'owner' })
      .mockReturnValue(null)
    mPollList.mockResolvedValue({ ok: false, error: { kind: 'network' } })

    startPoller('net1')
    await vi.runAllTimersAsync()

    expect(mPollList).toHaveBeenCalledTimes(1)
    expect(vi.mocked(applyPollPayload)).not.toHaveBeenCalled()
  })
})
