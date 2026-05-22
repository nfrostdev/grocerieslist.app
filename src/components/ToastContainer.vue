<template>
  <dialog ref="dialogEl" class="toast-container" aria-label="Notifications">
    <div v-for="toast in toastStore.toasts"
         :key="toast.id"
         class="toast"
         :class="toast.type === 'error' ? 'toast--error' : 'toast--info'">
      <span class="toast__message">{{ toast.message }}</span>
      <button type="button"
              class="toast__close"
              :aria-label="`Dismiss: ${toast.message}`"
              @click="toastStore.dismiss(toast.id)">
        <font-awesome-icon icon="times-circle"/>
      </button>
    </div>
  </dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useToastStore } from '@/stores/toast'

const toastStore = useToastStore()
const dialogEl = ref<HTMLDialogElement | null>(null)

// A <dialog> opened with .show() is promoted to the browser's top layer,
// which sits above any z-index — including ::backdrop and other dialogs.
// Re-opening on every toast count change brings the toasts back to the top
// of the top-layer stack so a later showModal() (ShareSheet, ConfirmModal)
// cannot bury them.
watch(() => toastStore.toasts.length, (n) => {
  const dlg = dialogEl.value
  if (!dlg) return
  if (dlg.open) dlg.close()
  if (n > 0) dlg.show()
})
</script>

<style lang="scss">
@reference "../assets/main.css";

.toast-container {
  // Reset UA dialog chrome — we just want the top-layer promotion.
  @apply m-0 border-0 bg-transparent p-0;
  @apply fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex-col gap-2 items-center pointer-events-none w-full max-w-sm px-4;
  // dialog defaults to display: none; only flex when open.
  display: none;

  &[open] {
    @apply flex;
  }
}

.toast {
  @apply flex items-center justify-between gap-3 w-full rounded-lg px-4 py-3 shadow-lg pointer-events-auto;

  &--error {
    @apply bg-red-600 text-white;
  }

  &--info {
    @apply bg-gl-darkblue text-white;
    @apply dark:bg-white dark:text-gl-darkblue;
  }

  &__message {
    @apply text-sm font-medium;
  }

  &__close {
    @apply text-lg shrink-0 opacity-80 hover:opacity-100 focus:opacity-100 focus:outline-none;
  }
}
</style>
