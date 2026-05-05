<template>
  <div v-if="list">
    <h1>{{ list.n }}</h1>

    <form class="new-item" @submit.prevent="addItemToList">
      <label for="name" class="sr-only">Item Name</label>
      <input v-model="name" required
             class="new-item__input"
             ref="itemName"
             type="text" id="name" placeholder="Item Name" autofocus/>

      <label for="quantity" class="sr-only">Quantity</label>
      <input v-model="quantity" required
             class="new-item__input new-item__input--number"
             min="1" max="2147483647"
             type="number" id="quantity"/>

      <button type="submit" class="new-item__button">Add</button>
    </form>

    <!-- Only display the list items if they are present and not all soft deleted. -->
    <div
      v-if=" list.i.length !== 0 &&
      list.i.filter(item => item.d).length !== list.i.length"
      class="items">
      <div
        v-if="list.i.filter(i => !i.d && i.c === 0).length && list.i.filter(i => !i.d && i.c === 0).length === 0"
        class="all-checked">😃 You've checked off all your items, nice!
      </div>
      <div v-for="item in list.i.filter(i => !i.d && !i.c)" :key="item.id">
        <div class="item">
          <label :for="`item-checkbox-${item.id}`" class="sr-only">{{ item.n }} Checked</label>
          <input type="checkbox" :id="`item-checkbox-${item.id}`" :checked="!!item.c"
                 @input="toggleItemCheckedStatus(item.id)"
                 class="item__checkbox"/>
          <font-awesome-icon icon="check" class="item__checkbox__icon"/>
          <div class="item__container">
            <label :for="`item-qty-${item.id}`" class="sr-only">{{ item.n }} Quantity</label>
            <input type="number" inputmode="decimal" min="1"
                   :id="`item-qty-${item.id}`"
                   :value="item.q"
                   class="item__quantity"
                   @change="modifyItemQuantity($event, item.id)"/>
            <label :for="`item-name-${item.id}`" class="sr-only">{{ item.n }} Name</label>
            <input type="text"
                   :id="`item-name-${item.id}`"
                   :value="item.n"
                   class="item__name"
                   @change="modifyItemName($event, item.id)"/>
            <button @click="deleteItem(item.id)"
                    :aria-label="`Remove ${item.n} from this list`"
                    class="item__icon--delete">
              <font-awesome-icon icon="times-circle"/>
            </button>
          </div>
        </div>
      </div>

      <h2 v-if="list.i.filter(i => !i.d && i.c === 1).length" class="items__h2">Checked Items</h2>
      <div v-for="item in list.i.filter(i => !i.d && i.c === 1)" :key="item.id" class="items__checked">
        <div class="item">
          <label :for="`item-checkbox-${item.id}`" class="sr-only">{{ item.n }} Checked</label>
          <input type="checkbox" :id="`item-checkbox-${item.id}`" :checked="!!item.c"
                 @input="toggleItemCheckedStatus(item.id)"
                 class="item__checkbox"/>
          <font-awesome-icon icon="check" class="item__checkbox__icon item__checkbox__icon--checked"/>
          <div class="item__container">
            <label :for="`item-qty-${item.id}`" class="sr-only">{{ item.n }} Quantity</label>
            <input type="number" inputmode="decimal" min="1"
                   :id="`item-qty-${item.id}`"
                   :value="item.q"
                   class="item__quantity"
                   @change="modifyItemQuantity($event, item.id)"/>
            <label :for="`item-name-${item.id}`" class="sr-only">{{ item.n }} Name</label>
            <input type="text"
                   :id="`item-name-${item.id}`"
                   :value="item.n"
                   class="item__name"
                   @change="modifyItemName($event, item.id)"/>
            <button @click="deleteItem(item.id)"
                    :aria-label="`Remove ${item.n} from this list`"
                    class="item__icon--delete">
              <font-awesome-icon icon="times-circle"/>
            </button>
          </div>
        </div>
      </div>
    </div>
    <div v-if="list.i.filter(i => !i.d).length === 0" class="no-items">Add items to this list above.</div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import Item from '@/classes/Item'
