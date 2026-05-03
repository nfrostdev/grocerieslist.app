import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { useListsStore } from '@/stores/lists'
import Lists from '@/views/Lists.vue'

const stubs = {
  RouterLink: { template: '<a><slot /></a>' },
  FontAwesomeIcon: { template: '<span />' }
}

describe('Lists.vue', () => {
  it('shows empty-state message when there are no lists', () => {
    const wrapper = mount(Lists, {
      global: {
        plugins: [createTestingPinia({ initialState: { lists: { lists: [] } } })],
        stubs
      }
    })
    expect(wrapper.text()).toContain('You have no lists')
  })

  it('renders one row per list', () => {
    const wrapper = mount(Lists, {
      global: {
        plugins: [createTestingPinia({
          initialState: {
            lists: { lists: [{ id: 'a', n: 'Fruit', i: [] }, { id: 'b', n: 'Veg', i: [] }] }
          }
        })],
        stubs
      }
    })
    expect(wrapper.text()).toContain('Fruit')
    expect(wrapper.text()).toContain('Veg')
  })

  it('calls deleteList when confirm is accepted', async () => {
    vi.stubGlobal('confirm', () => true)
    const wrapper = mount(Lists, {
      global: {
        plugins: [createTestingPinia({
          initialState: { lists: { lists: [{ id: 'a1', n: 'Fruit', i: [] }] } }
        })],
        stubs
      }
    })
    const store = useListsStore()
    await wrapper.find('button').trigger('click')
    expect(store.deleteList).toHaveBeenCalledWith('a1')
    vi.unstubAllGlobals()
  })

  it('does not call deleteList when confirm is cancelled', async () => {
    vi.stubGlobal('confirm', () => false)
    const wrapper = mount(Lists, {
      global: {
        plugins: [createTestingPinia({
          initialState: { lists: { lists: [{ id: 'a1', n: 'Fruit', i: [] }] } }
        })],
        stubs
      }
    })
    const store = useListsStore()
    await wrapper.find('button').trigger('click')
    expect(store.deleteList).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
