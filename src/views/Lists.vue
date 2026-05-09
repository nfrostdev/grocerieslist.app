<template>
  <div>
    <div v-if="lists.length" class="lists">
      <div v-for="list in lists" :key="list.id" class="list__container">
        <router-link class="list"
                     :to="{ name: 'List', params: { id: list.id } }">
          <span>{{ list.n }}</span>
          <button :aria-label="`Delete your ${list.n} list`"
                  @click.prevent="requestDelete(list)"
                  class="list__icon--delete">
            <font-awesome-icon icon="times-circle"/>
          </button>
        </router-link>
      </div>
    </div>
    <div v-else class="no-lists">
      <span>You have no lists, </span>
      <router-link :to="{ name: 'New' }" class="no-lists__link">create one</router-link>
      <span>!</span>
    </div>

    <ConfirmModal v-if="pendingDelete"
                  :open="!!pendingDelete"
                  title="Delete list?"
                  :message="`Are you sure you want to delete your ${pendingDelete.n} list?`"
                  variant="destructive"
                  confirm-label="Delete"
                  @confirm="confirmDelete"
                  @update:open="onModalOpenChange"/>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useListsStore } from '@/stores/lists'
import ConfirmModal from '@/components/ConfirmModal.vue'
import type List from '@/classes/List'
import * as sync from '@/sync'

const listsStore = useListsStore()
const lists = computed(() => listsStore.lists)
const pendingDelete = ref<List | null>(null)

function requestDelete (list: List): void {
  pendingDelete.value = list
}

async function confirmDelete (): Promise<void> {
  if (!pendingDelete.value) return
  const id = pendingDelete.value.id
  pendingDelete.value = null

  const meta = sync.getMeta(id)
  if (meta) {
    if (meta.role === 'owner') {
      await sync.deleteList(id)
    } else {
      sync.leaveList(id)
    }
  } else {
    listsStore.deleteList(id)
  }
}

function onModalOpenChange (value: boolean): void {
  if (!value) pendingDelete.value = null
}

onMounted(() => {
  document.title = 'My Lists | Groceries List'
})
</script>

<style lang="scss">
@reference "../assets/main.css";

.list {
  @apply flex justify-start items-center px-4 py-3 bg-white rounded border border-gl-gray w-full font-bold text-lg transition duration-200 ease-in-out;
  @apply dark:bg-gl-darkblue dark:border-gl-deep-blue;

  &:hover, &:focus {
    @apply bg-blue-50 border-blue-300 ring-2 ring-blue-300/50 outline-none;
    @apply dark:bg-gl-deep-blue dark:border-gl-darkblue dark:ring-gl-darkblue;
  }

  &__container {
    @apply flex justify-center items-center;
  }

  &s {
    @apply grid w-full gap-4;
  }

  &__icon {
    &--delete {
      @apply text-xl ml-auto transition duration-200 ease-in-out min-w-[44px] min-h-[44px] flex items-center justify-center;

      &:hover, &:focus {
        @apply text-red-700;
      }
    }
  }
}

.no-lists {
  @apply text-center;

  &__link {
    @apply underline font-medium;
  }
}
</style>
