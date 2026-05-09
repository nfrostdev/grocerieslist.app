import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ShareSheet from '@/components/ShareSheet.vue'

const { provisionMock, isSyncedMock, getMetaMock, enableSharingMock, disableSharingMock, deleteListMock } = vi.hoisted(() => ({
  provisionMock: vi.fn(),
  isSyncedMock: vi.fn(),
  getMetaMock: vi.fn(),
  enableSharingMock: vi.fn(),
  disableSharingMock: vi.fn(),
  deleteListMock: vi.fn()
}))

vi.mock('qrcode', () => ({
  default: { toString: vi.fn().mockResolvedValue('<svg data-test="mock-qr"/>') }
}))

vi.mock('@/sync', () => ({
  provision: (...args) => provisionMock(...args),
  isSynced: (...args) => isSyncedMock(...args),
  getMeta: (...args) => getMetaMock(...args),
  enableSharing: (...args) => enableSharingMock(...args),
  disableSharing: (...args) => disableSharingMock(...args),
  deleteList: (...args) => deleteListMock(...args)
}))

const list = { id: 'l1', n: 'Costco', i: [{ id: 'i1', n: 'Eggs', q: '1', c: 0, u: 1, d: 0 }] }

const OWNER_META = { authToken: 'owner-tok', role: 'owner', lastCursor: 1, shareToken: 'share-tok' }
const SHARE_URL = 'https://example.com/#join=l1.share-tok'

const mountSheet = (props = {}) => mount(ShareSheet, {
  props: { open: false, list, ...props },
  global: { stubs: { FontAwesomeIcon: { template: '<span/>' }, ConfirmModal: { template: '<div/>', props: ['open', 'title', 'message', 'variant', 'confirmLabel'] } } },
  attachTo: document.body
})

describe('ShareSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isSyncedMock.mockReturnValue(false)
    provisionMock.mockResolvedValue({ joinUrl: 'https://example.com/#join=ID.TOKEN', listId: 'ID' })
    enableSharingMock.mockResolvedValue(SHARE_URL)
    disableSharingMock.mockResolvedValue(true)
    deleteListMock.mockResolvedValue(true)
    getMetaMock.mockReturnValue(null)
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

  it('calls provision and enableSharing then renders QR for an unsynced list', async () => {
    const wrapper = mountSheet({ open: true })
    await flushPromises()
    expect(provisionMock).toHaveBeenCalledWith(list)
    expect(enableSharingMock).toHaveBeenCalled()
    expect(wrapper.html()).toContain('mock-qr')
    expect(wrapper.text()).not.toContain('Setting up')
    wrapper.unmount()
  })

  it('skips provision and shows QR for a synced owner with shareToken', async () => {
    isSyncedMock.mockReturnValue(true)
    getMetaMock.mockReturnValue(OWNER_META)
    const wrapper = mountSheet({ open: true })
    await flushPromises()
    expect(provisionMock).not.toHaveBeenCalled()
    expect(wrapper.html()).toContain('mock-qr')
    wrapper.unmount()
  })

  it('shows not-sharing state for a synced owner without shareToken', async () => {
    isSyncedMock.mockReturnValue(true)
    getMetaMock.mockReturnValue({ authToken: 'owner-tok', role: 'owner', lastCursor: 1 })
    const wrapper = mountSheet({ open: true })
    await flushPromises()
    expect(provisionMock).not.toHaveBeenCalled()
    expect(wrapper.html()).not.toContain('mock-qr')
    expect(wrapper.text()).toContain('Enable sharing')
    wrapper.unmount()
  })

  it('shows error state when provision fails', async () => {
    provisionMock.mockResolvedValue(null)
    const wrapper = mountSheet({ open: true })
    await flushPromises()
    expect(wrapper.text()).toContain('Could not create shared list')
    expect(wrapper.html()).not.toContain('mock-qr')
    wrapper.unmount()
  })

  it('copies URL to clipboard when Copy is clicked', async () => {
    const wrapper = mountSheet({ open: true })
    await flushPromises()
    await wrapper.findAll('button').find(b => b.text().includes('Copy link')).trigger('click')
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(SHARE_URL)
  })

  it('invokes navigator.share when Share link is clicked', async () => {
    const wrapper = mountSheet({ open: true })
    await flushPromises()
    await wrapper.findAll('button').find(b => b.text().includes('Share link')).trigger('click')
    expect(navigator.share).toHaveBeenCalledWith(expect.objectContaining({ url: SHARE_URL }))
  })

  it('clicking Enable sharing calls enableSharing and shows QR', async () => {
    isSyncedMock.mockReturnValue(true)
    getMetaMock.mockReturnValue({ authToken: 'owner-tok', role: 'owner', lastCursor: 1 })
    const wrapper = mountSheet({ open: true })
    await flushPromises()

    await wrapper.findAll('button').find(b => b.text().includes('Enable sharing')).trigger('click')
    await flushPromises()

    expect(enableSharingMock).toHaveBeenCalledWith('l1')
    expect(wrapper.html()).toContain('mock-qr')
    wrapper.unmount()
  })

  it('clicking Stop sharing calls disableSharing and shows Enable button', async () => {
    isSyncedMock.mockReturnValue(true)
    getMetaMock.mockReturnValue(OWNER_META)
    const wrapper = mountSheet({ open: true })
    await flushPromises()

    await wrapper.findAll('button').find(b => b.text().includes('Stop sharing')).trigger('click')
    await flushPromises()

    expect(disableSharingMock).toHaveBeenCalledWith('l1')
    expect(wrapper.html()).not.toContain('mock-qr')
    expect(wrapper.text()).toContain('Enable sharing')
    wrapper.unmount()
  })

  it('emits provisioned + update:open=false when closed after provision', async () => {
    const wrapper = mountSheet({ open: true })
    await flushPromises()
    await wrapper.find('.share-sheet__close').trigger('click')
    await flushPromises()
    expect(wrapper.emitted('provisioned')).toEqual([['ID']])
    expect(wrapper.emitted('update:open')).toEqual([[false]])
  })

  it('does not emit provisioned when closing without provision', async () => {
    isSyncedMock.mockReturnValue(true)
    getMetaMock.mockReturnValue(OWNER_META)
    const wrapper = mountSheet({ open: true })
    await flushPromises()
    await wrapper.find('.share-sheet__close').trigger('click')
    await flushPromises()
    expect(wrapper.emitted('provisioned')).toBeFalsy()
    expect(wrapper.emitted('update:open')).toEqual([[false]])
  })

  it('closes when prop transitions from open to closed', async () => {
    const wrapper = mountSheet({ open: true })
    await flushPromises()
    await wrapper.setProps({ open: false })
    await flushPromises()
    expect(HTMLDialogElement.prototype.close).toHaveBeenCalled()
  })

  it('opens via showModal when prop transitions from closed to open', async () => {
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
    const wrapper = mountSheet({ open: true })
    await flushPromises()
    await wrapper.findAll('button').find(b => b.text().includes('Share link')).trigger('click')
    await flushPromises()
    expect(true).toBe(true)
  })
})