import type List from '@/classes/List'
import { useListsStore } from '@/stores/lists'

const route = useRoute()
const listsStore = useListsStore()

const list = ref<List | null>(null)
const name = ref<string | null>(null)
const quantity = ref<number>(1)
const itemName = ref<HTMLInputElement | null>(null)

function findItem (id: string): Item | undefined {
  return list.value!.i.find(i => i.id === id)
}

function updateLocalList (): void {
  list.value = listsStore.getListFromId(route.params.id as string) ?? null
}

function addItemToList (): void {
  const item = new Item(name.value!, quantity.value)
  list.value!.i.push(item)
  listsStore.updateList(list.value!)
  name.value = null
  quantity.value = 1
  updateLocalList()
  itemName.value!.focus()
}

function modifyItemQuantity (event: Event, id: string): void {
  const input = event.target as HTMLInputElement
  const item = findItem(id)!
  if (input.value && !isNaN(Number(input.value))) {
    item.q = input.value
    item.u = new Date().getTime()
    listsStore.updateList(list.value!)
    updateLocalList()
  } else {
    input.value = String(item.q)
  }
}

function modifyItemName (event: Event, id: string): void {
  const input = event.target as HTMLInputElement
  if (input.value) {
    const item = findItem(id)!
    item.n = input.value
    item.u = new Date().getTime()
    listsStore.updateList(list.value!)
    updateLocalList()
  }
}

function deleteItem (id: string): void {
  const item = findItem(id)
  if (item) {
    item.u = new Date().getTime()
    item.d = 1
    list.value!.i.sort((a, b) => a.d > b.d ? 1 : -1)
    listsStore.updateList(list.value!)
  }
}

function toggleItemCheckedStatus (id: string): void {
  const item = findItem(id)
  if (item) {
    item.c = item.c === 0 ? 1 : 0
    item.u = new Date().getTime()
    listsStore.updateList(list.value!)
  }
}

onMounted(() => {
  updateLocalList()
  document.title = list.value!.n + ' List | Groceries List'
})
</script>

<style lang="scss">
@reference "../assets/main.css";

.new-item {
  @apply flex justify-center items-center;

  &__input {
    @apply relative w-48 bg-white px-3 py-2 rounded outline-none transition duration-200 ease-in-out border border-gl-gray;
    @apply dark:border-gl-deep-blue dark:bg-gl-deep-blue/50 dark:text-gray-200;

    &:hover, &:focus {
      @apply ring-4 ring-gl-blueberry/50 z-10;
    }

    &--number {
      @apply w-16 ml-2 mr-4;
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
}

.item {
  @apply flex justify-start items-center w-full;

  &__container {
    @apply flex justify-start items-center bg-white rounded border border-gl-gray h-14 grow;
    @apply dark:border-gl-deep-blue dark:bg-gl-deep-blue/25 dark:text-gray-200;
  }

  &s {
    @apply grid w-full gap-4 mt-8;

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

  &__checkbox {
    @apply relative h-11 w-11 bg-white border border-gl-gray outline-none appearance-none rounded mr-2 cursor-pointer transition duration-200 ease-in-out;
    @apply dark:border-gl-deep-blue dark:bg-gl-deep-blue/25 dark:text-gray-200;

    &:checked {
      @apply bg-gl-lightblue;
      @apply dark:bg-gl-darkblue;
    }

    &:focus {
      @apply border-blue-300 ring-4 ring-blue-300/50 outline-none;
    }

    &__icon {
      @apply absolute opacity-10 ml-2 pointer-events-none;

      &--checked {
        @apply opacity-100;
      }
    }
  }

  &__quantity, &__name {
    @apply px-4 h-full bg-transparent transition duration-200 ease-in-out outline-none appearance-none border-0;

    &:focus {
      @apply ring-4 ring-blue-300/50 ring-inset rounded;
    }
  }

  &__quantity {
    @apply w-14 text-center border-r border-gl-gray rounded-l;
    @apply dark:border-gl-deep-blue;
  }

  &__name {
    @apply grow;
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
