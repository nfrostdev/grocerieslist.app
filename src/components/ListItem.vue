<template>
  <div class="item">
    <label :for="`item-checkbox-${item.id}`" class="sr-only">{{ item.n }} Checked</label>
    <div class="item__checkbox-wrap">
      <input type="checkbox" :id="`item-checkbox-${item.id}`" :checked="!!item.c"
             @input="$emit('toggle')"
             class="item__checkbox"/>
      <font-awesome-icon icon="check"
                         :class="['item__checkbox__icon', { 'item__checkbox__icon--checked': checked }]"/>
    </div>
    <div class="item__container">
      <div class="item__quantity">
        <label :for="`item-qty-${item.id}`" class="sr-only">{{ item.n }} Quantity</label>
        <input type="text" inputmode="decimal"
               :id="`item-qty-${item.id}`"
               :value="item.q"
               class="item__quantity__input"
               @change="onQuantityChange"/>
      </div>
      <label :for="`item-name-${item.id}`" class="sr-only">{{ item.n }} Name</label>
      <input type="text"
             :id="`item-name-${item.id}`"
             :value="item.n"
             :ref="nameRef"
             class="item__name"
             @change="onNameChange"/>
      <button @click="$emit('delete')"
              :aria-label="`Remove ${item.n} from this list`"
              class="item__icon--delete">
        <font-awesome-icon icon="times-circle"/>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type Item from '@/classes/Item'

defineProps<{
  item: Item
  checked: boolean
  nameRef: (el: unknown) => void
}>()

const emit = defineEmits<{
  (e: 'toggle'): void
  (e: 'delete'): void
  (e: 'update:name', input: HTMLInputElement): void
  (e: 'update:quantity', input: HTMLInputElement): void
}>()

function onNameChange (event: Event): void {
  emit('update:name', event.target as HTMLInputElement)
}

function onQuantityChange (event: Event): void {
  emit('update:quantity', event.target as HTMLInputElement)
}
</script>
