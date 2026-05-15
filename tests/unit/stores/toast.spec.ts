import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useToastStore } from '@/stores/toast'

beforeEach(() => {
  vi.useFakeTimers()
  setActivePinia(createPinia())
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useToastStore', () => {
  it('add appends a toast with the given message and type', () => {
    const store = useToastStore()
    store.add('Hello', 'error')
    expect(store.toasts).toHaveLength(1)
    expect(store.toasts[0]).toMatchObject({ message: 'Hello', type: 'error' })
  })

  it('add defaults type to info', () => {
    const store = useToastStore()
    store.add('Info message')
    expect(store.toasts[0].type).toBe('info')
  })

  it('dismiss removes the toast by id', () => {
    const store = useToastStore()
    store.add('One')
    store.add('Two')
    const id = store.toasts[0].id
    store.dismiss(id)
    expect(store.toasts).toHaveLength(1)
    expect(store.toasts[0].message).toBe('Two')
  })

  it('dismiss is a no-op for an unknown id', () => {
    const store = useToastStore()
    store.add('One')
    store.dismiss(9999)
    expect(store.toasts).toHaveLength(1)
  })

  it('auto-dismisses after 5 seconds', () => {
    const store = useToastStore()
    store.add('Timed')
    expect(store.toasts).toHaveLength(1)
    vi.advanceTimersByTime(5000)
    expect(store.toasts).toHaveLength(0)
  })

  it('manual dismiss cancels the auto-dismiss timer (no post-unmount mutation)', () => {
    const store = useToastStore()
    store.add('One')
    const id = store.toasts[0].id
    store.dismiss(id)
    store.add('Two')
    vi.advanceTimersByTime(5000)
    expect(store.toasts).toHaveLength(0)
  })

  it('reset clears all toasts and pending timers', () => {
    const store = useToastStore()
    store.add('One')
    store.add('Two')
    expect(store.toasts).toHaveLength(2)
    store.reset()
    expect(store.toasts).toHaveLength(0)
    vi.advanceTimersByTime(10000)
    expect(store.toasts).toHaveLength(0)
  })

  it('multiple toasts each auto-dismiss independently', () => {
    const store = useToastStore()
    store.add('First')
    vi.advanceTimersByTime(2000)
    store.add('Second')
    vi.advanceTimersByTime(3000)
    expect(store.toasts).toHaveLength(1)
    expect(store.toasts[0].message).toBe('Second')
    vi.advanceTimersByTime(2000)
    expect(store.toasts).toHaveLength(0)
  })
})
