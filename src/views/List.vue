<template>
  <div>
  <div v-if="list">
    <div class="list-header">
      <h1 class="list-header__title">{{ list.n }}</h1>
      <button type="button"
              :aria-label="`Share your ${list.n} list`"
              class="list-header__share"
              @click="openShare">
        <font-awesome-icon icon="share-nodes"/>
      </button>
    </div>

    <form class="new-item" @submit.prevent="addItemToList">
      <label for="name" class="sr-only">Item Name</label>
      <input v-model="name" required
             class="new-item__input"
             ref="itemName"
             type="text" id="name" placeholder="Item Name"/>

      <label for="quantity" class="sr-only">Quantity</label>
      <input v-model="quantity" required
             class="new-item__input new-item__input--number"
             min="1" max="2147483647"
             type="number" id="quantity"/>

      <button type="submit" class="new-item__button">Add</button>
    </form>

    <!-- Only display the list items if they are present and not all soft deleted. -->
    <div v-if="hasAnyItems" class="items">
      <div v-if="pendingItems.length === 0" class="all-checked">
        😃 You've checked off all your items, nice!
      </div>
      <list-item v-for="item in pendingItems"
                 :key="item.id"
                 :item="item"
                 :checked="false"
                 :name-ref="setItemNameRef(item.id)"
                 @toggle="toggleItemCheckedStatus(item.id)"
                 @delete="deleteItem(item.id)"
                 @update:name="modifyItemName($event, item.id)"
                 @update:quantity="modifyItemQuantity($event, item.id)"/>

      <h2 v-if="checkedItems.length" class="items__h2">Checked Items</h2>
      <list-item v-for="item in checkedItems"
                 :key="item.id"
                 :item="item"
                 :checked="true"
                 :name-ref="setItemNameRef(item.id)"
                 class="items__checked"
                 @toggle="toggleItemCheckedStatus(item.id)"
                 @delete="deleteItem(item.id)"
                 @update:name="modifyItemName($event, item.id)"
                 @update:quantity="modifyItemQuantity($event, item.id)"/>
    </div>
    <div v-if="!hasAnyItems" class="no-items">Add items to this list above.</div>
  </div>

  <share-sheet v-if="shareList"
               v-model:open="shareOpen"
               :list="shareList"
               @provisioned="onProvisioned"
               @deleted="onListDeleted"/>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, shallowRef, watch, onMounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Item from '@/classes/Item'
import { useListsStore } from '@/stores/lists'
import { useLiveRegion } from '@/composables/useLiveRegion'
import ListItem from '@/components/ListItem.vue'
import ShareSheet from '@/components/ShareSheet.vue'
import type List from '@/classes/List'

const route = useRoute()
const router = useRouter()
const listsStore = useListsStore()
const { announce } = useLiveRegion()

const listId = computed(() => route.params.id as string)
const list = computed(() => listsStore.getListFromId(listId.value))
const activeItems = computed(() => list.value?.i.filter(i => !i.d) ?? [])
const pendingItems = computed(() => activeItems.value.filter(i => !i.c))
const checkedItems = computed(() => activeItems.value.filter(i => i.c === 1))
const hasAnyItems = computed(() => activeItems.value.length > 0)
const name = ref<string | null>(null)
const quantity = ref<number>(1)
const itemName = ref<HTMLInputElement | null>(null)
const itemNameRefs: Record<string, HTMLInputElement | null> = {}
const setItemNameRef = (id: string) => (el: unknown) => {
  if (el) itemNameRefs[id] = el as HTMLInputElement
  else delete itemNameRefs[id]
}
const shareOpen = ref(false)
const shareList = shallowRef<List | null>(null)
const provisioning = ref(false)

watch([list, shareOpen, provisioning], ([currentList, isOpen, isProvisioning]) => {
  if (!currentList && !isOpen && !isProvisioning) router.replace({ name: 'Lists' })
})

function openShare () {
  if (list.value) {
    shareList.value = list.value
    shareOpen.value = true
  }
}

function onProvisioned (newListId: string) {
  provisioning.value = true
  router.replace({ name: 'List', params: { id: newListId } }).finally(() => {
    provisioning.value = false
  })
}

function onListDeleted () {
  router.replace({ name: 'Lists' })
}

function addItemToList (): void {
  const addedName = name.value!
  listsStore.addItem(listId.value, new Item(addedName, String(quantity.value)))
  name.value = null
  quantity.value = 1
  announce(`${addedName} added`)
  itemName.value!.focus()
}

function modifyItemQuantity (input: HTMLInputElement, id: string): void {
  const item = list.value!.i.find(i => i.id === id)
  if (!item) return
  const trimmed = input.value.trim()
  if (trimmed !== '' && !isNaN(Number(trimmed))) {
    listsStore.updateItem(listId.value, id, { q: trimmed })
  } else {
    input.value = item.q
  }
}

function modifyItemName (input: HTMLInputElement, id: string): void {
  if (input.value) {
    listsStore.updateItem(listId.value, id, { n: input.value })
  }
}

