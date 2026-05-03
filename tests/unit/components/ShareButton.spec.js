import { mount, flushPromises } from '@vue/test-utils'
import ShareButton from '@/components/ShareButton.vue'

const list = { id: 'abc123', n: 'Shopping', i: [] }

describe('ShareButton.vue', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('renders button with list name in title', () => {
    const wrapper = mount(ShareButton, {
      props: { list },
      global: { stubs: { FontAwesomeIcon: { template: '<span />' } } }
    })
    expect(wrapper.find('button').attributes('title')).toContain('Shopping')
  })

  it('calls fetch when button is clicked', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ link: 'https://short.link/x' })
    }))
    vi.stubGlobal('navigator', { share: vi.fn() })
    const wrapper = mount(ShareButton, {
      props: { list },
      global: { stubs: { FontAwesomeIcon: { template: '<span />' } } }
    })
    await wrapper.find('button').trigger('click')
    expect(fetch).toHaveBeenCalled()
  })

  it('calls navigator.share with the short link', async () => {
    const shareMock = vi.fn()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ link: 'https://short.link/x' })
    }))
    vi.stubGlobal('navigator', { share: shareMock })
    const wrapper = mount(ShareButton, {
      props: { list },
      global: { stubs: { FontAwesomeIcon: { template: '<span />' } } }
    })
    await wrapper.find('button').trigger('click')
    await flushPromises()
    expect(shareMock).toHaveBeenCalledWith({
      url: 'https://short.link/x',
      text: 'Check out my Shopping list!'
    })
  })
})
