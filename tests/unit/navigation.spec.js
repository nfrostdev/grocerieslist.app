import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import App from '@/App.vue'
import ListsView from '@/views/Lists.vue'
import ListView from '@/views/List.vue'
import { useListsStore } from '@/stores/lists'
import List from '@/classes/List'

vi.mock('@/sync', () => ({
  startPolling: vi.fn(),
  getMeta: vi.fn(() => null),
  isSynced: vi.fn(() => false),
  provision: vi.fn(),
  join: vi.fn(() => Promise.resolve(false)),
  getSyncMetaMap: vi.fn(() => ({})),
  saveSyncMetaMap: vi.fn()
}))

const makeRouter = () => createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', name: 'Lists', component: ListsView },
    { path: '/new', name: 'New', component: { template: '<div/>' } },
    { path: '/:id', name: 'List', component: ListView }
  ]
})

describe('navigation: List → Lists', () => {
  beforeEach(() => {
    localStorage.clear()
    HTMLDialogElement.prototype.showModal = vi.fn(function () { this.open = true })
    HTMLDialogElement.prototype.close = vi.fn(function () {
      this.open = false
      this.dispatchEvent(new Event('close'))
    })
  })

  it('List.vue does not produce a multi-root warning inside <Transition>', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const pinia = createPinia()
    const router = makeRouter()
    await router.push('/')

    mount(App, {
      global: {
        plugins: [pinia, router],
        stubs: { FontAwesomeIcon: { template: '<span/>' } }
      },
      attachTo: document.body
    })
    await flushPromises()

    const store = useListsStore(pinia)
    store.createList(new List('Groceries', []))
    const listId = store.lists.at(-1).id

    await router.push({ name: 'List', params: { id: listId } })
    await flushPromises()

    expect(warnSpy).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('list remains visible on Lists page after adding an item and navigating back', async () => {
    const pinia = createPinia()
    const router = makeRouter()
    await router.push('/')

    const wrapper = mount(App, {
      global: {
        plugins: [pinia, router],
        stubs: { FontAwesomeIcon: { template: '<span/>' } }
      },
      attachTo: document.body
    })
    await flushPromises()

    const store = useListsStore(pinia)
    store.createList(new List('Groceries', []))
    const listId = store.lists.at(-1).id

    await router.push({ name: 'List', params: { id: listId } })
    await flushPromises()

    await wrapper.find('input#name').setValue('Milk')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(store.lists[0].i).toHaveLength(1)

    await router.push({ name: 'Lists' })
    await flushPromises()

    expect(store.lists).toHaveLength(1)
    expect(wrapper.find('.lists').exists()).toBe(true)
    expect(wrapper.text()).toContain('Groceries')
  })
})
