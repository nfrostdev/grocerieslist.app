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

  it('exposes the theme toggle as an unpressed-agnostic button', () => {
    const toggle = wrapper.get('button.header__theme-toggle')
    expect(toggle.attributes('aria-label')).toMatch(/^Switch to (light|dark|system) mode$/)
    expect(toggle.attributes('aria-pressed')).toBeUndefined()
  })
})
