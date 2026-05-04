<template>
  <div class="new-list">
    <h1>New List</h1>
    <form class="new-list__form" @submit.prevent="createList">
      <div class="new-list__container">
        <label for="name" class="sr-only">New List Name</label>
        <input v-model="name" required
               ref="newListName"
               class="new-list__input"
               type="text" id="name" placeholder="List Name">

        <button type="submit" class="new-list__button">Create</button>
      </div>
    </form>

    <router-link :to="{ name: 'Lists' }" class="new-list__cancel">Cancel</router-link>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import List from '@/classes/List'
import { useListsStore } from '@/stores/lists'

const router = useRouter()
const listsStore = useListsStore()

const name = ref<string | null>(null)
const newListName = ref<HTMLInputElement | null>(null)

function createList (): void {
  listsStore.createList(new List(name.value!, []))
  router.push({
    name: 'List',
    params: { id: listsStore.lists.at(-1)!.id }
  })
}

onMounted(() => {
  document.title = 'New List | Groceries List'
  newListName.value!.focus()
})
</script>

<style lang="scss">
@reference "../assets/main.css";

.new-list {
  @apply grid place-items-center;

  &__form {
    @apply flex justify-center items-center;
  }

  &__input {
    @apply relative w-56 bg-white px-3 py-2 rounded outline-none transition duration-200 ease-in-out border border-gl-gray mr-2;
    @apply dark:border-gl-deep-blue dark:bg-gl-deep-blue/50 dark:text-gray-200;

    &:hover, &:focus {
      @apply ring-4 ring-gl-blueberry/50 z-10;
    }
  }

  &__button {
    @apply relative bg-gl-lightgreen px-3 py-2 rounded transition duration-200 ease-in-out border border-gl-green outline-none text-gray-800;
    @apply dark:bg-gl-green dark:border-gl-lightgreen dark:text-gray-200;

    &:hover, &:focus {
      @apply bg-green-300 ring-4 ring-gl-lightgreen/50 z-10;
      @apply dark:ring-gl-green/30 dark:bg-green-800;
    }
  }

  &__cancel {
    @apply mt-6 underline;
  }
}
</style>
