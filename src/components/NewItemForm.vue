<template>
  <form class="new-item-form" @submit.prevent="addItem">
    <div class="new-item-form__field new-item-form__field--name">
      <label for="item_name" class="sr-only">Item Name</label>
      <input type="text" id="item_name" v-model="name" class="new-item-form__field__input" placeholder="Item Name"
             required>
    </div>
    <div class="new-item-form__field new-item-form__field--quantity">
      <label for="item_quantity" class="sr-only">Item Name</label>
      <input type="number" id="item_quantity" v-model="quantity" class="new-item-form__field__input" min="1" max="999"
             required>
    </div>
    <button type="submit" class="new-item-form__submit">
      <font-awesome-icon icon="plus-circle"/>
    </button>
  </form>
</template>

<script>
import Item from "@/classes/Item";

export default {
  data() {
    return {
      name: null,
      quantity: 1,
    }
  },
  computed: {
    list() {
      return this.$store.getters.getListFromId(this.$route.params.id)
    }
  },
  methods: {
    addItem() {
      let list = this.list
      list.items.push(new Item(this.name, this.quantity, false))
      this.$store.dispatch('updateList', list)

      this.name = null;
      this.quantity = 1;
    }
  }
}
</script>

<style lang="scss">
.new-item-form {
  @apply flex mb-4;

  &__field {
    @apply flex;

    &--name {
      @apply flex-grow;
    }

    &--quantity {
      @apply ml-4 w-20;
    }

    &__input {
      @apply rounded shadow py-2 px-3 text-gray-900 leading-none w-full;
    }
  }

  &__submit {
    @apply text-2xl ml-4;
  }
}
</style>