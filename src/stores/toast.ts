import { ref } from 'vue'
import { defineStore } from 'pinia'
import { useLiveRegion } from '@/composables/useLiveRegion'

interface Toast {
  id: number
  message: string
  type: 'info' | 'error'
}

export const useToastStore = defineStore('toast', () => {
  const toasts = ref<Toast[]>([])
  let nextId = 0

  function add (message: string, type: Toast['type'] = 'info'): void {
    const id = nextId++
    toasts.value.push({ id, message, type })
    useLiveRegion().announce(message)
    setTimeout(() => dismiss(id), 5000)
  }

  function dismiss (id: number): void {
    const idx = toasts.value.findIndex(t => t.id === id)
    if (idx !== -1) toasts.value.splice(idx, 1)
  }

  return { toasts, add, dismiss }
})
