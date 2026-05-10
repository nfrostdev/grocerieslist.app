import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createRouter, createMemoryHistory, type Router } from 'vue-router'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import App from '@/App.vue'

import * as sync from '@/sync'

vi.mock('@/sync', () => ({
  startPolling: vi.fn(),
  getMeta: vi.fn(() => null),
  join: vi.fn(() => Promise.resolve(false)),
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
    vi.mocked(sync.join).mockResolvedValue(true)
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
    vi.mocked(sync.join).mockResolvedValue(false)
    window.location.hash = '#join=listid123.tokenxyz'
    const router = makeRouter()
    await mountApp(router)
    expect(sync.join).toHaveBeenCalled()
    expect(router.currentRoute.value.name).toBe('Lists')
  })
})
