import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ShareSheet from '@/components/ShareSheet.vue'

const { buildShareUrlMock } = vi.hoisted(() => ({ buildShareUrlMock: vi.fn() }))

vi.mock('qrcode', () => ({
  default: { toString: vi.fn().mockResolvedValue('<svg data-test="mock-qr"/>') }
}))

vi.mock('@/utils/share', () => ({
  buildShareUrl: (...args) => buildShareUrlMock(...args)
}))

const list = { id: 'l1', n: 'Costco', i: [{ id: 'i1', n: 'Eggs', q: '1', c: 0, u: 1, d: 0 }] }

const mountSheet = (props = {}) => mount(ShareSheet, {
  props: { open: false, list, ...props },
  global: { stubs: { FontAwesomeIcon: { template: '<span/>' } } },
  attachTo: document.body
})

describe('ShareSheet', () => {
  beforeEach(() => {
    buildShareUrlMock.mockReset()
    HTMLDialogElement.prototype.showModal = vi.fn(function () { this.open = true })
    HTMLDialogElement.prototype.close = vi.fn(function () {
      this.open = false
      this.dispatchEvent(new Event('close'))
    })
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) }
    })
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined)
    })
  })

  it('does not call showModal when mounted closed', () => {
    const wrapper = mountSheet({ open: false })
    expect(HTMLDialogElement.prototype.showModal).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('builds QR + URL when opened, hides loading, shows QR', async () => {
    buildShareUrlMock.mockReturnValue({
      url: 'https://example.com/#import=1abc',
      payload: '1abc',
      tooLarge: false
    })
    const wrapper = mountSheet({ open: true })
    await flushPromises()
    expect(buildShareUrlMock).toHaveBeenCalledWith(list)
    expect(wrapper.html()).toContain('mock-qr')
    expect(wrapper.text()).not.toContain('Generating QR code')
    wrapper.unmount()
  })

  it('shows too-large message and skips QR rendering when payload over cap', async () => {
    buildShareUrlMock.mockReturnValue({
      url: 'x'.repeat(2000),
      payload: 'x'.repeat(2000),
      tooLarge: true
    })
    const wrapper = mountSheet({ open: true })
    await flushPromises()
    expect(wrapper.text()).toContain('List too large')
    expect(wrapper.html()).not.toContain('mock-qr')
    wrapper.unmount()
  })

  it('copies URL to clipboard when Copy is clicked', async () => {
    buildShareUrlMock.mockReturnValue({ url: 'https://example.com/#x', payload: 'x', tooLarge: false })
    const wrapper = mountSheet({ open: true })
    await flushPromises()
    await wrapper.findAll('button').find(b => b.text().includes('Copy link')).trigger('click')
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://example.com/#x')
  })

  it('invokes navigator.share when Share link is clicked', async () => {
    buildShareUrlMock.mockReturnValue({ url: 'https://example.com/#x', payload: 'x', tooLarge: false })
    const wrapper = mountSheet({ open: true })
    await flushPromises()
    await wrapper.findAll('button').find(b => b.text().includes('Share link')).trigger('click')
    expect(navigator.share).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://example.com/#x' }))
  })

  it('emits update:open=false when close button clicked', async () => {
    buildShareUrlMock.mockReturnValue({ url: 'x', payload: 'x', tooLarge: false })
    const wrapper = mountSheet({ open: true })
    await flushPromises()
    await wrapper.find('.share-sheet__close').trigger('click')
    await flushPromises()
    expect(wrapper.emitted('update:open')).toEqual([[false]])
  })

  it('closes when prop transitions from open to closed', async () => {
    buildShareUrlMock.mockReturnValue({ url: 'x', payload: 'x', tooLarge: false })
    const wrapper = mountSheet({ open: true })
    await flushPromises()
    await wrapper.setProps({ open: false })
    await flushPromises()
    expect(HTMLDialogElement.prototype.close).toHaveBeenCalled()
  })

  it('opens via showModal when prop transitions from closed to open', async () => {
    buildShareUrlMock.mockReturnValue({ url: 'x', payload: 'x', tooLarge: false })
    const wrapper = mountSheet({ open: false })
    await wrapper.setProps({ open: true })
    await flushPromises()
    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled()
  })

  it('swallows clipboard errors', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) }
    })
    buildShareUrlMock.mockReturnValue({ url: 'x', payload: 'x', tooLarge: false })
    const wrapper = mountSheet({ open: true })
    await flushPromises()
    await wrapper.findAll('button').find(b => b.text().includes('Copy link')).trigger('click')
    await flushPromises()
    expect(true).toBe(true)
  })

  it('swallows navigator.share rejection (user cancel)', async () => {
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: vi.fn().mockRejectedValue(new Error('cancelled'))
    })
    buildShareUrlMock.mockReturnValue({ url: 'x', payload: 'x', tooLarge: false })
    const wrapper = mountSheet({ open: true })
    await flushPromises()
    await wrapper.findAll('button').find(b => b.text().includes('Share link')).trigger('click')
    await flushPromises()
    expect(true).toBe(true)
  })
})
