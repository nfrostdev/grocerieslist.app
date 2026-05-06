<template>
  <!-- eslint-disable-next-line vuejs-accessibility/click-events-have-key-events, vuejs-accessibility/no-static-element-interactions -->
  <dialog ref="dialog"
          class="import-modal"
          aria-labelledby="import-modal-title"
          @click="onBackdropClick"
          @close="onCancel">
    <div class="import-modal__panel" @click.stop>
      <h2 id="import-modal-title" class="import-modal__title">
        {{ existing ? 'Update existing list?' : 'Import shared list?' }}
      </h2>

      <p class="import-modal__meta">
        <strong>{{ incoming.n }}</strong>
        <span class="import-modal__count"> · {{ liveItemCount }} item<span v-if="liveItemCount !== 1">s</span></span>
      </p>

      <p v-if="existing" class="import-modal__warning">
        Choose how to handle the import.
      </p>

      <div class="import-modal__actions">
        <template v-if="existing">
          <button type="button"
                  class="import-modal__button import-modal__button--primary"
                  @click="emit('merge')">
            Merge
          </button>
          <button type="button"
                  class="import-modal__button"
                  @click="emit('replace')">
            Replace mine
          </button>
          <button type="button"
                  class="import-modal__button"
                  @click="emit('copy')">
            Import as copy
          </button>
        </template>
        <template v-else>
          <button type="button"
                  class="import-modal__button import-modal__button--primary"
                  @click="emit('replace')">
            Import
          </button>
        </template>
        <button type="button"
                class="import-modal__button import-modal__button--cancel"
                @click="onCancel">
          Cancel
        </button>
      </div>
    </div>
  </dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type List from '@/classes/List'

const props = defineProps<{
  open: boolean
  incoming: List
  existing: List | null
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'replace'): void
  (e: 'merge'): void
  (e: 'copy'): void
  (e: 'cancel'): void
}>()

const dialog = ref<HTMLDialogElement | null>(null)

const liveItemCount = computed(() => props.incoming.i.filter(it => !it.d).length)

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

.import-modal {
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

  &__meta {
    @apply mb-3 text-sm;
  }

  &__count {
    @apply text-gray-600;
    @apply dark:text-gray-400;
  }

  &__warning {
    @apply text-sm mb-3;
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

    &--cancel {
      @apply mt-2;
    }
  }
}
</style>
