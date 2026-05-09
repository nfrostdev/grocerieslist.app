import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { cleanupListLocally } from '@/sync/cleanup'
import { getMeta, setMeta } from '@/sync/storage'
import { useListsStore } from '@/stores/lists'

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
    setMeta('list1', { authToken: 'tok', role: 'owner', lastVersion: 1 })

    cleanupListLocally('list1')

    expect(getMeta('list1')).toBeNull()
    expect(store.lists).toHaveLength(0)
  })

  it('is idempotent — second call is a no-op', () => {
    const store = useListsStore()
    store.$patch({ lists: [{ id: 'list1', n: 'Test', i: [] }] })
    setMeta('list1', { authToken: 'tok', role: 'owner', lastVersion: 1 })

    cleanupListLocally('list1')
    cleanupListLocally('list1')

    expect(getMeta('list1')).toBeNull()
    expect(store.lists).toHaveLength(0)
  })
})
