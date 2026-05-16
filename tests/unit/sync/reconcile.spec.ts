import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useListsStore } from '@/stores/lists'
import { applyPollPayload, applyJoinPayload } from '@/sync/reconcile'

const ITEM = { id: 'i1', n: 'Milk', q: '1', c: 0, u: 100, d: 0 }

describe('sync/reconcile', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  describe('applyPollPayload', () => {
    it('does nothing when list is not in the store', () => {
      expect(() => applyPollPayload('nonexistent', { cursor: 1, items: [] })).not.toThrow()
    })

    it('merges server items into the local list', () => {
      const store = useListsStore()
      store.$patch({ lists: [{ id: 'abc', n: 'Groceries', i: [] }] })
      applyPollPayload('abc', { cursor: 2, items: [ITEM] })
      expect(store.lists[0].i).toHaveLength(1)
      expect(store.lists[0].i[0].n).toBe('Milk')
    })

    it('preserves the local name across a poll', () => {
      const store = useListsStore()
      store.$patch({ lists: [{ id: 'abc', n: 'My List', i: [] }] })
      applyPollPayload('abc', { cursor: 1, items: [] })
      expect(store.lists[0].n).toBe('My List')
    })
  })

  describe('applyJoinPayload', () => {
    it('inserts the incoming list when absent', () => {
      const store = useListsStore()
      applyJoinPayload({ listId: 's1', role: 'editor', name: 'Shared', cursor: 5, items: [ITEM] })
      expect(store.lists).toHaveLength(1)
      expect(store.lists[0].n).toBe('Shared')
      expect(store.lists[0].i[0].n).toBe('Milk')
    })

    it('replaces an existing list with the same id', () => {
      const store = useListsStore()
      store.$patch({ lists: [{ id: 's1', n: 'Old', i: [] }] })
      applyJoinPayload({ listId: 's1', role: 'editor', name: 'Updated', cursor: 2, items: [] })
      expect(store.lists).toHaveLength(1)
      expect(store.lists[0].n).toBe('Updated')
    })
  })
})
