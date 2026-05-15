import { mount } from '@vue/test-utils'
import { describe, it, expect, vi } from 'vitest'
import ListItem from '@/components/ListItem.vue'

const makeItem = (overrides = {}) => ({
  id: 'item1', n: 'Apples', q: '2', c: 0, d: 0, u: 0, ...overrides
})

const mountItem = (props = {}) => mount(ListItem, {
  props: { item: makeItem(), checked: false, nameRef: () => {}, ...props },
  global: { stubs: { FontAwesomeIcon: { template: '<span/>' } } }
})

describe('ListItem.vue', () => {
  it('renders the item name and quantity', () => {
    const wrapper = mountItem()
    expect((wrapper.find('.item__name').element as HTMLInputElement).value).toBe('Apples')
    expect((wrapper.find('.item__quantity__input').element as HTMLInputElement).value).toBe('2')
  })

  it('emits toggle when the checkbox is clicked', async () => {
    const wrapper = mountItem()
    await wrapper.find('input[type="checkbox"]').trigger('input')
    expect(wrapper.emitted('toggle')).toHaveLength(1)
  })

  it('emits delete when the delete button is clicked', async () => {
    const wrapper = mountItem()
    await wrapper.find('.item__icon--delete').trigger('click')
    expect(wrapper.emitted('delete')).toHaveLength(1)
  })

  it('emits update:name with the input element on change', async () => {
    const wrapper = mountItem()
    await wrapper.find('.item__name').setValue('Oranges')
    const emitted = wrapper.emitted('update:name') as unknown[][]
    expect(emitted).toHaveLength(1)
    const [input] = emitted[0] as [HTMLInputElement]
    expect(input).toBeInstanceOf(HTMLInputElement)
    expect(input.value).toBe('Oranges')
  })

  it('emits update:quantity with the input element on change', async () => {
    const wrapper = mountItem()
    await wrapper.find('.item__quantity__input').setValue('5')
    const emitted = wrapper.emitted('update:quantity') as unknown[][]
    expect(emitted).toHaveLength(1)
    const [input] = emitted[0] as [HTMLInputElement]
    expect(input).toBeInstanceOf(HTMLInputElement)
    expect(input.value).toBe('5')
  })

  it('applies the checkbox-icon--checked class when checked is true', () => {
    const wrapper = mountItem({ checked: true })
    expect(wrapper.html()).toContain('item__checkbox__icon--checked')
  })

  it('invokes the nameRef callback with the input element', () => {
    const calls: unknown[] = []
    const nameRef = vi.fn((el: unknown) => calls.push(el))
    mountItem({ nameRef })
    expect(nameRef).toHaveBeenCalled()
    const received = calls.find(c => c instanceof HTMLInputElement) as HTMLInputElement
    expect(received).toBeTruthy()
    expect(received.classList.contains('item__name')).toBe(true)
  })
})
