<template>
  <!-- eslint-disable-next-line vuejs-accessibility/click-events-have-key-events, vuejs-accessibility/no-static-element-interactions -->
  <dialog ref="dialog"
          class="share-sheet"
          aria-labelledby="share-sheet-title"
          @click="onBackdropClick"
          @close="onClose">
    <div class="share-sheet__panel" @click.stop>
      <div class="share-sheet__header">
        <h2 id="share-sheet-title" class="share-sheet__title">Share "{{ list.n }}"</h2>
        <button type="button"
                class="share-sheet__close"
                aria-label="Close share sheet"
                @click="close">
          <font-awesome-icon icon="times-circle"/>
        </button>
      </div>

      <div v-if="state === 'loading'" class="share-sheet__loading">Setting up shared list…</div>

      <div v-else-if="state === 'error'" class="share-sheet__too-large">
        Could not create shared list. Check your connection and try again.
      </div>

      <div v-else-if="state === 'ready'" class="share-sheet__qr" v-html="qrSvg"/>

      <div v-if="state === 'ready'" class="share-sheet__actions">
        <button v-if="canWebShare"
                type="button"
                class="share-sheet__button share-sheet__button--primary"
                @click="onShare">
          Share link…
        </button>
        <button type="button"
                class="share-sheet__button"
                @click="onCopy">
          {{ copied ? 'Copied!' : 'Copy link' }}
        </button>
      </div>
    </div>
  </dialog>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import type List from '@/classes/List'
import { useLiveRegion } from '@/composables/useLiveRegion'
import * as sync from '@/sync'

const props = defineProps<{ open: boolean; list: List }>()
const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'provisioned', listId: string): void
}>()

const dialog = ref<HTMLDialogElement | null>(null)
const state = ref<'loading' | 'ready' | 'error'>('loading')
const qrSvg = ref('')
const joinUrl = ref('')
const copied = ref(false)
const canWebShare = ref(typeof navigator !== 'undefined' && typeof navigator.share === 'function')
const { announce } = useLiveRegion()

let copyTimer: ReturnType<typeof setTimeout> | null = null
let provisionedListId: string | null = null

async function build () {
  state.value = 'loading'
  qrSvg.value = ''
  joinUrl.value = ''
  copied.value = false

  const capturedList = props.list

  if (sync.isSynced(capturedList.id)) {
    const meta = sync.getMeta(capturedList.id)!
    joinUrl.value = `${window.location.origin}/#join=${capturedList.id}.${meta.authToken}`
    provisionedListId = null
  } else {
    const result = await sync.provision(capturedList)
    if (!result) {
      state.value = 'error'
      return
    }
    joinUrl.value = result.joinUrl
    provisionedListId = result.listId
  }

  const qrcodeMod = await import('qrcode')
  const QRCode = qrcodeMod.default ?? qrcodeMod
  qrSvg.value = await QRCode.toString(joinUrl.value, {
    type: 'svg',
    margin: 1,
    color: { dark: '#111827', light: '#ffffff' }
  })
  state.value = 'ready'
}

function close () {
  dialog.value?.close()
}

function onClose () {
  if (provisionedListId) {
    emit('provisioned', provisionedListId)
    provisionedListId = null
  }
  emit('update:open', false)
}

function onBackdropClick (event: MouseEvent) {
  if (event.target === dialog.value) close()
}

async function onShare () {
  if (!joinUrl.value) return
  try {
    await navigator.share({
      url: joinUrl.value,
      title: `Groceries List: ${props.list.n}`,
      text: `Check out my "${props.list.n}" list`
    })
  } catch {
    // User cancelled or share unavailable; no-op.
  }
}

async function onCopy () {
  if (!joinUrl.value) return
  try {
    await navigator.clipboard.writeText(joinUrl.value)
    copied.value = true
    announce('Link copied to clipboard')
    if (copyTimer) clearTimeout(copyTimer)
    copyTimer = setTimeout(() => { copied.value = false }, 2000)
  } catch {
    announce('Could not copy link')
  }
}

onMounted(async () => {
  if (props.open) {
    dialog.value?.showModal()
    await build()
  }
})

watch(() => props.open, async (isOpen) => {
  if (isOpen) {
    if (!dialog.value?.open) dialog.value?.showModal()
    await build()
  } else if (dialog.value?.open) {
    dialog.value.close()
  }
})

onUnmounted(() => {
  if (copyTimer) clearTimeout(copyTimer)
})
</script>

<style lang="scss">
@reference "../assets/main.css";

.share-sheet {
  @apply m-auto w-full max-w-sm rounded-lg border border-gl-gray bg-white p-0 text-gl-darkblue shadow-lg;
  @apply dark:border-gl-deep-blue dark:bg-gl-darkblue dark:text-white;

  &::backdrop {
    @apply bg-black/50;
  }

  &__panel {
    @apply p-6;
  }

  &__header {
    @apply flex items-start justify-between mb-4;
  }

  &__title {
    @apply text-lg font-bold;
  }

  &__close {
    @apply text-xl min-w-[44px] min-h-[44px] flex items-center justify-center -mr-2 -mt-2;

    &:hover, &:focus {
      @apply text-red-700 outline-none;
    }
  }

  &__loading,
  &__too-large {
    @apply text-center py-8 text-sm;
  }

  &__too-large {
    @apply bg-blue-50 rounded p-4 text-gl-darkblue;
    @apply dark:bg-gl-deep-blue/50 dark:text-white;
  }

  &__qr {
    @apply bg-white p-4 rounded mx-auto;

    svg {
      @apply w-full h-auto block;
    }
  }

  &__actions {
    @apply mt-4 grid gap-2;
  }

  &__button {
    @apply w-full py-3 px-4 rounded border border-gl-gray font-medium transition duration-200 ease-in-out;
    @apply dark:bg-gl-deep-blue/50 dark:border-gl-deep-blue;

    &:hover, &:focus {
      @apply bg-blue-50 border-blue-300 ring-2 ring-blue-300/50 outline-none;
      @apply dark:bg-gl-deep-blue dark:border-gl-darkblue dark:ring-gl-darkblue;
    }

    &:disabled {
      @apply opacity-50 cursor-not-allowed;
    }

    &--primary {
      @apply bg-gl-lightgreen border-gl-green text-gray-800;
      @apply dark:bg-gl-green dark:border-gl-lightgreen dark:text-gray-200;

      &:hover, &:focus {
        @apply bg-green-300 ring-4 ring-gl-lightgreen/50 border-gl-green;
        @apply dark:bg-green-800 dark:ring-gl-green/30 dark:border-gl-lightgreen;
      }
    }
  }
}
</style>
