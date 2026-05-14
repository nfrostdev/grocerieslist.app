import { setActivePinia, createPinia } from 'pinia'
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useListsStore } from '@/stores/lists'
import { useToastStore } from '@/stores/toast'
import List from '@/classes/List'
import Item from '@/classes/Item'

describe('lists store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('starts with empty lists', () => {
    const store = useListsStore()
    expect(store.lists).toEqual([])
  })

  it('init loads lists from localStorage', () => {
    const saved = [{ id: 'a', n: 'Test', i: [] }]
    localStorage.setItem('lists', JSON.stringify(saved))
    const store = useListsStore()
    store.init()
    expect(store.lists).toEqual(saved)
  })

  it('init is a no-op when localStorage is empty', () => {
    const store = useListsStore()
    store.init()
    expect(store.lists).toEqual([])
  })

  it('createList appends a list and persists', () => {
    const store = useListsStore()
    store.createList(new List('Groceries', []))
    expect(store.lists).toHaveLength(1)
    expect(store.lists[0].n).toBe('Groceries')
    expect(JSON.parse(localStorage.getItem('lists') ?? '[]')[0].n).toBe('Groceries')
  })

  it('deleteList removes by id and persists', () => {
    const store = useListsStore()
    const list = new List('A', [])
    store.createList(list)
    store.deleteList(list.id)
    expect(store.lists).toHaveLength(0)
    expect(JSON.parse(localStorage.getItem('lists') ?? '[]')).toHaveLength(0)
  })

  it('addItem sorts items alphabetically by name', () => {
    const store = useListsStore()
    const list = new List('Fruit', [])
    store.createList(list)
    store.addItem(list.id, new Item('Bananas', '1'))
    store.addItem(list.id, new Item('Apples', '2'))
    expect(store.lists[0].i[0].n).toBe('Apples')
    expect(store.lists[0].i[1].n).toBe('Bananas')
  })

  it('addItem sorts case-insensitively', () => {
    const store = useListsStore()
    const list = new List('Fruit', [])
    store.createList(list)
    store.addItem(list.id, new Item('banana', '1'))
    store.addItem(list.id, new Item('Apple', '2'))
    expect(store.lists[0].i[0].n).toBe('Apple')
    expect(store.lists[0].i[1].n).toBe('banana')
  })

  it('getListFromId returns the matching list', () => {
    const store = useListsStore()
    const list = new List('A', [])
    store.createList(list)
    expect(store.getListFromId(list.id)!.n).toBe('A')
  })

  it('getListFromId returns undefined for unknown id', () => {
    const store = useListsStore()
    expect(store.getListFromId('unknown')).toBeUndefined()
  })

  describe('persist error handling', () => {
    afterEach(() => vi.restoreAllMocks())

    it('emits an error toast and keeps in-memory state when persist throws', () => {
      const store = useListsStore()
      const list = new List('Quota', [])
      store.createList(list)
      const toast = useToastStore()

      vi.spyOn(console, 'warn').mockImplementation(() => {})
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('QuotaExceededError', 'QuotaExceededError')
      })

      store.addItem(list.id, new Item('Milk', '1'))

      expect(store.lists[0].i).toHaveLength(1)
      expect(toast.toasts).toHaveLength(1)
      expect(toast.toasts[0].type).toBe('error')

      store.addItem(list.id, new Item('Eggs', '1'))
      expect(toast.toasts).toHaveLength(1)
    })
  })

  describe('replaceList', () => {
    it('adds a new list when id does not exist', () => {
      const store = useListsStore()
      const incoming = { id: 'abc', n: 'Costco', i: [{ id: 'i1', n: 'Eggs', q: '1', c: 0, u: 1, d: 0 }] }
      store.replaceList(incoming)
      expect(store.lists).toHaveLength(1)
      expect(store.lists[0].id).toBe('abc')
    })

    it('replaces existing list wholesale when id matches', () => {
      const store = useListsStore()
      store.createList({ id: 'abc', n: 'Old', i: [{ id: 'i1', n: 'Stale', q: '1', c: 0, u: 1, d: 0 }] })
      const incoming = { id: 'abc', n: 'New', i: [{ id: 'i2', n: 'Fresh', q: '1', c: 0, u: 2, d: 0 }] }
      store.replaceList(incoming)
      expect(store.lists).toHaveLength(1)
      expect(store.lists[0].n).toBe('New')
      expect(store.lists[0].i).toHaveLength(1)
      expect(store.lists[0].i[0].id).toBe('i2')
    })

    it('sorts items after replace', () => {
      const store = useListsStore()
      const incoming = {
        id: 'abc',
        n: 'L',
        i: [
          { id: 'i1', n: 'Bananas', q: '1', c: 0, u: 1, d: 0 },
          { id: 'i2', n: 'Apples', q: '1', c: 0, u: 1, d: 0 }
        ]
      }
      store.replaceList(incoming)
      expect(store.lists[0].i[0].n).toBe('Apples')
    })
  })

  describe('mergeList', () => {
    it('falls back to replaceList when id is unknown', () => {
      const store = useListsStore()
      const incoming = { id: 'abc', n: 'Costco', i: [{ id: 'i1', n: 'Eggs', q: '1', c: 0, u: 1, d: 0 }] }
      store.mergeList(incoming)
      expect(store.lists).toHaveLength(1)
      expect(store.lists[0].id).toBe('abc')
    })

    it('adds incoming items not present locally', () => {
      const store = useListsStore()
      store.createList({ id: 'abc', n: 'L', i: [{ id: 'a', n: 'Apples', q: '1', c: 0, u: 1, d: 0 }] })
      store.mergeList({ id: 'abc', n: 'L', i: [{ id: 'b', n: 'Bananas', q: '1', c: 0, u: 2, d: 0 }] })
      expect(store.lists[0].i).toHaveLength(2)
    })

    it('takes incoming item when its timestamp is newer', () => {
      const store = useListsStore()
      store.createList({ id: 'abc', n: 'L', i: [{ id: 'a', n: 'Apples', q: '1', c: 0, u: 100, d: 0 }] })
      store.mergeList({ id: 'abc', n: 'L', i: [{ id: 'a', n: 'Apples', q: '99', c: 0, u: 200, d: 0 }] })
      expect(store.lists[0].i[0].q).toBe('99')
    })

    it('keeps local item when its timestamp is newer', () => {
      const store = useListsStore()
      store.createList({ id: 'abc', n: 'L', i: [{ id: 'a', n: 'Apples', q: '99', c: 0, u: 200, d: 0 }] })
      store.mergeList({ id: 'abc', n: 'L', i: [{ id: 'a', n: 'Apples', q: '1', c: 0, u: 100, d: 0 }] })
      expect(store.lists[0].i[0].q).toBe('99')
    })

    it('leaves locally-tombstoned items alone when not in incoming', () => {
      const store = useListsStore()
      store.createList({ id: 'abc', n: 'L', i: [{ id: 'a', n: 'Apples', q: '1', c: 0, u: 1, d: 1 }] })
      store.mergeList({ id: 'abc', n: 'L', i: [] })
      expect(store.lists[0].i).toHaveLength(1)
      expect(store.lists[0].i[0].d).toBe(1)
    })
  })
})
