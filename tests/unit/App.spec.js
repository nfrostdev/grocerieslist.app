import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import App from '@/App.vue'

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
    HTMLDialogElement.prototype.showModal = vi.fn(function () { this.open = true })
    HTMLDialogElement.prototype.close = vi.fn(function () {
      this.open = false
      this.dispatchEvent(new Event('close'))
    })
  })

  it('renders header and main once loaded', async () => {
    const { wrapper } = await mountApp()
    expect(wrapper.html()).toContain('Skip to main content')
    expect(wrapper.find('main').exists()).toBe(true)
  })

  it('does not show import modal without #import= fragment', async () => {
    const { wrapper } = await mountApp()
    expect(wrapper.find('.import-modal').exists()).toBe(false)
  })

  it('renders the live region container', async () => {
    const { wrapper } = await mountApp()
    expect(wrapper.find('[aria-live="polite"]').exists()).toBe(true)
  })
})
