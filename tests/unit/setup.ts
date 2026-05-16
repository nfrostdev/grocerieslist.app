import { beforeEach } from 'vitest'
import { _resetForTest as resetSyncMetaCache } from '@/sync/storage'

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  configurable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false
  })
})

// storage.ts caches the parsed syncMeta map in module state. Tests poke
// localStorage directly (and call localStorage.clear()), which bypasses the
// cache, so reset it before every test to keep cases isolated.
beforeEach(() => {
  resetSyncMetaCache()
})
