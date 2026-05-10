import { mount } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createTestingPinia } from '@pinia/testing'
import { useListsStore } from '@/stores/lists'
import Lists from '@/views/Lists.vue'
import type List from '@/classes/List'

import * as sync from '@/sync'

vi.mock('@/sync', () => ({
  getMeta: vi.fn(),
  deleteList: vi.fn(),
  leaveList: vi.fn()
}))

const stubs = {
  RouterLink: { template: '<a><slot /></a>' },
  FontAwesomeIcon: { template: '<span />' }
}

const mountLists = (lists: List[]) => mount(Lists, {
  global: {
    plugins: [createTestingPinia({ initialState: { lists: { lists } } })],
    stubs
  }
})

describe('Lists.vue', () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) { this.open = true })
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.open = false
      this.dispatchEvent(new Event('close'))
    })
    vi.mocked(sync.getMeta).mockReturnValue(null)
    vi.mocked(sync.deleteList).mockResolvedValue(true)
    vi.resetAllMocks()
    vi.mocked(sync.getMeta).mockReturnValue(null)
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

  it('calls store.deleteList for unsynced lists', async () => {
    const wrapper = mountLists([{ id: 'a1', n: 'Fruit', i: [] }])
    const store = useListsStore()
    await wrapper.find('.list__icon--delete').trigger('click')
    await wrapper.findAll('button').find(b => b.text() === 'Delete')!.trigger('click')
    await wrapper.vm.$nextTick()
    expect(store.deleteList).toHaveBeenCalledWith('a1')
    expect(wrapper.find('.confirm-modal').exists()).toBe(false)
  })

  it('calls sync.deleteList for owner synced lists', async () => {
    vi.mocked(sync.getMeta).mockReturnValue({ role: 'owner', authToken: 'tok', lastCursor: 1 })
    vi.mocked(sync.deleteList).mockResolvedValue(true)
    const wrapper = mountLists([{ id: 'srv1', n: 'Shared', i: [] }])
    const store = useListsStore()
    await wrapper.find('.list__icon--delete').trigger('click')
    await wrapper.findAll('button').find(b => b.text() === 'Delete')!.trigger('click')
    await wrapper.vm.$nextTick()
    expect(sync.deleteList).toHaveBeenCalledWith('srv1')
    expect(store.deleteList).not.toHaveBeenCalled()
    expect(wrapper.find('.confirm-modal').exists()).toBe(false)
  })

  it('calls sync.leaveList for editor synced lists', async () => {
    vi.mocked(sync.getMeta).mockReturnValue({ role: 'editor', authToken: 'tok', lastCursor: 1 })
    const wrapper = mountLists([{ id: 'srv2', n: 'Joined', i: [] }])
    const store = useListsStore()
    await wrapper.find('.list__icon--delete').trigger('click')
    await wrapper.findAll('button').find(b => b.text() === 'Delete')!.trigger('click')
    await wrapper.vm.$nextTick()
    expect(sync.leaveList).toHaveBeenCalledWith('srv2')
    expect(store.deleteList).not.toHaveBeenCalled()
    expect(wrapper.find('.confirm-modal').exists()).toBe(false)
  })

  it('does not call deleteList when the modal Cancel button is clicked', async () => {
    const wrapper = mountLists([{ id: 'a1', n: 'Fruit', i: [] }])
    const store = useListsStore()
    await wrapper.find('.list__icon--delete').trigger('click')
    await wrapper.findAll('button').find(b => b.text() === 'Cancel')!.trigger('click')
    expect(store.deleteList).not.toHaveBeenCalled()
    expect(wrapper.find('.confirm-modal').exists()).toBe(false)
  })
})
