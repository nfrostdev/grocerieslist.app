import { mount, flushPromises } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { createRouter, createMemoryHistory } from 'vue-router'
import { describe, it, expect, vi } from 'vitest'
import { useListsStore } from '@/stores/lists'
import { useToastStore } from '@/stores/toast'
import New from '@/views/New.vue'

function makeRouter () {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'New', component: { template: '<div/>' } },
      { path: '/list/:id', name: 'List', component: { template: '<div/>' } }
    ]
  })
}

describe('New.vue', () => {
  it('creates a list and navigates on submit', async () => {
    const router = makeRouter()
    const push = vi.spyOn(router, 'push')

    const wrapper = mount(New, {
      global: {
        plugins: [
          createTestingPinia({ stubActions: false, initialState: { lists: { lists: [] } } }),
          router
        ],
        stubs: { RouterLink: { template: '<a><slot /></a>' } }
      }
    })
    await wrapper.find('input#name').setValue('My List')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    const store = useListsStore()
    expect(store.lists).toHaveLength(1)
    expect(store.lists[0].n).toBe('My List')
    expect(push).toHaveBeenCalledWith({
      name: 'List',
      params: { id: store.lists[0].id }
    })
  })

  it('surfaces a toast when navigation rejects', async () => {
    const router = makeRouter()
    vi.spyOn(router, 'push').mockRejectedValueOnce(new Error('boom'))

    const wrapper = mount(New, {
      global: {
        plugins: [
          createTestingPinia({ stubActions: false, initialState: { lists: { lists: [] } } }),
          router
        ],
        stubs: { RouterLink: { template: '<a><slot /></a>' } }
      }
    })
    const toast = useToastStore()
    await wrapper.find('input#name').setValue('My List')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(toast.toasts).toHaveLength(1)
    expect(toast.toasts[0].type).toBe('error')
  })
})
