import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { getMeta } from '@/sync/storage'
import { upsertItem } from '@/sync/transport'
import { reconcileServerItem } from '@/sync/reconcile'
import { cleanupListLocally } from '@/sync/cleanup'
import { useListsStore } from '@/stores/lists'
import { useToastStore } from '@/stores/toast'
import { enqueue, startDrainer, _resetForTest } from '@/sync/queue'

vi.mock('@/sync/storage', () => ({
  getMeta: vi.fn(),
  removeMeta: vi.fn()
}))

vi.mock('@/sync/transport', () => ({
  upsertItem: vi.fn(),
  patchList: vi.fn()
}))

vi.mock('@/sync/reconcile', () => ({
  reconcileServerItem: vi.fn()
}))

vi.mock('@/sync/poll', () => ({
  stopPoller: vi.fn()
}))

vi.mock('@/sync/cleanup', () => ({
  cleanupListLocally: vi.fn()
}))

vi.mock('@/stores/lists', () => ({
  useListsStore: vi.fn()
}))

vi.mock('@/stores/toast', () => ({
  useToastStore: vi.fn(() => ({ add: vi.fn() }))
}))

const ITEM = { id: 'item0001', n: 'Milk', q: '1', c: 0, u: 1000, d: 0 }
const META = { authToken: 'tok', role: 'owner' as const, lastVersion: 1 }

function mockStore (overrides: Record<string, unknown> = {}) {
  const store = { deleteList: vi.fn(), getListFromId: vi.fn(), mergeList: vi.fn(), ...overrides }
  vi.mocked(useListsStore).mockReturnValue(store as unknown as ReturnType<typeof useListsStore>)
  return store
}

