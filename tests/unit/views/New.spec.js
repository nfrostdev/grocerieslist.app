import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { createRouter, createMemoryHistory } from 'vue-router'
import { useListsStore } from '@/stores/lists'
import New from '@/views/New.vue'

describe('New.vue', () => {
  it('creates a list and navigates on submit', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', name: 'New', component: { template: '<div/>' } },
        { path: '/list/:id', name: 'List', component: { template: '<div/>' } }
      ]
    })
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
    const store = useListsStore()
    expect(store.lists).toHaveLength(1)
    expect(store.lists[0].n).toBe('My List')
    expect(push).toHaveBeenCalledWith({
      name: 'List',
      params: { id: store.lists[0].id }
    })
  })
})
