import { mount } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ImportModal from '@/components/ImportModal.vue'

const incoming = { id: 'a1b2c3d4', n: 'Costco', i: [{ id: 'i1', n: 'Eggs', q: '1', c: 0, u: 1, d: 0 }] }
const existing = { id: 'a1b2c3d4', n: 'Old Costco', i: [] }

const mountModal = (props = {}) => mount(ImportModal, {
  props: { open: false, incoming, existing: null, ...props },
  global: { stubs: { FontAwesomeIcon: { template: '<span/>' } } }
})

describe('ImportModal', () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = vi.fn(function () { this.open = true })
    HTMLDialogElement.prototype.close = vi.fn(function () {
      this.open = false
      this.dispatchEvent(new Event('close'))
    })
  })

  it('renders only Import + Cancel when no existing match', () => {
    const wrapper = mountModal()
    const buttons = wrapper.findAll('button').map(b => b.text())
    expect(buttons).toContain('Import')
    expect(buttons).toContain('Cancel')
    expect(buttons).not.toContain('Merge')
    expect(buttons).not.toContain('Replace mine')
  })

  it('renders Merge / Replace / Copy / Cancel when existing matches', () => {
    const wrapper = mountModal({ existing })
    const buttons = wrapper.findAll('button').map(b => b.text())
    expect(buttons).toEqual(expect.arrayContaining(['Merge', 'Replace mine', 'Import as copy', 'Cancel']))
  })

  it('emits replace when Import is clicked (no collision)', async () => {
    const wrapper = mountModal()
    await wrapper.findAll('button').find(b => b.text() === 'Import').trigger('click')
    expect(wrapper.emitted('replace')).toBeTruthy()
  })

  it('emits merge / replace / copy on the corresponding buttons', async () => {
    const wrapper = mountModal({ existing })
    await wrapper.findAll('button').find(b => b.text() === 'Merge').trigger('click')
    await wrapper.findAll('button').find(b => b.text() === 'Replace mine').trigger('click')
    await wrapper.findAll('button').find(b => b.text() === 'Import as copy').trigger('click')
    expect(wrapper.emitted('merge')).toBeTruthy()
    expect(wrapper.emitted('replace')).toBeTruthy()
    expect(wrapper.emitted('copy')).toBeTruthy()
  })

  it('emits cancel + update:open=false when Cancel is clicked', async () => {
    const wrapper = mountModal()
    await wrapper.findAll('button').find(b => b.text() === 'Cancel').trigger('click')
    expect(wrapper.emitted('cancel')).toBeTruthy()
    expect(wrapper.emitted('update:open')).toEqual([[false]])
  })

  it('shows live item count, ignoring tombstones', () => {
    const incomingWithTomb = {
      id: 'x',
      n: 'L',
      i: [
        { id: 'i1', n: 'A', q: '1', c: 0, u: 1, d: 0 },
        { id: 'i2', n: 'B', q: '1', c: 0, u: 1, d: 1 }
      ]
    }
    const wrapper = mountModal({ incoming: incomingWithTomb })
    expect(wrapper.text()).toContain('1 item')
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

  it('cancels when backdrop is clicked (target is dialog itself)', async () => {
    const wrapper = mountModal({ open: true })
    const dialogEl = wrapper.find('dialog').element
    dialogEl.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('cancel')).toBeTruthy()
  })

  it('does not cancel when click target is inside the panel', async () => {
    const wrapper = mountModal({ open: true })
    await wrapper.find('.import-modal__panel').trigger('click')
    expect(wrapper.emitted('cancel')).toBeFalsy()
  })
})
