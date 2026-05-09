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

      <div v-if="isOwner" class="share-sheet__tabs" role="tablist">
        <button role="tab"
                :aria-selected="activeTab === 'share'"
                class="share-sheet__tab"
                :class="{ 'share-sheet__tab--active': activeTab === 'share' }"
                @click="activeTab = 'share'">
          Share
        </button>
        <button role="tab"
                :aria-selected="activeTab === 'manage'"
                class="share-sheet__tab"
                :class="{ 'share-sheet__tab--active': activeTab === 'manage' }"
                @click="activeTab = 'manage'">
          Manage
        </button>
      </div>

      <!-- Share tab -->
      <template v-if="activeTab === 'share'">
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
      </template>

      <!-- Manage tab (owner only) -->
      <template v-else-if="activeTab === 'manage'">
        <div class="share-sheet__manage">

          <!-- Original join link -->
          <div class="share-sheet__section">
            <h3 class="share-sheet__section-title">Original join link</h3>
            <p class="share-sheet__section-desc">Multi-use — anyone with this link can join as an editor.</p>
            <button type="button"
                    class="share-sheet__button"
                    @click="copyOriginalLink">
              {{ copiedOriginal ? 'Copied!' : 'Copy original link' }}
            </button>
          </div>

          <!-- Minted editor links -->
          <div class="share-sheet__section">
            <h3 class="share-sheet__section-title">
              Editor links
              <span v-if="editorTokens.length" class="share-sheet__count">({{ editorTokens.length }})</span>
            </h3>

            <div v-if="editorTokens.length === 0" class="share-sheet__empty">
              No individual editor links yet.
            </div>

            <ul v-else class="share-sheet__token-list">
              <li v-for="et in editorTokens" :key="et.hash" class="share-sheet__token-item">
                <span class="share-sheet__token-label">{{ et.label }}</span>
                <button type="button"
                        class="share-sheet__token-action"
                        :aria-label="`Copy link for ${et.label}`"
                        @click="copyEditorLink(et)">
                  <font-awesome-icon icon="copy"/>
                </button>
                <button type="button"
                        class="share-sheet__token-action share-sheet__token-action--revoke"
                        :aria-label="`Revoke link for ${et.label}`"
                        :disabled="revoking === et.hash"
                        @click="confirmRevoke(et)">
                  <font-awesome-icon :icon="revoking === et.hash ? 'spinner' : 'ban'"/>
                </button>
              </li>
            </ul>

            <!-- Mint flow -->
            <div v-if="mintState === 'idle'" class="share-sheet__mint-trigger">
              <button type="button"
                      class="share-sheet__button"
                      @click="mintState = 'entering-label'">
                + Add editor link
              </button>
            </div>

            <div v-else-if="mintState === 'entering-label'" class="share-sheet__mint-form">
              <label for="mint-label" class="share-sheet__mint-label-text">Label (e.g. "Sarah's phone")</label>
              <input id="mint-label"
                     v-model="mintLabel"
                     class="share-sheet__mint-input"
                     type="text"
                     placeholder="Device or person name"
                     @keydown.enter.prevent="generateEditorLink"
                     @keydown.escape="mintState = 'idle'"/>
              <div class="share-sheet__mint-actions">
                <button type="button" class="share-sheet__button" @click="mintState = 'idle'">Cancel</button>
                <button type="button"
                        class="share-sheet__button share-sheet__button--primary"
                        :disabled="!mintLabel.trim()"
                        @click="generateEditorLink">
                  Generate
                </button>
              </div>
            </div>

            <div v-else-if="mintState === 'generating'" class="share-sheet__loading">
              Generating link…
            </div>

            <div v-else-if="mintState === 'showing-link'" class="share-sheet__mint-result">
              <p class="share-sheet__mint-result-title">Link for "{{ mintLabel }}"</p>
              <div class="share-sheet__qr" v-html="mintQrSvg"/>
              <button type="button"
                      class="share-sheet__button"
                      @click="copyMintedLink">
                {{ copiedMinted ? 'Copied!' : 'Copy link' }}
              </button>
              <button type="button"
                      class="share-sheet__button share-sheet__button--primary"
                      @click="doneMinting">
                Done
              </button>
            </div>
          </div>

          <!-- Delete list -->
          <div class="share-sheet__section share-sheet__section--danger">
            <button type="button"
                    class="share-sheet__button share-sheet__button--destructive"
                    @click="confirmDelete">
              Delete shared list…
            </button>
          </div>
        </div>
      </template>
    </div>
  </dialog>

  <confirm-modal v-model:open="confirmOpen"
                 :title="confirmTitle"
                 :message="confirmMessage"
                 variant="destructive"
                 :confirm-label="confirmLabel"
                 @confirm="onConfirmed"/>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import type List from '@/classes/List'
