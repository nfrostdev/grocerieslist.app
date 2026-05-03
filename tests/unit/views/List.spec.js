import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { nextTick } from 'vue'
import { useListsStore } from '@/stores/lists'
import ListV from '@/views/List.vue'

const listId = 'test01'

const makeItem = (overrides = {}) => ({
  id: 'item1', n: 'Apples', q: 2, c: 0, d: 0, u: 0, ...overrides
})

// Seed via a secondary plugin (runs after pinia installs, before mounted()).
// nextTick is required because mounted() sets this.list, triggering a re-render
// that Vue schedules asynchronously.
const mountList = async (items = [makeItem()]) => {
  const pinia = createPinia()

  const seeder = {
    install () {
      const store = useListsStore(pinia)
      store.$patch({ lists: [{ id: listId, n: 'Groceries', i: items }] })
    }
  }

  const wrapper = mount(ListV, {
    global: {
      plugins: [pinia, seeder],
      mocks: { $route: { params: { id: listId } } },
      stubs: { FontAwesomeIcon: { template: '<span />' } }
    }
  })

  await nextTick()
  const store = useListsStore(pinia)
  return { wrapper, store }
}

describe('List.vue', () => {
  beforeEach(() => localStorage.clear())

  it('renders item name and quantity', async () => {
    const { wrapper } = await mountList()
    expect(wrapper.text()).toContain('Apples')
    expect(wrapper.text()).toContain('2')
  })

  it('shows empty-state when there are no active items', async () => {
    const { wrapper } = await mountList([])
    expect(wrapper.text()).toContain('Add items to this list above')
  })

  it('adds a new item on form submit', async () => {
    const { wrapper, store } = await mountList([])
    await wrapper.find('input#name').setValue('Milk')
    await wrapper.find('input#quantity').setValue('3')
    await wrapper.find('form').trigger('submit')
    expect(store.lists[0].i).toHaveLength(1)
    expect(store.lists[0].i[0].n).toBe('Milk')
  })

  it('toggles an item to checked on checkbox input', async () => {
    const { wrapper, store } = await mountList()
    await wrapper.find('input[type="checkbox"]').trigger('input')
    expect(store.lists[0].i[0].c).toBe(1)
  })

  it('soft-deletes an item on delete button click', async () => {
    const { wrapper, store } = await mountList()
    await wrapper.find('.item__icon--delete').trigger('click')
    expect(store.lists[0].i[0].d).toBe(1)
  })
})
