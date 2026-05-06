import { ref } from 'vue'
import { defineStore } from 'pinia'
import type List from '@/classes/List'

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

  function createList (list: List) {
    lists.value.push(list)
    persist()
  }

  function updateList (list: List) {
    list.i.sort((a, b) => a.n.localeCompare(b.n, undefined, { sensitivity: 'base' }))
    const i = lists.value.findIndex(l => l.id === list.id)
    lists.value[i] = list
    persist()
  }

  function deleteList (id: string) {
    lists.value.splice(lists.value.findIndex(l => l.id === id), 1)
    persist()
  }

  return { lists, getListFromId, init, createList, updateList, deleteList }
})