async function deleteItem (id: string): Promise<void> {
  const item = list.value!.i.find(i => i.id === id)
  if (!item) return
  const deletedName = item.n

  // Capture render-order snapshot BEFORE mutating so we can pick the
  // deleted item's neighbor deterministically.
  const renderOrder = [...pendingItems.value, ...checkedItems.value]
  const idx = renderOrder.findIndex(i => i.id === id)
  const neighbor = renderOrder[idx + 1] ?? renderOrder[idx - 1]

  listsStore.softDeleteItem(listId.value, id)
  announce(`${deletedName} removed`)
  await nextTick()

  const target = neighbor ? itemNameRefs[neighbor.id] : null
  if (target) target.focus()
  else itemName.value?.focus()
}

function toggleItemCheckedStatus (id: string): void {
  const item = list.value!.i.find(i => i.id === id)
  if (!item) return
  const next = item.c === 0 ? 1 : 0
  listsStore.updateItem(listId.value, id, { c: next })
  announce(`${item.n} ${next === 1 ? 'checked' : 'unchecked'}`)
}

onMounted(async () => {
  document.title = list.value!.n + ' List | Groceries List'
  await nextTick()
  itemName.value?.focus()
})
</script>

<style lang="scss">
@reference "../assets/main.css";

.list-header {
  @apply flex items-center justify-between mb-4;

  &__title {
    @apply text-2xl font-bold text-center mb-0;
  }

  &__share {
    @apply flex items-center justify-center min-w-[44px] min-h-[44px] text-xl rounded-full transition duration-200 ease-in-out;

    &:hover, &:focus {
      @apply bg-blue-50 ring-2 ring-blue-300/50 outline-none;
      @apply dark:bg-gl-deep-blue dark:ring-gl-darkblue;
    }
  }
}

.new-item {
  @apply flex justify-center items-center;

  &__input {
    @apply relative flex-1 min-w-0 bg-white px-3 py-2 rounded outline-none transition duration-200 ease-in-out border border-gl-gray;
    @apply dark:border-gl-deep-blue dark:bg-gl-deep-blue/50 dark:text-gray-200;

    &:hover, &:focus {
      @apply ring-4 ring-gl-blueberry/50 z-10;
    }

    &--number {
      @apply flex-none w-16 ml-2 mr-4;
    }
  }

  &__button {
    @apply relative bg-gl-lightgreen px-3 py-2 rounded transition duration-200 ease-in-out border border-gl-green outline-none text-gray-800 font-medium;
    @apply dark:bg-gl-green dark:border-gl-lightgreen dark:text-gray-200;

    &:hover, &:focus {
      @apply bg-green-300 ring-4 ring-gl-lightgreen/50 z-10;
      @apply dark:ring-gl-green/30 dark:bg-green-800;
    }
  }
}

.item {
  @apply flex justify-start items-center w-full;

  &__container {
    @apply flex justify-start items-center bg-white rounded border border-gl-gray h-14 grow min-w-0;
    @apply dark:border-gl-deep-blue dark:bg-gl-deep-blue/25 dark:text-gray-200;
  }

  &s {
    @apply grid w-full gap-4 mt-8;
    grid-template-columns: minmax(0, 1fr);

    &__h2 {
      @apply font-bold text-center text-lg mt-12;
    }

    &__checked {
      @apply text-gray-500 dark:text-gray-300;

      .item__container {
        @apply line-through;
      }
    }
  }

  &__checkbox-wrap {
    @apply relative min-w-[44px] min-h-[44px] flex items-center justify-center mr-2 shrink-0;
  }

  &__checkbox {
    @apply h-8 w-8 bg-white border border-gl-gray outline-none appearance-none rounded cursor-pointer transition duration-200 ease-in-out;
    @apply dark:border-gl-deep-blue dark:bg-gl-deep-blue/25 dark:text-gray-200;

    &:checked {
      @apply bg-gl-lightblue;
      @apply dark:bg-gl-darkblue;
    }

    &:focus {
      @apply border-blue-300 ring-4 ring-blue-300/50 outline-none;
    }

    &__icon {
      @apply absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-10 pointer-events-none;

      &--checked {
        @apply opacity-100;
      }
    }
  }

  &__quantity {
    @apply grid place-items-center w-14 h-full border-r border-gl-gray rounded-l shrink-0;
    @apply dark:border-gl-deep-blue;

    &__input {
      @apply w-10 text-center bg-transparent outline-none appearance-none border-0 p-0 transition duration-200 ease-in-out;

      &:focus {
        @apply ring-2 ring-blue-300/50 rounded outline-none;
      }
    }
  }

  &__name {
    @apply px-4 h-full bg-transparent transition duration-200 ease-in-out outline-none appearance-none border-0 self-stretch grow min-w-0;

    &:focus {
      @apply ring-4 ring-blue-300/50 ring-inset rounded;
    }
  }

  &__icon {
    &--delete {
      @apply text-xl ml-auto px-4 py-3;

      &:hover, &:focus {
        @apply text-red-700;
      }
    }
  }
}

.no-items {
  @apply font-normal text-center mt-4;
}

.all-checked {
  @apply text-center;
}
</style>
