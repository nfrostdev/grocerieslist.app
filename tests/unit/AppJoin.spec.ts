import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createRouter, createMemoryHistory, type Router } from 'vue-router'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import App from '@/App.vue'

import * as sync from '@/sync'

vi.mock('@/sync', () => ({
  startPolling: vi.fn(),
  getMeta: vi.fn(() => null),
  join: vi.fn(() => Promise.resolve({ ok: false, reason: 'invalid' as const })),
  getSyncMetaMap: vi.fn(() => ({})),
  saveSyncMetaMap: vi.fn()
}))

const makeRouter = () => createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', name: 'Lists', component: { template: '<div/>' } },
    { path: '/new', name: 'New', component: { template: '<div/>' } },
    { path: '/:id', name: 'List', component: { template: '<div/>' } }
  ]
})

const mountApp = async (router: Router) => {
  await router.push('/')
  const wrapper = mount(App, {
    global: {
      plugins: [createPinia(), router],
      stubs: { FontAwesomeIcon: { template: '<span/>' } }
    }
  })
  await flushPromises()
  return wrapper
}

describe('App.vue — handleJoinFragment', () => {
  beforeEach(() => {
    localStorage.clear()
    window.location.hash = ''
    vi.resetAllMocks()
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) { this.open = true })
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.open = false
      this.dispatchEvent(new Event('close'))
    })
  })

  it('ignores URLs with no join fragment', async () => {
    const router = makeRouter()
    await mountApp(router)
    expect(sync.join).not.toHaveBeenCalled()
    expect(router.currentRoute.value.name).toBe('Lists')
  })

  it('calls join and navigates to the list on a valid fragment', async () => {
    vi.mocked(sync.join).mockResolvedValue({ ok: true })
    window.location.hash = '#join=listid123.tokenxyz'
    const router = makeRouter()
    await mountApp(router)
    expect(sync.join).toHaveBeenCalledWith('listid123', 'tokenxyz')
    expect(router.currentRoute.value.name).toBe('List')
    expect(router.currentRoute.value.params.id).toBe('listid123')
  })

  it('navigates without calling join when list is already synced', async () => {
    vi.mocked(sync.getMeta).mockReturnValue({ authToken: 'tok', role: 'owner', lastCursor: 1 })
    window.location.hash = '#join=listid123.tokenxyz'
    const router = makeRouter()
    await mountApp(router)
    expect(sync.join).not.toHaveBeenCalled()
    expect(router.currentRoute.value.name).toBe('List')
  })

  it('stays on Lists and does not navigate when join fails', async () => {
    vi.mocked(sync.join).mockResolvedValue({ ok: false, reason: 'invalid' })
    window.location.hash = '#join=listid123.tokenxyz'
    const router = makeRouter()
    await mountApp(router)
    expect(sync.join).toHaveBeenCalled()
    expect(router.currentRoute.value.name).toBe('Lists')
  })

  it('retries on network errors with backoff and succeeds when the network recovers', async () => {
    vi.useFakeTimers()
    vi.mocked(sync.join)
      .mockResolvedValueOnce({ ok: false, reason: 'network' })
      .mockResolvedValueOnce({ ok: false, reason: 'network' })
      .mockResolvedValueOnce({ ok: true })
    window.location.hash = '#join=listid123.tokenxyz'
    const router = makeRouter()
    await router.push('/')
    const wrapper = mount(App, {
      global: {
        plugins: [createPinia(), router],
        stubs: { FontAwesomeIcon: { template: '<span/>' } }
      }
    })
    await flushPromises()
    await vi.advanceTimersByTimeAsync(1000)
    await flushPromises()
    await vi.advanceTimersByTimeAsync(2000)
    await flushPromises()
    expect(sync.join).toHaveBeenCalledTimes(3)
    expect(router.currentRoute.value.name).toBe('List')
    wrapper.unmount()
    vi.useRealTimers()
  })

  it('gives up after exhausting network retries', async () => {
    vi.useFakeTimers()
    vi.mocked(sync.join).mockResolvedValue({ ok: false, reason: 'network' })
    window.location.hash = '#join=listid123.tokenxyz'
    const router = makeRouter()
    await router.push('/')
    const wrapper = mount(App, {
      global: {
        plugins: [createPinia(), router],
        stubs: { FontAwesomeIcon: { template: '<span/>' } }
      }
    })
    await flushPromises()
    await vi.advanceTimersByTimeAsync(7000)
    await flushPromises()
    expect(sync.join).toHaveBeenCalledTimes(4)
    expect(router.currentRoute.value.name).toBe('Lists')
    wrapper.unmount()
    vi.useRealTimers()
  })

  it('does not retry on invalid-token errors', async () => {
    vi.useFakeTimers()
    vi.mocked(sync.join).mockResolvedValue({ ok: false, reason: 'invalid' })
    window.location.hash = '#join=listid123.tokenxyz'
    const router = makeRouter()
    await router.push('/')
    const wrapper = mount(App, {
      global: {
        plugins: [createPinia(), router],
        stubs: { FontAwesomeIcon: { template: '<span/>' } }
      }
    })
    await flushPromises()
    await vi.advanceTimersByTimeAsync(10000)
    expect(sync.join).toHaveBeenCalledTimes(1)
    wrapper.unmount()
    vi.useRealTimers()
  })
})
