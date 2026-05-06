import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import ImportModal from '@/components/ImportModal.vue'

const incoming = { id: 'a1b2c3d4', n: 'Costco', i: [{ id: 'i1', n: 'Eggs', q: '1', c: 0, u: 1, d: 0 }] }
const existing = { id: 'a1b2c3d4', n: 'Old Costco', i: [] }

const mountModal = (props = {}) => mount(ImportModal, {
  props: { open: false, incoming, existing: null, ...props },
  global: { stubs: { FontAwesomeIcon: { template: '<span/>' } } }
})

describe('ImportModal', () => {
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
})