import { useLiveRegion } from '@/composables/useLiveRegion'
import ConfirmModal from '@/components/ConfirmModal.vue'
import * as sync from '@/sync'
import type { EditorToken } from '@/sync/types'

const props = defineProps<{ open: boolean; list: List }>()
const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'provisioned', listId: string): void
  (e: 'deleted'): void
}>()

const dialog = ref<HTMLDialogElement | null>(null)
const state = ref<'loading' | 'ready' | 'error'>('loading')
const activeTab = ref<'share' | 'manage'>('share')
const qrSvg = ref('')
const joinUrl = ref('')
const copied = ref(false)
const copiedOriginal = ref(false)
const canWebShare = ref(typeof navigator !== 'undefined' && typeof navigator.share === 'function')
const { announce } = useLiveRegion()

// Manage tab state
const editorTokens = computed<EditorToken[]>(() =>
  sync.getMeta(props.list.id)?.editorTokens ?? []
)
const isOwner = computed(() => sync.getMeta(props.list.id)?.role === 'owner')
const revoking = ref<string | null>(null)

// Mint flow
const mintState = ref<'idle' | 'entering-label' | 'generating' | 'showing-link'>('idle')
const mintLabel = ref('')
const mintQrSvg = ref('')
const mintedJoinUrl = ref('')
const copiedMinted = ref(false)

// Confirm modal
const confirmOpen = ref(false)
const confirmTitle = ref('')
const confirmMessage = ref('')
const confirmLabel = ref('Confirm')
let pendingConfirmAction: (() => Promise<void>) | null = null

let copyTimer: ReturnType<typeof setTimeout> | null = null
let copyOriginalTimer: ReturnType<typeof setTimeout> | null = null
let copyMintedTimer: ReturnType<typeof setTimeout> | null = null
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
  mintState.value = 'idle'
  mintLabel.value = ''
  mintQrSvg.value = ''
  mintedJoinUrl.value = ''
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

async function copyOriginalLink () {
  if (!joinUrl.value) return
  try {
    await navigator.clipboard.writeText(joinUrl.value)
    copiedOriginal.value = true
    announce('Original link copied to clipboard')
    if (copyOriginalTimer) clearTimeout(copyOriginalTimer)
    copyOriginalTimer = setTimeout(() => { copiedOriginal.value = false }, 2000)
  } catch {
    announce('Could not copy link')
  }
}

async function copyEditorLink (et: EditorToken) {
  const url = `${window.location.origin}/#join=${props.list.id}.${et.token}`
  try {
    await navigator.clipboard.writeText(url)
    announce(`Link for ${et.label} copied`)
  } catch {
    announce('Could not copy link')
  }
}

async function generateEditorLink () {
  if (!mintLabel.value.trim()) return
  mintState.value = 'generating'

  const result = await sync.mintEditorToken(props.list.id, mintLabel.value.trim())
  if (!result) {
    mintState.value = 'idle'
    announce('Could not generate editor link')
    return
  }

  mintedJoinUrl.value = result.joinUrl
  const qrcodeMod = await import('qrcode')
  const QRCode = qrcodeMod.default ?? qrcodeMod
  mintQrSvg.value = await QRCode.toString(result.joinUrl, {
    type: 'svg',
    margin: 1,
    color: { dark: '#111827', light: '#ffffff' }
  })
  mintState.value = 'showing-link'
}

async function copyMintedLink () {
  if (!mintedJoinUrl.value) return
  try {
    await navigator.clipboard.writeText(mintedJoinUrl.value)
    copiedMinted.value = true
    announce('Editor link copied to clipboard')
    if (copyMintedTimer) clearTimeout(copyMintedTimer)
    copyMintedTimer = setTimeout(() => { copiedMinted.value = false }, 2000)
  } catch {
    announce('Could not copy link')
  }
}

function doneMinting () {
  mintState.value = 'idle'
  mintLabel.value = ''
  mintQrSvg.value = ''
  mintedJoinUrl.value = ''
  copiedMinted.value = false
}

