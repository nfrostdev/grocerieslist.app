<template>
  <div class="toast-container">
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
  </div>
</template>

<script setup lang="ts">
import { useToastStore } from '@/stores/toast'

const toastStore = useToastStore()
</script>

<style lang="scss">
@reference "../assets/main.css";

.toast-container {
  @apply fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center pointer-events-none w-full max-w-sm px-4;
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
