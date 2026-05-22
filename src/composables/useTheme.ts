import { ref, readonly } from 'vue'

export type ThemeMode = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'theme-mode'
const CYCLE: ThemeMode[] = ['light', 'dark', 'system']

const mode = ref<ThemeMode>('system')
let mq: MediaQueryList | null = null
let initialized = false

function apply (m: ThemeMode) {
  const isDark = m === 'dark' || (m === 'system' && (mq?.matches ?? false))
  document.documentElement.classList.toggle('dark', isDark)
}

function onMediaChange (e: MediaQueryListEvent) {
  if (mode.value === 'system') {
    document.documentElement.classList.toggle('dark', e.matches)
  }
}

function setMode (m: ThemeMode) {
  mode.value = m
  try {
    localStorage.setItem(STORAGE_KEY, m)
  } catch (err) {
    console.warn('[useTheme] failed to persist mode', err)
  }
  apply(m)
}

function cycleMode () {
  const idx = CYCLE.indexOf(mode.value)
  setMode(CYCLE[(idx + 1) % CYCLE.length])
}

function init () {
  if (initialized) return
  initialized = true
  mq = window.matchMedia('(prefers-color-scheme: dark)')
  mq.addEventListener('change', onMediaChange)
  const stored = localStorage.getItem(STORAGE_KEY) as ThemeMode | null
  mode.value = stored && CYCLE.includes(stored) ? stored : 'system'
  apply(mode.value)
}

function cleanup () {
  if (!initialized) return
  mq?.removeEventListener('change', onMediaChange)
  mq = null
  initialized = false
}

export function useTheme () {
  return { mode: readonly(mode), setMode, cycleMode, init, cleanup }
}
