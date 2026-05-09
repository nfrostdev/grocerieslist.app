import { ref } from 'vue'
import { defineStore } from 'pinia'
import { v4 as uuidv4 } from 'uuid'
import type List from '@/classes/List'
import type Item from '@/classes/Item'

function sortItems (list: List) {
  list.i.sort((a, b) => a.n.localeCompare(b.n, undefined, { sensitivity: 'base' }))
}

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
    sortItems(list)
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

  function replaceList (incoming: List) {
    sortItems(incoming)
    const idx = lists.value.findIndex(l => l.id === incoming.id)
    if (idx === -1) lists.value.push(incoming)
    else lists.value[idx] = incoming
    persist()
  }

  function mergeList (incoming: List) {
    const existing = lists.value.find(l => l.id === incoming.id)
    if (!existing) {
      replaceList(incoming)
      return
    }
    for (const inItem of incoming.i) {
      const localIdx = existing.i.findIndex(it => it.id === inItem.id)
      if (localIdx === -1) {
        existing.i.push(inItem)
      } else if (inItem.u > existing.i[localIdx].u || inItem.d) {
        existing.i[localIdx] = inItem
      }
    }
    sortItems(existing)
    persist()
  }

  function updateListId (oldId: string, newId: string) {
    const list = lists.value.find(l => l.id === oldId)
    if (!list) return
    list.id = newId
    persist()
  }

  function importAsCopy (incoming: List) {
    const copy: List = {
      id: uuidv4().substring(0, 8),
      n: incoming.n,
      i: incoming.i
    }
    sortItems(copy)
    lists.value.push(copy)
    persist()
    return copy.id
  }

  return {
    lists,
    getListFromId,
    init,
    createList,
    deleteList,
    addItem,
    updateItem,
    softDeleteItem,
    replaceList,
    mergeList,
    updateListId,
    importAsCopy
  }
})
