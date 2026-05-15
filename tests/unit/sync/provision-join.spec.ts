import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { provision, join } from '@/sync'
import { provisionList, joinList, upsertItem } from '@/sync/transport'
import { startPoller } from '@/sync/poll'
import { applyJoinPayload } from '@/sync/reconcile'
import { getMeta } from '@/sync/storage'
import { _resetForTest as resetQueueForTest } from '@/sync/queue'
import { useListsStore } from '@/stores/lists'
import Item from '@/classes/Item'

vi.mock('@/sync/transport', () => ({
  provisionList: vi.fn(),
  joinList: vi.fn(),
  upsertItem: vi.fn().mockResolvedValue({ ok: false, error: { kind: 'network' as const } })
}))
vi.mock('@/sync/poll', () => ({ startPoller: vi.fn() }))
vi.mock('@/sync/reconcile', () => ({ applyJoinPayload: vi.fn() }))

const mProvisionList = vi.mocked(provisionList)
const mJoinList = vi.mocked(joinList)
const mUpsertItem = vi.mocked(upsertItem)
const mStartPoller = vi.mocked(startPoller)
const mApplyJoinPayload = vi.mocked(applyJoinPayload)

describe('sync/index — provision', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.resetAllMocks()
    resetQueueForTest()
    // Default: any enqueued ops the drainer picks up after provision return a
    // network error so the loop backs off without spamming console. Tests
    // assert on the queue contents before the drainer can drain it.
    mUpsertItem.mockResolvedValue({ ok: false, error: { kind: 'network' as const } })
  })

  it('returns null when provisionList fails', async () => {
    mProvisionList.mockResolvedValue({ ok: false, error: { kind: 'network' } })
    const result = await provision({ id: 'loc1', n: 'Test', i: [] })
    expect(result).toBeNull()
    expect(mStartPoller).not.toHaveBeenCalled()
  })

  it('renames list id, saves meta, starts poller, and returns joinUrl + listId', async () => {
    mProvisionList.mockResolvedValue({ ok: true, data: { id: 'srv1', authToken: 'tok1', role: 'owner' as const } })
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
    mProvisionList.mockResolvedValue({ ok: true, data: { id: 'srv2', authToken: 't2', role: 'owner' as const } })
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
    mProvisionList.mockResolvedValue({ ok: true, data: { id: 'srv3', authToken: 't3', role: 'owner' as const } })
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

  // Items added while a provision POST is in flight are not in the body
  // (snapshot taken pre-await) and cannot be enqueued at the time (no meta
  // yet). The provision flow must catch them up after setMeta. See #139.
  it('enqueues items added while provisionList is in flight', async () => {
    let resolveProvision!: (v: { ok: true; data: { id: string; authToken: string; role: 'owner' } }) => void
    mProvisionList.mockReturnValue(new Promise(resolve => { resolveProvision = resolve }))

    const store = useListsStore()
    const initialItem = { id: 'i1', n: 'Bread', q: '1', c: 0, u: 1, d: 0 }
    store.$patch({ lists: [{ id: 'loc-race', n: 'List', i: [initialItem] }] })

    const provisionPromise = provision({ id: 'loc-race', n: 'List', i: [initialItem] })

    const lateItem = new Item('Milk', '2')
    store.addItem('loc-race', lateItem)

    resolveProvision({ ok: true, data: { id: 'srv-race', authToken: 'tok-race', role: 'owner' } })
    await provisionPromise

    const queue = JSON.parse(localStorage.getItem('pendingOps') ?? '[]') as Array<{ item: { id: string }; listId: string }>
    expect(queue.some(op => op.item.id === lateItem.id && op.listId === 'srv-race')).toBe(true)
  })

  // Items modified mid-flight (e.g. the user edits a quantity while
  // provision is pending) also need to be caught up — the server has the
  // pre-edit version from the provision body.
  it('enqueues items modified while provisionList is in flight', async () => {
    let resolveProvision!: (v: { ok: true; data: { id: string; authToken: string; role: 'owner' } }) => void
    mProvisionList.mockReturnValue(new Promise(resolve => { resolveProvision = resolve }))

    const store = useListsStore()
    const initialItem = { id: 'orig', n: 'Bread', q: '1', c: 0, u: 1, d: 0 }
    store.$patch({ lists: [{ id: 'loc-mod', n: 'List', i: [initialItem] }] })

    const provisionPromise = provision({ id: 'loc-mod', n: 'List', i: [initialItem] })

    store.updateItem('loc-mod', 'orig', { q: '5' })

    resolveProvision({ ok: true, data: { id: 'srv-mod', authToken: 'tok-mod', role: 'owner' } })
    await provisionPromise

    const queue = JSON.parse(localStorage.getItem('pendingOps') ?? '[]') as Array<{ item: { id: string; q: string }; listId: string }>
    const op = queue.find(o => o.item.id === 'orig' && o.listId === 'srv-mod')
    expect(op?.item.q).toBe('5')
  })

  it('does not enqueue when no items changed during provision', async () => {
    mProvisionList.mockResolvedValue({ ok: true, data: { id: 'srv-quiet', authToken: 'tok-quiet', role: 'owner' as const } })
    const list = { id: 'loc-quiet', n: 'List', i: [{ id: 'a', n: 'A', q: '1', c: 0, u: 10, d: 0 }] }
    useListsStore().$patch({ lists: [list] })

    await provision(list)

    expect(localStorage.getItem('pendingOps')).toBeNull()
  })
})

describe('sync/index — join', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.resetAllMocks()
  })

  it('returns reason: invalid on auth/server errors', async () => {
    mJoinList.mockResolvedValue({ ok: false, error: { kind: 'unauthorized' } })
    expect(await join('list1', 'bad')).toEqual({ ok: false, reason: 'invalid' })
    expect(mStartPoller).not.toHaveBeenCalled()
  })

  it('returns reason: network on network errors so callers can retry', async () => {
    mJoinList.mockResolvedValue({ ok: false, error: { kind: 'network' } })
    expect(await join('list1', 'tok')).toEqual({ ok: false, reason: 'network' })
    expect(mStartPoller).not.toHaveBeenCalled()
  })

  it('applies payload, saves meta, starts poller, and returns ok: true', async () => {
    const data = { listId: 'list2', role: 'editor' as const, name: 'Shared', version: 1, cursor: 1700, items: [] }
    mJoinList.mockResolvedValue({ ok: true, data })

    expect(await join('list2', 'tok2')).toEqual({ ok: true })
    expect(mApplyJoinPayload).toHaveBeenCalledWith(data)
    expect(getMeta('list2')).toEqual({ authToken: 'tok2', role: 'editor', lastCursor: 1700 })
    expect(mStartPoller).toHaveBeenCalledWith('list2')
  })
})