function confirmRevoke (et: EditorToken) {
  confirmTitle.value = 'Revoke editor link'
  confirmMessage.value = `Revoke access for "${et.label}"? Their link will stop working immediately.`
  confirmLabel.value = 'Revoke'
  pendingConfirmAction = async () => {
    revoking.value = et.hash
    const ok = await sync.revokeEditorToken(props.list.id, et.hash)
    revoking.value = null
    if (ok) {
      announce(`Access for ${et.label} revoked`)
    } else {
      announce('Could not revoke — check your connection')
    }
  }
  confirmOpen.value = true
}

function confirmDelete () {
  confirmTitle.value = 'Delete shared list'
  confirmMessage.value = `Delete "${props.list.n}"? All devices will lose access and the list will be removed everywhere.`
  confirmLabel.value = 'Delete'
  pendingConfirmAction = async () => {
    const ok = await sync.deleteList(props.list.id)
    if (ok) {
      close()
      emit('deleted')
    } else {
      announce('Could not delete — check your connection')
    }
  }
  confirmOpen.value = true
}

async function onConfirmed () {
  if (pendingConfirmAction) {
    await pendingConfirmAction()
    pendingConfirmAction = null
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
    activeTab.value = 'share'
    await build()
  } else if (dialog.value?.open) {
    dialog.value.close()
  }
})

onUnmounted(() => {
  if (copyTimer) clearTimeout(copyTimer)
  if (copyOriginalTimer) clearTimeout(copyOriginalTimer)
  if (copyMintedTimer) clearTimeout(copyMintedTimer)
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

  &__tabs {
    @apply flex border-b border-gl-gray mb-4;
    @apply dark:border-gl-deep-blue;
  }

  &__tab {
    @apply px-4 py-2 text-sm font-medium border-b-2 border-transparent -mb-px transition-colors duration-150;

    &:hover {
      @apply text-gl-blueberry;
    }

    &--active {
      @apply border-gl-blueberry text-gl-blueberry;
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

    &--destructive {
      @apply bg-red-600 border-red-700 text-white;
      @apply dark:bg-red-700 dark:border-red-800;

      &:hover, &:focus {
        @apply bg-red-700 ring-4 ring-red-400/50 border-red-700;
        @apply dark:bg-red-800 dark:ring-red-500/30 dark:border-red-800;
      }
    }
  }

  &__manage {
    @apply flex flex-col gap-4;
  }

  &__section {
    @apply flex flex-col gap-2;

    &--danger {
      @apply pt-2 border-t border-gl-gray;
      @apply dark:border-gl-deep-blue;
    }
  }

  &__section-title {
    @apply text-sm font-semibold;
  }

  &__section-desc {
    @apply text-xs text-gray-500 dark:text-gray-400;
  }

  &__count {
    @apply font-normal text-gray-500 dark:text-gray-400;
  }

  &__empty {
    @apply text-xs text-gray-400 italic;
  }

  &__token-list {
    @apply flex flex-col gap-1 list-none p-0 m-0;
  }

  &__token-item {
    @apply flex items-center gap-2 py-1;
  }

  &__token-label {
    @apply text-sm flex-1 truncate;
  }

  &__token-action {
    @apply text-base p-1 rounded transition-colors duration-150 min-w-[32px] min-h-[32px] flex items-center justify-center;

    &:hover, &:focus {
      @apply bg-blue-50 outline-none;
      @apply dark:bg-gl-deep-blue;
    }

    &:disabled {
      @apply opacity-50 cursor-not-allowed;
    }

    &--revoke {
      &:hover, &:focus {
        @apply bg-red-50 text-red-600;
        @apply dark:bg-red-900/30;
      }
    }
  }

  &__mint-trigger {
    @apply mt-1;
  }

  &__mint-form {
    @apply flex flex-col gap-2 mt-1;
  }

  &__mint-label-text {
    @apply text-xs font-medium;
  }

  &__mint-input {
    @apply px-3 py-2 rounded border border-gl-gray text-sm outline-none transition duration-200;
    @apply dark:border-gl-deep-blue dark:bg-gl-deep-blue/50 dark:text-gray-200;

    &:focus {
      @apply ring-2 ring-blue-300/50 border-blue-300;
    }
  }

  &__mint-actions {
    @apply grid grid-cols-2 gap-2;
  }

  &__mint-result {
    @apply flex flex-col gap-2 mt-1;
  }

  &__mint-result-title {
    @apply text-xs font-medium text-center;
  }
}
</style>
