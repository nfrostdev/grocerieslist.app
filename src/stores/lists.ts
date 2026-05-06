import { ref } from 'vue'
import { defineStore } from 'pinia'
import type List from '@/classes/List'
import type Item from '@/classes/Item'

export const useListsStore = defineStore('lists', () => {
  const lists = ref<List[]>([])

  function getListFromId (id: string) {
    return lists.value.find(l => l.id === id)
  }

  function persist () {
    localStorage.setItem('lists', JSON.stringify(lists.value))
  }

  function init () {
    const raw = localStorage.getItem('lists')
    if (raw) lists.value = JSON.parse(raw)
  }

  function writeList (listId: string, mutator: (list: List) => void) {
    const list = lists.value.find(l => l.id === listId)
    if (!list) return
    mutator(list)
    list.i.sort((a, b) => a.n.localeCompare(b.n, undefined, { sensitivity: 'base' }))
    persist()
  }

  function createList (list: List) {
    lists.value.push(list)
    persist()
  }

  function deleteList (id: string) {
    lists.value.splice(lists.value.findIndex(l => l.id === id), 1)
    persist()
  }

  function addItem (listId: string, item: Item) {
    writeList(listId, l => { l.i.push(item) })
  }

  function updateItem (listId: string, itemId: string, patch: Partial<Item>) {
    writeList(listId, l => {
      const item = l.i.find(i => i.id === itemId)
      if (!item) return
      Object.assign(item, patch, { u: Date.now() })
    })
  }

  function softDeleteItem (listId: string, itemId: string) {
    updateItem(listId, itemId, { d: 1 })
  }

  return {
    lists,
    getListFromId,
    init,
    createList,
    deleteList,
    addItem,
    updateItem,
    softDeleteItem
  }
})
