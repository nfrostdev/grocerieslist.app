import { mount } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createTestingPinia } from '@pinia/testing'
import { useListsStore } from '@/stores/lists'
import Lists from '@/views/Lists.vue'

const stubs = {
  RouterLink: { template: '<a><slot /></a>' },
  FontAwesomeIcon: { template: '<span />' }
}

const mountLists = (lists) => mount(Lists, {
  global: {
    plugins: [createTestingPinia({ initialState: { lists: { lists } } })],
    stubs
  }
})

describe('Lists.vue', () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = vi.fn(function () { this.open = true })
    HTMLDialogElement.prototype.close = vi.fn(function () {
      this.open = false
      this.dispatchEvent(new Event('close'))
    })
  })

  it('shows empty-state message when there are no lists', () => {
    const wrapper = mountLists([])
    expect(wrapper.text()).toContain('You have no lists')
  })

  it('renders one row per list', () => {
    const wrapper = mountLists([{ id: 'a', n: 'Fruit', i: [] }, { id: 'b', n: 'Veg', i: [] }])
    expect(wrapper.text()).toContain('Fruit')
    expect(wrapper.text()).toContain('Veg')
  })

  it('does not show the confirm modal until a delete is requested', () => {
    const wrapper = mountLists([{ id: 'a1', n: 'Fruit', i: [] }])
    expect(wrapper.find('.confirm-modal').exists()).toBe(false)
  })

  it('opens the confirm modal with the list name when delete is clicked', async () => {
    const wrapper = mountLists([{ id: 'a1', n: 'Fruit', i: [] }])
    await wrapper.find('.list__icon--delete').trigger('click')
    const modal = wrapper.find('.confirm-modal')
    expect(modal.exists()).toBe(true)
    expect(modal.text()).toContain('Fruit')
    expect(modal.text()).toContain('Delete list?')
  })

  it('calls deleteList when the modal Delete button is clicked', async () => {
    const wrapper = mountLists([{ id: 'a1', n: 'Fruit', i: [] }])
    const store = useListsStore()
    await wrapper.find('.list__icon--delete').trigger('click')
    await wrapper.findAll('button').find(b => b.text() === 'Delete').trigger('click')
    expect(store.deleteList).toHaveBeenCalledWith('a1')
    expect(wrapper.find('.confirm-modal').exists()).toBe(false)
  })

  it('does not call deleteList when the modal Cancel button is clicked', async () => {
    const wrapper = mountLists([{ id: 'a1', n: 'Fruit', i: [] }])
    const store = useListsStore()
    await wrapper.find('.list__icon--delete').trigger('click')
    await wrapper.findAll('button').find(b => b.text() === 'Cancel').trigger('click')
    expect(store.deleteList).not.toHaveBeenCalled()
    expect(wrapper.find('.confirm-modal').exists()).toBe(false)
  })
})
