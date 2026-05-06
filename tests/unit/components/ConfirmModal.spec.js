import { mount } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ConfirmModal from '@/components/ConfirmModal.vue'

const baseProps = {
  open: false,
  title: 'Delete list?',
  message: 'Are you sure you want to delete your Costco list?'
}

const mountModal = (props = {}) => mount(ConfirmModal, {
  props: { ...baseProps, ...props }
})

describe('ConfirmModal', () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = vi.fn(function () { this.open = true })
    HTMLDialogElement.prototype.close = vi.fn(function () {
      this.open = false
      this.dispatchEvent(new Event('close'))
    })
  })

  it('renders title, message, and default labels', () => {
    const wrapper = mountModal()
    expect(wrapper.text()).toContain('Delete list?')
    expect(wrapper.text()).toContain('Are you sure you want to delete your Costco list?')
    const labels = wrapper.findAll('button').map(b => b.text())
    expect(labels).toEqual(['Cancel', 'Confirm'])
  })

  it('respects custom confirm/cancel labels', () => {
    const wrapper = mountModal({ confirmLabel: 'Delete', cancelLabel: 'Keep' })
    const labels = wrapper.findAll('button').map(b => b.text())
    expect(labels).toEqual(['Keep', 'Delete'])
  })

  it('renders Cancel before Confirm in DOM order so Cancel autofocuses', () => {
    const wrapper = mountModal()
    const buttons = wrapper.findAll('button')
    expect(buttons[0].text()).toBe('Cancel')
    expect(buttons[1].text()).toBe('Confirm')
  })

  it('applies primary variant by default', () => {
    const wrapper = mountModal({ confirmLabel: 'Confirm' })
    const confirmBtn = wrapper.findAll('button').find(b => b.text() === 'Confirm')
    expect(confirmBtn.classes()).toContain('confirm-modal__button--primary')
    expect(confirmBtn.classes()).not.toContain('confirm-modal__button--destructive')
  })

  it('applies destructive variant class when variant=destructive', () => {
    const wrapper = mountModal({ variant: 'destructive', confirmLabel: 'Delete' })
    const confirmBtn = wrapper.findAll('button').find(b => b.text() === 'Delete')
    expect(confirmBtn.classes()).toContain('confirm-modal__button--destructive')
    expect(confirmBtn.classes()).not.toContain('confirm-modal__button--primary')
  })

  it('emits confirm + update:open=false when Confirm is clicked', async () => {
    const wrapper = mountModal({ open: true })
    await wrapper.findAll('button').find(b => b.text() === 'Confirm').trigger('click')
    expect(wrapper.emitted('confirm')).toBeTruthy()
    expect(wrapper.emitted('update:open')).toEqual([[false]])
    expect(wrapper.emitted('cancel')).toBeFalsy()
  })

  it('emits cancel + update:open=false when Cancel is clicked', async () => {
    const wrapper = mountModal({ open: true })
    await wrapper.findAll('button').find(b => b.text() === 'Cancel').trigger('click')
    expect(wrapper.emitted('cancel')).toBeTruthy()
    expect(wrapper.emitted('update:open')).toEqual([[false]])
    expect(wrapper.emitted('confirm')).toBeFalsy()
  })

  it('cancels when backdrop is clicked (target is dialog itself)', async () => {
    const wrapper = mountModal({ open: true })
    const dialogEl = wrapper.find('dialog').element
    dialogEl.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('cancel')).toBeTruthy()
  })

  it('does not cancel when click target is inside the panel', async () => {
    const wrapper = mountModal({ open: true })
    await wrapper.find('.confirm-modal__panel').trigger('click')
    expect(wrapper.emitted('cancel')).toBeFalsy()
  })

  it('cancels when the dialog fires native close (e.g. ESC)', async () => {
    const wrapper = mountModal({ open: true })
    wrapper.find('dialog').element.dispatchEvent(new Event('close'))
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('cancel')).toBeTruthy()
    expect(wrapper.emitted('update:open')).toEqual([[false]])
  })

  it('calls showModal on mount when open=true', () => {
    mountModal({ open: true })
    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled()
  })

  it('calls showModal when open transitions to true', async () => {
    const wrapper = mountModal({ open: false })
    expect(HTMLDialogElement.prototype.showModal).not.toHaveBeenCalled()
    await wrapper.setProps({ open: true })
    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled()
  })

  it('calls close when open transitions to false', async () => {
    const wrapper = mountModal({ open: true })
    await wrapper.setProps({ open: false })
    expect(HTMLDialogElement.prototype.close).toHaveBeenCalled()
  })

  it('wires aria-labelledby to title and aria-describedby to message', () => {
    const wrapper = mountModal()
    const dialogEl = wrapper.find('dialog')
    const labelledby = dialogEl.attributes('aria-labelledby')
    const describedby = dialogEl.attributes('aria-describedby')
    expect(wrapper.find(`#${labelledby}`).text()).toBe('Delete list?')
    expect(wrapper.find(`#${describedby}`).text()).toBe('Are you sure you want to delete your Costco list?')
  })
})
