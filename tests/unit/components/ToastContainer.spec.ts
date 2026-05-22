import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ToastContainer from '@/components/ToastContainer.vue'
import { useToastStore } from '@/stores/toast'

describe('ToastContainer', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    // jsdom has no native <dialog>.show/close — emulate enough for assertions.
    HTMLDialogElement.prototype.show = vi.fn(function (this: HTMLDialogElement) {
      this.open = true
    })
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.open = false
      this.dispatchEvent(new Event('close'))
    })
  })

  it('renders a <dialog> as the toast container (top-layer promotion)', () => {
    const wrapper = mount(ToastContainer, {
      global: { stubs: { FontAwesomeIcon: { template: '<span/>' } } }
    })
    expect(wrapper.element.tagName).toBe('DIALOG')
  })

  it('opens the dialog with .show() (non-modal) when a toast is added', async () => {
    const wrapper = mount(ToastContainer, {
      attachTo: document.body,
      global: { stubs: { FontAwesomeIcon: { template: '<span/>' } } }
    })
    const showSpy = HTMLDialogElement.prototype.show as ReturnType<typeof vi.fn>
    expect(showSpy).not.toHaveBeenCalled()

    useToastStore().add('hello', 'info')
    await flushPromises()

    expect(showSpy).toHaveBeenCalledTimes(1)
    expect((wrapper.element as HTMLDialogElement).open).toBe(true)
    wrapper.unmount()
  })

  it('re-opens the dialog on each new toast so it stays on top of the top-layer stack', async () => {
    const wrapper = mount(ToastContainer, {
      attachTo: document.body,
      global: { stubs: { FontAwesomeIcon: { template: '<span/>' } } }
    })
    const showSpy = HTMLDialogElement.prototype.show as ReturnType<typeof vi.fn>
    const closeSpy = HTMLDialogElement.prototype.close as ReturnType<typeof vi.fn>

    const store = useToastStore()
    store.add('first', 'info')
    await flushPromises()
    store.add('second', 'error')
    await flushPromises()

    expect(showSpy).toHaveBeenCalledTimes(2)
    // The second add closed then re-showed; first add only show()-ed.
    expect(closeSpy).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('closes the dialog when the last toast is dismissed', async () => {
    const wrapper = mount(ToastContainer, {
      attachTo: document.body,
      global: { stubs: { FontAwesomeIcon: { template: '<span/>' } } }
    })
    const closeSpy = HTMLDialogElement.prototype.close as ReturnType<typeof vi.fn>

    const store = useToastStore()
    store.add('hello', 'info')
    await flushPromises()
    closeSpy.mockClear()

    store.dismiss(store.toasts[0].id)
    await flushPromises()

    expect(closeSpy).toHaveBeenCalled()
    expect((wrapper.element as HTMLDialogElement).open).toBe(false)
    wrapper.unmount()
  })
})
