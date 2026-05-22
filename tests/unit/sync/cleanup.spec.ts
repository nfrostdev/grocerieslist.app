import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { cleanupListLocally, onAuthLost } from '@/sync/cleanup'
import { getMeta, setMeta } from '@/sync/storage'
import { useListsStore } from '@/stores/lists'
import { useToastStore } from '@/stores/toast'

vi.mock('@/sync/poll', () => ({ stopPoller: vi.fn() }))

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  vi.resetAllMocks()
})

describe('cleanupListLocally', () => {
  it('does nothing when meta is absent', () => {
    const store = useListsStore()
    store.$patch({ lists: [{ id: 'list1', n: 'Test', i: [] }] })
    cleanupListLocally('list1')
    expect(store.lists).toHaveLength(1)
  })

  it('removes meta and deletes list from store when meta exists', () => {
    const store = useListsStore()
    store.$patch({ lists: [{ id: 'list1', n: 'Test', i: [] }] })
    setMeta('list1', { authToken: 'tok', role: 'owner', lastCursor: 1 })

    cleanupListLocally('list1')

    expect(getMeta('list1')).toBeNull()
    expect(store.lists).toHaveLength(0)
  })

  it('is idempotent — second call is a no-op', () => {
    const store = useListsStore()
    store.$patch({ lists: [{ id: 'list1', n: 'Test', i: [] }] })
    setMeta('list1', { authToken: 'tok', role: 'owner', lastCursor: 1 })

    cleanupListLocally('list1')
    cleanupListLocally('list1')

    expect(getMeta('list1')).toBeNull()
    expect(store.lists).toHaveLength(0)
  })
})

describe('onAuthLost', () => {
  it('toasts the revoke message and cleans up when meta exists (unauthorized)', () => {
    const store = useListsStore()
    store.$patch({ lists: [{ id: 'list1', n: 'My List', i: [] }] })
    setMeta('list1', { authToken: 'tok', role: 'editor', lastCursor: 1 })
    const toast = useToastStore()

    onAuthLost('list1', 'unauthorized')

    expect(toast.toasts).toHaveLength(1)
    expect(toast.toasts[0].message).toContain('revoked')
    expect(toast.toasts[0].message).toContain('"My List"')
    expect(getMeta('list1')).toBeNull()
    expect(store.lists).toHaveLength(0)
  })

  it('toasts the deleted message and cleans up when meta exists (not-found)', () => {
    const store = useListsStore()
    store.$patch({ lists: [{ id: 'list1', n: 'My List', i: [] }] })
    setMeta('list1', { authToken: 'tok', role: 'editor', lastCursor: 1 })
    const toast = useToastStore()

    onAuthLost('list1', 'not-found')

    expect(toast.toasts).toHaveLength(1)
    expect(toast.toasts[0].message).toContain('deleted')
  })

  it('is a no-op when meta is absent (dedup guard)', () => {
    const store = useListsStore()
    store.$patch({ lists: [] })
    const toast = useToastStore()

    onAuthLost('list1', 'unauthorized')

    expect(toast.toasts).toHaveLength(0)
    expect(store.lists).toHaveLength(0)
  })

  it('emits only one toast when called twice — second call sees no meta', () => {
    const store = useListsStore()
    store.$patch({ lists: [{ id: 'list1', n: 'My List', i: [] }] })
    setMeta('list1', { authToken: 'tok', role: 'editor', lastCursor: 1 })
    const toast = useToastStore()

    onAuthLost('list1', 'unauthorized')
    onAuthLost('list1', 'unauthorized')

    expect(toast.toasts).toHaveLength(1)
  })
})
