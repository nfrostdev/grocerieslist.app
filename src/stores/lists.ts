import { defineStore } from 'pinia'
import type List from '@/classes/List'

export const useListsStore = defineStore('lists', {
  state: () => ({ lists: [] as List[] }),
  getters: {
    getListFromId: (state) => (id: string) => state.lists.find(list => list.id === id)
  },
  actions: {
    init () {
      const raw = localStorage.getItem('lists')
      if (raw) this.lists = JSON.parse(raw)
    },
    createList (list: List) {
      this.lists.push(list)
      this.persist()
    },
    updateList (list: List) {
      list.i.sort((a, b) => a.n > b.n ? 1 : -1)
      const i = this.lists.findIndex(l => l.id === list.id)
      this.lists[i] = list
      this.persist()
    },
    deleteList (id: string) {
      this.lists.splice(this.lists.findIndex(l => l.id === id), 1)
      this.persist()
    },
    persist () {
      localStorage.setItem('lists', JSON.stringify(this.lists))
    }
  }
})
