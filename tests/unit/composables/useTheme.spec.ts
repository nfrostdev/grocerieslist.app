import { describe, it, expect, beforeEach, vi } from 'vitest'

let mockMatches = false
const mockAddEventListener = vi.fn()
const mockRemoveEventListener = vi.fn()

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: mockMatches,
    media: query,
    addEventListener: mockAddEventListener,
    removeEventListener: mockRemoveEventListener,
    dispatchEvent: vi.fn()
  }))
})

async function freshTheme () {
  vi.resetModules()
  const { useTheme } = await import('@/composables/useTheme')
  return useTheme()
}

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
    mockMatches = false
    mockAddEventListener.mockClear()
    mockRemoveEventListener.mockClear()
  })

  describe('init', () => {
    it('defaults to system when no localStorage entry', async () => {
      const { mode, init } = await freshTheme()
      init()
      expect(mode.value).toBe('system')
    })

    it('restores persisted light mode', async () => {
      localStorage.setItem('theme-mode', 'light')
      const { mode, init } = await freshTheme()
      init()
      expect(mode.value).toBe('light')
      expect(document.documentElement.classList.contains('dark')).toBe(false)
    })

    it('restores persisted dark mode and adds .dark class', async () => {
      localStorage.setItem('theme-mode', 'dark')
      const { mode, init } = await freshTheme()
      init()
      expect(mode.value).toBe('dark')
      expect(document.documentElement.classList.contains('dark')).toBe(true)
    })

    it('ignores invalid localStorage values and falls back to system', async () => {
      localStorage.setItem('theme-mode', 'garbage')
      const { mode, init } = await freshTheme()
      init()
      expect(mode.value).toBe('system')
    })

    it('applies dark class in system mode when OS prefers dark', async () => {
      mockMatches = true
      const { init } = await freshTheme()
      init()
      expect(document.documentElement.classList.contains('dark')).toBe(true)
    })

    it('registers a change listener on the media query', async () => {
      const { init } = await freshTheme()
      init()
      expect(mockAddEventListener).toHaveBeenCalledWith('change', expect.any(Function))
    })

    it('is idempotent: repeated init() calls do not re-register the listener', async () => {
      const { init } = await freshTheme()
      init()
      init()
      init()
      expect(mockAddEventListener).toHaveBeenCalledTimes(1)
    })
  })

  describe('cleanup', () => {
    it('removes the matchMedia listener registered by init()', async () => {
      const { init, cleanup } = await freshTheme()
      init()
      const [, handler] = mockAddEventListener.mock.calls[0]
      cleanup()
      expect(mockRemoveEventListener).toHaveBeenCalledWith('change', handler)
    })

    it('is a no-op when init() was never called', async () => {
      const { cleanup } = await freshTheme()
      cleanup()
      expect(mockRemoveEventListener).not.toHaveBeenCalled()
    })

    it('allows init() to re-register after cleanup (e.g. HMR)', async () => {
      const { init, cleanup } = await freshTheme()
      init()
      cleanup()
      init()
      expect(mockAddEventListener).toHaveBeenCalledTimes(2)
    })
  })

  describe('setMode', () => {
    it('switches to dark and persists', async () => {
      const { mode, setMode, init } = await freshTheme()
      init()
      setMode('dark')
      expect(mode.value).toBe('dark')
      expect(localStorage.getItem('theme-mode')).toBe('dark')
      expect(document.documentElement.classList.contains('dark')).toBe(true)
    })

    it('switches to light and removes .dark class', async () => {
      document.documentElement.classList.add('dark')
      const { mode, setMode, init } = await freshTheme()
      init()
      setMode('light')
      expect(mode.value).toBe('light')
      expect(document.documentElement.classList.contains('dark')).toBe(false)
    })

    it('switches to system and reflects OS preference', async () => {
      mockMatches = true
      const { mode, setMode, init } = await freshTheme()
      init()
      setMode('light')
      expect(document.documentElement.classList.contains('dark')).toBe(false)
      setMode('system')
      expect(mode.value).toBe('system')
      expect(document.documentElement.classList.contains('dark')).toBe(true)
    })
  })

  describe('cycleMode', () => {
    it('cycles light → dark → system → light', async () => {
      const { mode, cycleMode, init } = await freshTheme()
      init()
      // starts at system
      cycleMode() // system → light
      expect(mode.value).toBe('light')
      cycleMode() // light → dark
      expect(mode.value).toBe('dark')
      cycleMode() // dark → system
      expect(mode.value).toBe('system')
      cycleMode() // system → light
      expect(mode.value).toBe('light')
    })

    it('persists each cycled mode to localStorage', async () => {
      const { cycleMode, init } = await freshTheme()
      init()
      cycleMode()
      expect(localStorage.getItem('theme-mode')).toBe('light')
      cycleMode()
      expect(localStorage.getItem('theme-mode')).toBe('dark')
      cycleMode()
      expect(localStorage.getItem('theme-mode')).toBe('system')
    })
  })
})
