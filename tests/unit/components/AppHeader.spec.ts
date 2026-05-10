import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import AppHeader from '@/components/AppHeader.vue'

describe('AppHeader.vue', () => {
  const wrapper = mount(AppHeader, {
    global: {
      stubs: {
        RouterLink: { template: '<a><slot /></a>' },
        FontAwesomeIcon: { template: '<span />' }
      }
    }
  })

  it('renders the My Lists title', () => {
    expect(wrapper.text()).toContain('My Lists')
  })

  it('renders the New List link', () => {
    expect(wrapper.text()).toContain('New List')
  })
})