beforeEach(() => {
  vi.useFakeTimers()
  _resetForTest()
  localStorage.clear()
  setActivePinia(createPinia())
  vi.resetAllMocks()
  vi.mocked(useToastStore).mockReturnValue({ add: vi.fn() } as unknown as ReturnType<typeof useToastStore>)
  vi.mocked(useListsStore).mockReturnValue({ getListFromId: vi.fn(), deleteList: vi.fn(), mergeList: vi.fn() } as unknown as ReturnType<typeof useListsStore>)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('enqueue', () => {
  // Block the drainer so we can inspect localStorage before it drains.
  function blockDrainer () {
    vi.mocked(getMeta).mockReturnValue(META)
    vi.mocked(upsertItem).mockReturnValue(new Promise(() => {}))
  }

  it('persists op to localStorage', () => {
    blockDrainer()
    enqueue({ kind: 'upsertItem', listId: 'list1', item: ITEM })
    const q = JSON.parse(localStorage.getItem('pendingOps') ?? '[]') as unknown[]
    expect(q).toHaveLength(1)
    expect((q[0] as { kind: string }).kind).toBe('upsertItem')
  })

  it('appends multiple ops in order', () => {
    blockDrainer()
    enqueue({ kind: 'upsertItem', listId: 'list1', item: { ...ITEM, id: 'a' } })
    enqueue({ kind: 'upsertItem', listId: 'list1', item: { ...ITEM, id: 'b' } })
    const q = JSON.parse(localStorage.getItem('pendingOps') ?? '[]') as Array<{ item: { id: string } }>
    expect(q[0].item.id).toBe('a')
    expect(q[1].item.id).toBe('b')
  })
})

describe('flush — success path', () => {
  it('removes head op and calls reconcileServerItem on success', async () => {
    vi.mocked(getMeta).mockReturnValue(META)
    vi.mocked(upsertItem).mockResolvedValue({ ok: true, data: { item: ITEM } })
    mockStore({ getListFromId: vi.fn().mockReturnValue({ id: 'list1', n: 'G', i: [] }) })

    enqueue({ kind: 'upsertItem', listId: 'list1', item: ITEM })
    await vi.runAllTimersAsync()

    expect(vi.mocked(reconcileServerItem)).toHaveBeenCalledWith('list1', ITEM)
    const q = JSON.parse(localStorage.getItem('pendingOps') ?? '[]') as unknown[]
    expect(q).toHaveLength(0)
  })

  it('processes ops in FIFO order', async () => {
    vi.mocked(getMeta).mockReturnValue(META)
    const order: string[] = []
    vi.mocked(upsertItem).mockImplementation(async (_l, itemId) => {
      order.push(itemId)
      return { ok: true, data: { item: { ...ITEM, id: itemId } } }
    })
    mockStore({ getListFromId: vi.fn().mockReturnValue({ id: 'list1', n: 'G', i: [] }) })

    enqueue({ kind: 'upsertItem', listId: 'list1', item: { ...ITEM, id: 'first' } })
    enqueue({ kind: 'upsertItem', listId: 'list1', item: { ...ITEM, id: 'second' } })
    await vi.runAllTimersAsync()

    expect(order).toEqual(['first', 'second'])
  })
})

describe('flush — missing meta', () => {
  it('drops all ops for a list when meta is gone', async () => {
    vi.mocked(getMeta).mockReturnValue(null)
    mockStore()

    enqueue({ kind: 'upsertItem', listId: 'list1', item: ITEM })
    await vi.runAllTimersAsync()

    expect(vi.mocked(upsertItem)).not.toHaveBeenCalled()
    const q = JSON.parse(localStorage.getItem('pendingOps') ?? '[]') as unknown[]
    expect(q).toHaveLength(0)
  })
})

describe('flush — 401/404 teardown', () => {
  it('tears down on 401: calls cleanupListLocally and shows revoke toast', async () => {
    vi.mocked(getMeta).mockReturnValue(META)
    vi.mocked(upsertItem).mockResolvedValue({ ok: false, error: { kind: 'unauthorized' } })
    mockStore()
    const toastAdd = vi.fn()
    vi.mocked(useToastStore).mockReturnValue({ add: toastAdd } as unknown as ReturnType<typeof useToastStore>)

    enqueue({ kind: 'upsertItem', listId: 'list1', item: ITEM })
    await vi.runAllTimersAsync()

    expect(vi.mocked(cleanupListLocally)).toHaveBeenCalledWith('list1')
    expect(toastAdd).toHaveBeenCalledWith(expect.stringContaining('revoked'), 'error')
    const q = JSON.parse(localStorage.getItem('pendingOps') ?? '[]') as unknown[]
    expect(q).toHaveLength(0)
  })

  it('tears down on 404: calls cleanupListLocally and shows deleted toast', async () => {
    vi.mocked(getMeta).mockReturnValue(META)
    vi.mocked(upsertItem).mockResolvedValue({ ok: false, error: { kind: 'not-found' } })
    mockStore()
    const toastAdd = vi.fn()
    vi.mocked(useToastStore).mockReturnValue({ add: toastAdd } as unknown as ReturnType<typeof useToastStore>)

    enqueue({ kind: 'upsertItem', listId: 'list1', item: ITEM })
    await vi.runAllTimersAsync()

    expect(vi.mocked(cleanupListLocally)).toHaveBeenCalledWith('list1')
    expect(toastAdd).toHaveBeenCalledWith(expect.stringContaining('deleted'), 'error')
  })

  it('drops only the affected list ops, leaves other lists intact', async () => {
    vi.mocked(getMeta).mockImplementation((id) => id === 'list2' ? META : null)
    vi.mocked(upsertItem).mockResolvedValue({ ok: true, data: { item: ITEM } })
    mockStore({ getListFromId: vi.fn().mockReturnValue({ id: 'list2', n: 'G', i: [] }) })

    enqueue({ kind: 'upsertItem', listId: 'list1', item: ITEM })
    enqueue({ kind: 'upsertItem', listId: 'list2', item: ITEM })
    await vi.runAllTimersAsync()

    const q = JSON.parse(localStorage.getItem('pendingOps') ?? '[]') as unknown[]
    expect(q).toHaveLength(0) // list1 dropped (no meta), list2 processed
  })
})

describe('flush — network backoff', () => {
  it('retries after sleep on network error then succeeds', async () => {
    vi.mocked(getMeta).mockReturnValue(META)
    vi.mocked(upsertItem)
      .mockResolvedValueOnce({ ok: false, error: { kind: 'network' } })
      .mockResolvedValue({ ok: true, data: { item: ITEM } })
    mockStore({ getListFromId: vi.fn().mockReturnValue({ id: 'list1', n: 'G', i: [] }) })

    enqueue({ kind: 'upsertItem', listId: 'list1', item: ITEM })
    await vi.runAllTimersAsync()

    expect(vi.mocked(upsertItem)).toHaveBeenCalledTimes(2)
    const q = JSON.parse(localStorage.getItem('pendingOps') ?? '[]') as unknown[]
    expect(q).toHaveLength(0)
  })
})

describe('startDrainer', () => {
  it('flushes pre-existing queue ops on startup', async () => {
    localStorage.setItem('pendingOps', JSON.stringify([{ kind: 'upsertItem', listId: 'list1', item: ITEM }]))
    vi.mocked(getMeta).mockReturnValue(META)
    vi.mocked(upsertItem).mockResolvedValue({ ok: true, data: { item: ITEM } })
    mockStore({ getListFromId: vi.fn().mockReturnValue({ id: 'list1', n: 'G', i: [] }) })

    startDrainer()
    await vi.runAllTimersAsync()

    const q = JSON.parse(localStorage.getItem('pendingOps') ?? '[]') as unknown[]
    expect(q).toHaveLength(0)
  })
})
