<template>
  <!-- eslint-disable-next-line vuejs-accessibility/click-events-have-key-events, vuejs-accessibility/no-static-element-interactions -->
  <dialog ref="dialog"
          class="confirm-modal"
          :aria-labelledby="titleId"
          :aria-describedby="messageId"
          @click="onBackdropClick"
          @close="onCancel">
    <div class="confirm-modal__panel" @click.stop>
      <h2 :id="titleId" class="confirm-modal__title">{{ title }}</h2>
      <p :id="messageId" class="confirm-modal__message">{{ message }}</p>

      <div class="confirm-modal__actions">
        <button type="button"
                class="confirm-modal__button"
                @click="onCancel">
          {{ cancelLabel }}
        </button>
        <button type="button"
                class="confirm-modal__button"
                :class="variant === 'destructive' ? 'confirm-modal__button--destructive' : 'confirm-modal__button--primary'"
                @click="onConfirm">
          {{ confirmLabel }}
        </button>
      </div>
    </div>
  </dialog>
</template>

<script setup lang="ts">
import { onMounted, ref, useId, watch } from 'vue'

const props = withDefaults(defineProps<{
  open: boolean
  title: string
  message: string
  variant?: 'primary' | 'destructive'
  confirmLabel?: string
  cancelLabel?: string
}>(), {
  variant: 'primary',
  confirmLabel: 'Confirm',
  cancelLabel: 'Cancel'
})

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()

const dialog = ref<HTMLDialogElement | null>(null)
const titleId = useId()
const messageId = useId()

function onConfirm () {
  emit('confirm')
  emit('update:open', false)
}

function onCancel () {
  emit('cancel')
  emit('update:open', false)
}

function onBackdropClick (event: MouseEvent) {
  if (event.target === dialog.value) onCancel()
}

onMounted(() => {
  if (props.open) dialog.value?.showModal()
})

watch(() => props.open, (isOpen) => {
  if (isOpen && !dialog.value?.open) dialog.value?.showModal()
  else if (!isOpen && dialog.value?.open) dialog.value.close()
})
</script>

<style lang="scss">
@reference "../assets/main.css";

.confirm-modal {
  @apply m-auto w-full max-w-sm rounded-lg border border-gl-gray bg-white p-0 text-gl-darkblue shadow-lg;
  @apply dark:border-gl-deep-blue dark:bg-gl-darkblue dark:text-white;

  &::backdrop {
    @apply bg-black/50;
  }

  &__panel {
    @apply p-6;
  }

  &__title {
    @apply text-lg font-bold mb-3;
  }

  &__message {
    @apply text-sm mb-4;
  }

  &__actions {
    @apply grid gap-2;
  }

  &__button {
    @apply w-full py-3 px-4 rounded border border-gl-gray font-medium transition duration-200 ease-in-out;
    @apply dark:bg-gl-deep-blue/50 dark:border-gl-deep-blue;

    &:hover, &:focus {
      @apply bg-blue-50 border-blue-300 ring-2 ring-blue-300/50 outline-none;
      @apply dark:bg-gl-deep-blue dark:border-gl-darkblue dark:ring-gl-darkblue;
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
      @apply dark:bg-red-700 dark:border-red-800 dark:text-white;

      &:hover, &:focus {
        @apply bg-red-700 ring-4 ring-red-400/50 border-red-700;
        @apply dark:bg-red-800 dark:ring-red-500/30 dark:border-red-800;
      }
    }
  }
}
</style>
