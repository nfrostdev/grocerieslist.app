import { setActivePinia, createPinia } from 'pinia'
import { useListsStore } from '@/stores/lists'
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
    expect(JSON.parse(localStorage.getItem('lists'))[0].n).toBe('Groceries')
  })

  it('deleteList removes by id and persists', () => {
    const store = useListsStore()
    const list = new List('A', [])
    store.createList(list)
    store.deleteList(list.id)
    expect(store.lists).toHaveLength(0)
    expect(JSON.parse(localStorage.getItem('lists'))).toHaveLength(0)
  })

  it('updateList replaces the entry and persists', () => {
    const store = useListsStore()
    const list = new List('Old', [])
    store.createList(list)
    list.n = 'New'
    store.updateList(list)
    expect(store.lists[0].n).toBe('New')
    expect(JSON.parse(localStorage.getItem('lists'))[0].n).toBe('New')
  })

  it('updateList sorts items alphabetically by name', () => {
    const store = useListsStore()
    const b = new Item('Bananas', 1)
    const a = new Item('Apples', 2)
    const list = new List('Fruit', [b, a])
    store.createList(list)
    store.updateList(store.lists[0])
    expect(store.lists[0].i[0].n).toBe('Apples')
    expect(store.lists[0].i[1].n).toBe('Bananas')
  })

  it('updateList sorts case-insensitively', () => {
    const store = useListsStore()
    const b = new Item('banana', 1)
    const a = new Item('Apple', 2)
    const list = new List('Fruit', [b, a])
    store.createList(list)
    store.updateList(store.lists[0])
    expect(store.lists[0].i[0].n).toBe('Apple')
    expect(store.lists[0].i[1].n).toBe('banana')
  })

  it('getListFromId returns the matching list', () => {
    const store = useListsStore()
    const list = new List('A', [])
    store.createList(list)
    expect(store.getListFromId(list.id).n).toBe('A')
  })

  it('getListFromId returns undefined for unknown id', () => {
    const store = useListsStore()
    expect(store.getListFromId('unknown')).toBeUndefined()
  })
})
