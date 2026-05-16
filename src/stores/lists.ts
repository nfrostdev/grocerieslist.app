import { ref } from 'vue'
import { defineStore } from 'pinia'
import type List from '@/classes/List'
import type Item from '@/classes/Item'
import { getMeta } from '@/sync/storage'
import { enqueue } from '@/sync/queue'
import { useToastStore } from '@/stores/toast'

function sortItems (list: List) {
  list.i.sort((a, b) => a.n.localeCompare(b.n, undefined, { sensitivity: 'base' }))
}

export const useListsStore = defineStore('lists', () => {
  const lists = ref<List[]>([])
  let lastPersistFailed = false

  function getListFromId (id: string) {
    return lists.value.find(l => l.id === id)
  }

  function persist (): boolean {
    try {
      localStorage.setItem('lists', JSON.stringify(lists.value))
      lastPersistFailed = false
      return true
    } catch (err) {
      console.warn('[lists] failed to persist', err)
      if (!lastPersistFailed) {
        useToastStore().add('Could not save changes — your device may be out of storage.', 'error')
        lastPersistFailed = true
      }
      return false
    }
  }

  function quarantineCorruptedLists (raw: string, reason: unknown): void {
    const backupKey = `lists.corrupted.${Date.now()}`
    console.warn('[lists] corrupted lists key — preserving to', backupKey, reason)
    try {
      localStorage.setItem(backupKey, raw)
      localStorage.removeItem('lists')
    } catch {
      // Quota or storage gone — continue with empty state regardless.
    }
  }

  function init () {
    const raw = localStorage.getItem('lists')
    if (raw === null) return
    try {
      const parsed = JSON.parse(raw) as unknown
      if (!Array.isArray(parsed)) {
        quarantineCorruptedLists(raw, 'unexpected shape')
        return
      }
      lists.value = parsed as List[]
    } catch (err) {
      quarantineCorruptedLists(raw, err)
    }
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
    return list
  }

  function deleteList (id: string) {
    const idx = lists.value.findIndex(l => l.id === id)
    if (idx === -1) return
    lists.value.splice(idx, 1)
    persist()
  }

  function addItem (listId: string, item: Item) {
    writeList(listId, l => { l.i.push(item) })
    if (getMeta(listId)) {
      enqueue({ kind: 'upsertItem', listId, item: { id: item.id, n: item.n, q: item.q, c: item.c, u: item.u, d: item.d } })
    }
  }

  function updateItem (listId: string, itemId: string, patch: Partial<Item>) {
    let updated: Item | undefined
    writeList(listId, l => {
      updated = l.i.find(i => i.id === itemId)
      if (!updated) return
      Object.assign(updated, patch, { u: Date.now() })
    })
    if (updated && getMeta(listId)) {
      enqueue({ kind: 'upsertItem', listId, item: { id: updated.id, n: updated.n, q: updated.q, c: updated.c, u: updated.u, d: updated.d } })
    }
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
    // LWW with strict `>`: on equal `u`, the local row wins.
    // Server-side upsert uses the same rule (existing wins on equal `u`), so
    // both sides stay consistent and an item written at the exact same
    // millisecond by two clients converges to whichever the server saw first.
    for (const inItem of incoming.i) {
      const localIdx = existing.i.findIndex(it => it.id === inItem.id)
      if (localIdx === -1) {
        existing.i.push(inItem)
      } else if (inItem.u > existing.i[localIdx].u) {
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
    updateListId
  }
})
