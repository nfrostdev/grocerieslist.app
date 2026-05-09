import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { nextTick } from 'vue'
import { createRouter, createMemoryHistory } from 'vue-router'
import { useListsStore } from '@/stores/lists'
import ListV from '@/views/List.vue'

const listId = 'test01'

const makeItem = (overrides = {}) => ({
  id: 'item1', n: 'Apples', q: 2, c: 0, d: 0, u: 0, ...overrides
})

const routes = [
  { path: '/list/:id', name: 'List', component: { template: '<div/>' } },
  { path: '/lists', name: 'Lists', component: { template: '<div/>' } }
]

const mountList = async (items = [makeItem()]) => {
  const pinia = createPinia()

  const seeder = {
    install () {
      const store = useListsStore(pinia)
      store.$patch({ lists: [{ id: listId, n: 'Groceries', i: items }] })
    }
  }

  const router = createRouter({ history: createMemoryHistory(), routes })
  await router.push({ name: 'List', params: { id: listId } })

  const wrapper = mount(ListV, {
    global: {
      plugins: [pinia, seeder, router],
      stubs: { FontAwesomeIcon: { template: '<span />' } }
    }
  })

  await nextTick()
  const store = useListsStore(pinia)
  return { wrapper, store, router }
}

// Mounts with a controllable ShareSheet stub so we can drive its events.
const mountListWithSheet = async () => {
  const pinia = createPinia()
  const seeder = {
    install () {
      useListsStore(pinia).$patch({ lists: [{ id: 'local01', n: 'Groceries', i: [] }] })
    }
  }
  const router = createRouter({ history: createMemoryHistory(), routes })
  await router.push({ name: 'List', params: { id: 'local01' } })

  let sheetEmit = null
  const ShareSheetStub = {
    props: ['open', 'list'],
    emits: ['update:open', 'provisioned', 'deleted'],
    setup (_, { emit }) { sheetEmit = emit; return () => null }
  }

  const wrapper = mount(ListV, {
    global: {
      plugins: [pinia, seeder, router],
      stubs: { FontAwesomeIcon: { template: '<span/>' }, ShareSheet: ShareSheetStub }
    }
  })
  await nextTick()
  const store = useListsStore(pinia)
  return { wrapper, store, router, sheetEmit: () => sheetEmit }
}

describe('List.vue', () => {
  beforeEach(() => localStorage.clear())

  it('renders a single root node (fragment would break Transition mode=out-in)', async () => {
    const { wrapper } = await mountList()
    // Fragment components place multiple sibling nodes in the VTU host container.
    // A fragment here causes <Transition mode="out-in"> to lose the transitionend
    // signal in real browsers, so the next route never enters.
    expect(wrapper.element.parentElement.childNodes.length).toBe(1)
  })

  it('renders item name and quantity', async () => {
    const { wrapper } = await mountList()
    expect(wrapper.find('.item__name').element.value).toBe('Apples')
    expect(wrapper.find('.item__quantity__input').element.value).toBe('2')
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

  it('updates item name via input change event', async () => {
    const { wrapper, store } = await mountList()
    const nameInput = wrapper.find('.item__name')
    await nameInput.setValue('Oranges')
    await nameInput.trigger('change')
    expect(store.lists[0].i[0].n).toBe('Oranges')
  })

  it('updates item quantity via input change event', async () => {
    const { wrapper, store } = await mountList()
    const qtyInput = wrapper.find('.item__quantity__input')
    await qtyInput.setValue('5')
    await qtyInput.trigger('change')
    expect(store.lists[0].i[0].q).toBe('5')
  })

  it('shows the all-checked banner when every active item is checked', async () => {
    const { wrapper } = await mountList([makeItem({ c: 1 })])
    expect(wrapper.text()).toContain('checked off all your items')
  })

  describe('navigation guard', () => {
    it('does NOT navigate to Lists when the share button is clicked', async () => {
      const { wrapper, router } = await mountListWithSheet()
      await wrapper.find('.list-header__share').trigger('click')
      await nextTick()
      expect(router.currentRoute.value.name).toBe('List')
    })

    it('does NOT navigate to Lists when the share sheet closes after provision', async () => {
      const { wrapper, store, router, sheetEmit } = await mountListWithSheet()

      // Open share sheet
      await wrapper.find('.list-header__share').trigger('click')
      await nextTick()

      // Simulate provision: list ID renamed in store (as sync.provision does)
      store.updateListId('local01', 'SERVER01')
      await nextTick()

      // Simulate ShareSheet emitting provisioned then closing (as onClose does)
      sheetEmit()('provisioned', 'SERVER01')
      sheetEmit()('update:open', false)
      await flushPromises()

      expect(router.currentRoute.value.name).toBe('List')
      expect(router.currentRoute.value.params.id).toBe('SERVER01')
    })

    it('navigates to Lists when the list disappears without a provision (access revoked)', async () => {
      const { store, router } = await mountList([])
      store.$patch({ lists: [] })
      await flushPromises()
      expect(router.currentRoute.value.name).toBe('Lists')
    })
  })
})
