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

      <div v-if="state === 'loading'" class="share-sheet__loading">Setting up…</div>

      <div v-else-if="state === 'error'" class="share-sheet__error">
        Could not create shared list. Check your connection and try again.
      </div>

      <template v-else-if="state === 'sharing'">
        <div class="share-sheet__qr" v-html="qrSvg"/>
        <div class="share-sheet__actions">
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
          <button v-if="isOwner"
                  type="button"
                  class="share-sheet__button share-sheet__button--secondary"
                  :disabled="stopping"
                  @click="onStopSharing">
            {{ stopping ? 'Revoking…' : 'Stop sharing' }}
          </button>
        </div>
      </template>

      <template v-else-if="state === 'not-sharing'">
        <p class="share-sheet__hint">Sharing is off. Enable it to let others join with a link.</p>
        <div class="share-sheet__actions">
          <button type="button"
                  class="share-sheet__button share-sheet__button--primary"
                  :disabled="enabling"
                  @click="onEnableSharing">
            {{ enabling ? 'Generating…' : 'Enable sharing' }}
          </button>
        </div>
      </template>

      <div v-if="isOwner && state !== 'loading'" class="share-sheet__danger-zone">
        <button type="button"
                class="share-sheet__button share-sheet__button--destructive"
                @click="confirmDelete">
          Delete shared list…
        </button>
      </div>
    </div>
  </dialog>

  <confirm-modal v-model:open="confirmOpen"
                 title="Delete shared list"
                 :message="`Delete &quot;${list.n}&quot;? All devices will lose access and the list will be removed everywhere.`"
                 variant="destructive"
                 confirm-label="Delete"
                 @confirm="onDeleteConfirmed"/>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import type List from '@/classes/List'
import { useLiveRegion } from '@/composables/useLiveRegion'
import ConfirmModal from '@/components/ConfirmModal.vue'
import * as sync from '@/sync'

const props = defineProps<{ open: boolean; list: List }>()
const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'provisioned', listId: string): void
  (e: 'deleted'): void
}>()

const dialog = ref<HTMLDialogElement | null>(null)
const state = ref<'loading' | 'sharing' | 'not-sharing' | 'error'>('loading')
const qrSvg = ref('')
const joinUrl = ref('')
const copied = ref(false)
const stopping = ref(false)
const enabling = ref(false)
const confirmOpen = ref(false)
const canWebShare = ref(typeof navigator !== 'undefined' && typeof navigator.share === 'function')
const { announce } = useLiveRegion()

let copyTimer: ReturnType<typeof setTimeout> | null = null
let provisionedListId: string | null = null

const isOwner = computed(() => sync.getMeta(props.list.id)?.role === 'owner')

async function build () {
  state.value = 'loading'
  qrSvg.value = ''
  joinUrl.value = ''
  copied.value = false

  const capturedList = props.list

  if (!sync.isSynced(capturedList.id)) {
    const result = await sync.provision(capturedList)
    if (!result) {
      state.value = 'error'
      return
    }
    provisionedListId = result.listId
    // Auto-enable sharing immediately after provisioning
    const url = await sync.enableSharing(capturedList.id)
    if (url) await showShareLink(url)
    else state.value = 'error'
    return
  }

  provisionedListId = null
  const meta = sync.getMeta(capturedList.id)

  if (meta?.role === 'owner') {
    if (meta.shareToken) {
      await showShareLink(`${window.location.origin}/#join=${capturedList.id}.${meta.shareToken}`)
    } else {
      state.value = 'not-sharing'
    }
  } else {
    // Editor: show their own join link
    const token = meta?.authToken ?? ''
    await showShareLink(`${window.location.origin}/#join=${capturedList.id}.${token}`)
  }
}

async function showShareLink (url: string) {
  joinUrl.value = url
  const qrcodeMod = await import('qrcode')
  const QRCode = qrcodeMod.default ?? qrcodeMod
  qrSvg.value = await QRCode.toString(url, {
    type: 'svg',
    margin: 1,
    color: { dark: '#111827', light: '#ffffff' }
  })
  state.value = 'sharing'
}

async function onEnableSharing () {
  enabling.value = true
  const url = await sync.enableSharing(props.list.id)
  enabling.value = false
  if (!url) {
    announce('Could not enable sharing — check your connection')
    return
  }
  await showShareLink(url)
}

async function onStopSharing () {
  stopping.value = true
  const ok = await sync.disableSharing(props.list.id)
  stopping.value = false
  if (!ok) {
    announce('Could not stop sharing — check your connection')
    return
  }
  qrSvg.value = ''
  joinUrl.value = ''
  state.value = 'not-sharing'
  announce('Sharing stopped — existing links no longer work')
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

function confirmDelete () {
  confirmOpen.value = true
}

async function onDeleteConfirmed () {
  const ok = await sync.deleteList(props.list.id)
  if (ok) {
    close()
    emit('deleted')
  } else {
    announce('Could not delete — check your connection')
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
  &__hint {
    @apply text-center py-8 text-sm;
  }

  &__hint {
    @apply py-4 text-gray-500 dark:text-gray-400;
  }

  &__error {
    @apply bg-blue-50 rounded p-4 text-gl-darkblue text-sm;
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

  &__danger-zone {
    @apply mt-4 pt-4 border-t border-gl-gray;
    @apply dark:border-gl-deep-blue;
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

    &--secondary {
      @apply text-gray-600 dark:text-gray-300;
    }

    &--destructive {
      @apply bg-red-600 border-red-700 text-white;
      @apply dark:bg-red-700 dark:border-red-800;

      &:hover, &:focus {
        @apply bg-red-700 ring-4 ring-red-400/50 border-red-700;
        @apply dark:bg-red-800 dark:ring-red-500/30 dark:border-red-800;
      }
    }
  }
}
</style>
