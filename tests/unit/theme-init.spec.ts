import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const scriptSrc = readFileSync(resolve(__dirname, '../../public/theme-init.js'), 'utf-8')

function runScript () {
  // The script is an IIFE; eval in a function scope so it touches the test's
  // globals (localStorage, matchMedia, document).
  // eslint-disable-next-line no-new-func
  new Function(scriptSrc)()
}

function mockMatchMedia (prefersDark: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: prefersDark,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false
    })
  })
}

describe('theme-init.js', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
    mockMatchMedia(false)
  })

  it('applies dark class when theme-mode is "dark"', () => {
    localStorage.setItem('theme-mode', 'dark')
    runScript()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('does not apply dark class when theme-mode is "light"', () => {
    localStorage.setItem('theme-mode', 'light')
    mockMatchMedia(true)
    runScript()
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('falls back to prefers-color-scheme when nothing is stored', () => {
    mockMatchMedia(true)
    runScript()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('does not throw when localStorage.getItem throws (private mode)', () => {
    const original = Storage.prototype.getItem
    Storage.prototype.getItem = function () {
      throw new DOMException('SecurityError', 'SecurityError')
    }
    try {
      expect(() => runScript()).not.toThrow()
    } finally {
      Storage.prototype.getItem = original
    }
  })

  it('falls back to prefers-color-scheme when localStorage throws', () => {
    const original = Storage.prototype.getItem
    Storage.prototype.getItem = function () {
      throw new DOMException('SecurityError', 'SecurityError')
    }
    mockMatchMedia(true)
    try {
      runScript()
      expect(document.documentElement.classList.contains('dark')).toBe(true)
    } finally {
      Storage.prototype.getItem = original
    }
  })
})
