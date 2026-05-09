import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import App from '@/App.vue'

const { decodeListMock } = vi.hoisted(() => ({ decodeListMock: vi.fn() }))

vi.mock('@/utils/share', () => ({
  encodeList: vi.fn(),
  decodeList: decodeListMock
}))

const makeRouter = () => createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', name: 'Lists', component: { template: '<div/>' } },
    { path: '/new', name: 'New', component: { template: '<div/>' } },
    { path: '/:id', name: 'List', component: { template: '<div/>' } }
  ]
})

const mountApp = async (router) => {
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

describe('App.vue — handleImportFragment', () => {
  beforeEach(() => {
    localStorage.clear()
    window.location.hash = ''
    vi.resetAllMocks()
    HTMLDialogElement.prototype.showModal = vi.fn(function () { this.open = true })
    HTMLDialogElement.prototype.close = vi.fn(function () {
      this.open = false
      this.dispatchEvent(new Event('close'))
    })
  })

  it('shows no modal without an #import= fragment', async () => {
    const wrapper = await mountApp(makeRouter())
    expect(wrapper.find('.import-modal').exists()).toBe(false)
  })

  it('opens "Import shared list?" modal for a new list', async () => {
    decodeListMock.mockReturnValue({ ok: true, list: { id: 'shr1', n: 'Costco', i: [] } })
    window.location.hash = '#import=payload1'
    const wrapper = await mountApp(makeRouter())
    expect(wrapper.find('.import-modal__title').text()).toBe('Import shared list?')
  })

  it('opens "Update existing list?" when list id already exists locally', async () => {
    const list = { id: 'shr2', n: 'Pantry', i: [] }
    localStorage.setItem('lists', JSON.stringify([list]))
    decodeListMock.mockReturnValue({ ok: true, list })
    window.location.hash = '#import=payload2'
    const wrapper = await mountApp(makeRouter())
    expect(wrapper.find('.import-modal__title').text()).toBe('Update existing list?')
  })

  it('does not open modal on corrupt decode', async () => {
    decodeListMock.mockReturnValue({ ok: false, reason: 'corrupt' })
    window.location.hash = '#import=badpayload'
    const wrapper = await mountApp(makeRouter())
    expect(wrapper.find('.import-modal').exists()).toBe(false)
  })

  it('does not open modal on newer-schema decode', async () => {
    decodeListMock.mockReturnValue({ ok: false, reason: 'newer-schema' })
    window.location.hash = '#import=futurepayload'
    const wrapper = await mountApp(makeRouter())
    expect(wrapper.find('.import-modal').exists()).toBe(false)
  })

  it('Import button replaces list and navigates to its route', async () => {
    decodeListMock.mockReturnValue({ ok: true, list: { id: 'shr3', n: 'Shopping', i: [] } })
    window.location.hash = '#import=payload3'
    const router = makeRouter()
    const wrapper = await mountApp(router)
    await wrapper.findAll('button').find(b => b.text() === 'Import').trigger('click')
    await flushPromises()
    expect(wrapper.find('.import-modal').exists()).toBe(false)
    expect(router.currentRoute.value.params.id).toBe('shr3')
  })

  it('Merge button merges list and navigates', async () => {
    const list = { id: 'shr4', n: 'Shared', i: [] }
    localStorage.setItem('lists', JSON.stringify([list]))
    decodeListMock.mockReturnValue({ ok: true, list })
    window.location.hash = '#import=payload4'
    const router = makeRouter()
    const wrapper = await mountApp(router)
    await wrapper.findAll('button').find(b => b.text() === 'Merge').trigger('click')
    await flushPromises()
    expect(wrapper.find('.import-modal').exists()).toBe(false)
    expect(router.currentRoute.value.params.id).toBe('shr4')
  })

  it('Cancel closes the modal without navigating', async () => {
    decodeListMock.mockReturnValue({ ok: true, list: { id: 'shr5', n: 'Cancel Test', i: [] } })
    window.location.hash = '#import=payload5'
    const router = makeRouter()
    const wrapper = await mountApp(router)
    await wrapper.findAll('button').find(b => b.text() === 'Cancel').trigger('click')
    await flushPromises()
    expect(wrapper.find('.import-modal').exists()).toBe(false)
    expect(router.currentRoute.value.name).toBe('Lists')
  })
})
