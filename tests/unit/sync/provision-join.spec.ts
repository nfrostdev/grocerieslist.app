import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { provision, join } from '@/sync'
import { provisionList, joinList } from '@/sync/transport'
import { startPoller } from '@/sync/poll'
import { applyJoinPayload } from '@/sync/reconcile'
import { getMeta } from '@/sync/storage'
import { useListsStore } from '@/stores/lists'

vi.mock('@/sync/transport', () => ({
  provisionList: vi.fn(),
  joinList: vi.fn()
}))
vi.mock('@/sync/poll', () => ({ startPoller: vi.fn() }))
vi.mock('@/sync/reconcile', () => ({ applyJoinPayload: vi.fn() }))

const mProvisionList = vi.mocked(provisionList)
const mJoinList = vi.mocked(joinList)
const mStartPoller = vi.mocked(startPoller)
const mApplyJoinPayload = vi.mocked(applyJoinPayload)

describe('sync/index — provision', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.resetAllMocks()
  })

  it('returns null when provisionList fails', async () => {
    mProvisionList.mockResolvedValue({ ok: false, error: { kind: 'network' } })
    const result = await provision({ id: 'loc1', n: 'Test', i: [] })
    expect(result).toBeNull()
    expect(mStartPoller).not.toHaveBeenCalled()
  })

  it('renames list id, saves meta, starts poller, and returns joinUrl + listId', async () => {
    mProvisionList.mockResolvedValue({ ok: true, data: { id: 'srv1', authToken: 'tok1' } })
    const store = useListsStore()
    store.$patch({ lists: [{ id: 'loc1', n: 'Groceries', i: [] }] })

    const result = await provision({ id: 'loc1', n: 'Groceries', i: [] })

    expect(result?.listId).toBe('srv1')
    expect(result?.joinUrl).toContain('#join=srv1.tok1')
    expect(getMeta('srv1')).toEqual({ authToken: 'tok1', role: 'owner', lastCursor: 0 })
    expect(mStartPoller).toHaveBeenCalledWith('srv1')
    expect(store.lists[0].id).toBe('srv1')
  })

  it('sends only non-deleted items to provisionList', async () => {
    mProvisionList.mockResolvedValue({ ok: true, data: { id: 'srv2', authToken: 't2' } })
    const list = {
      id: 'loc2',
      n: 'List',
      i: [
        { id: 'i1', n: 'Bread', q: '1', c: 0, u: 1, d: 0 },
        { id: 'i2', n: 'Milk', q: '1', c: 0, u: 1, d: 1 }
      ]
    }
    useListsStore().$patch({ lists: [list] })
    await provision(list)
    const sentItems = mProvisionList.mock.calls[0][1]
    expect(sentItems).toHaveLength(1)
    expect(sentItems[0].id).toBe('i1')
  })

  it('sets lastCursor to max(item.u) of provisioned non-deleted items', async () => {
    mProvisionList.mockResolvedValue({ ok: true, data: { id: 'srv3', authToken: 't3' } })
    const list = {
      id: 'loc3',
      n: 'List',
      i: [
        { id: 'i1', n: 'A', q: '', c: 0, u: 100, d: 0 },
        { id: 'i2', n: 'B', q: '', c: 0, u: 250, d: 0 },
        { id: 'i3', n: 'C', q: '', c: 0, u: 999, d: 1 }
      ]
    }
    useListsStore().$patch({ lists: [list] })
    await provision(list)
    expect(getMeta('srv3')).toEqual({ authToken: 't3', role: 'owner', lastCursor: 250 })
  })
})

describe('sync/index — join', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.resetAllMocks()
  })

  it('returns false when joinList fails', async () => {
    mJoinList.mockResolvedValue({ ok: false, error: { kind: 'unauthorized' } })
    expect(await join('list1', 'bad')).toBe(false)
    expect(mStartPoller).not.toHaveBeenCalled()
  })

  it('applies payload, saves meta, starts poller, and returns true', async () => {
    const data = { listId: 'list2', role: 'editor' as const, name: 'Shared', version: 1, cursor: 1700, items: [] }
    mJoinList.mockResolvedValue({ ok: true, data })

    expect(await join('list2', 'tok2')).toBe(true)
    expect(mApplyJoinPayload).toHaveBeenCalledWith(data)
    expect(getMeta('list2')).toEqual({ authToken: 'tok2', role: 'editor', lastCursor: 1700 })
    expect(mStartPoller).toHaveBeenCalledWith('list2')
  })
})
