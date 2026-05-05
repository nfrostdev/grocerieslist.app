import { ref } from 'vue'

const message = ref('')
let clearTimer: ReturnType<typeof setTimeout> | null = null

export function useLiveRegion () {
  function announce (text: string) {
    if (clearTimer) clearTimeout(clearTimer)
    message.value = ''
    // Reset then set forces screen readers to re-announce identical strings
    requestAnimationFrame(() => {
      message.value = text
      clearTimer = setTimeout(() => { message.value = '' }, 3000)
    })
  }

  return { message, announce }
}
