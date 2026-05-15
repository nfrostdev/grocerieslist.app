import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as transport from '@/sync/transport'
import * as poll from '@/sync/poll'
import App from '@/App.vue'
import { _resetForTest as resetDrainer } from '@/sync/queue'

vi.mock('@/sync/transport', () => ({
  provisionList: vi.fn(),
  joinList: vi.fn(),
  pollList: vi.fn(),
  upsertItem: vi.fn(),
  mintToken: vi.fn(),
  revokeToken: vi.fn(),
  deleteListRequest: vi.fn()
}))

vi.mock('@/sync/poll', () => ({
  startPoller: vi.fn(),
  stopPoller: vi.fn()
}))

const makeRouter = () => createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', name: 'Lists', component: { template: '<div data-test="lists"/>' } },
    { path: '/new', name: 'New', component: { template: '<div data-test="new"/>' } },
    { path: '/:id', name: 'List', component: { template: '<div data-test="list"/>' } }
  ]
})

const mountApp = async () => {
  const router = makeRouter()
  await router.push('/')
  const wrapper = mount(App, {
    global: {
      plugins: [createPinia(), router],
      stubs: { FontAwesomeIcon: { template: '<span/>' } }
    },
    attachTo: document.body
  })
  await flushPromises()
  return { wrapper, router }
}

describe('App.vue', () => {
  beforeEach(() => {
    localStorage.clear()
    window.location.hash = ''
    vi.resetAllMocks()
    resetDrainer()
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) { this.open = true })
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.open = false
      this.dispatchEvent(new Event('close'))
    })
  })

  it('renders header and main once loaded', async () => {
    const { wrapper } = await mountApp()
    expect(wrapper.html()).toContain('Skip to main content')
    expect(wrapper.find('main').exists()).toBe(true)
  })

  it('renders the live region container', async () => {
    const { wrapper } = await mountApp()
    expect(wrapper.find('[aria-live="polite"]').exists()).toBe(true)
  })

  it('startPolling boots both the poller and the queue drainer on mount', async () => {
    const item = { id: 'item1', n: 'Milk', q: '1', c: 0, u: 1000, d: 0 }
    localStorage.setItem('syncMeta', JSON.stringify({
      list1: { authToken: 'tok', role: 'editor', lastCursor: 0 }
    }))
    localStorage.setItem('pendingOps', JSON.stringify([
      { kind: 'upsertItem', opId: 'op1', listId: 'list1', item }
    ]))
    vi.mocked(transport.upsertItem).mockResolvedValue({ ok: true, data: { item } })

    await mountApp()
    await flushPromises()

    expect(poll.startPoller).toHaveBeenCalledWith('list1')
    expect(transport.upsertItem).toHaveBeenCalledWith('list1', 'item1', 'tok', item)
    expect(localStorage.getItem('pendingOps')).toBe('[]')
  })
})
