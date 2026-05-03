<template>
  <div v-if="lists.length" class="lists">
    <div v-for="list in lists" :key="list.id" class="list__container">
      <router-link class="list"
                   :to="{ name: 'List', params: { id: list.id } }">
        <span>{{ list.n }}</span>
        <button :title="'Delete your ' + list.n + ' list.'"
                @click.prevent="deleteList(list)"
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
</template>

<script>
import { mapStores } from 'pinia'
import { useListsStore } from '@/stores/lists'

export default {
  computed: {
    ...mapStores(useListsStore),
    lists () {
      return this.listsStore.lists
    }
  },
  methods: {
    deleteList (list) {
      if (confirm('Are you sure you want to delete your ' + list.n + ' list?')) {
        this.listsStore.deleteList(list.id)
      }
    }
  },
  mounted () {
    document.title = 'My Lists | Groceries List'
  }
}
</script>

<style lang="scss">
.list {
  @apply flex justify-start items-center px-4 py-3 bg-white rounded border border-gl-gray w-full font-bold text-lg transition duration-200 ease-in-out;
  @apply dark:bg-gl-darkblue dark:border-gl-deep-blue;

  &:hover, &:focus {
    @apply bg-blue-50 border-blue-300 ring-2 ring-blue-300 ring-opacity-50 outline-none;
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
      @apply text-xl ml-auto transition duration-200 ease-in-out;

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
