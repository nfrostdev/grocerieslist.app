<template>
  <div v-if="loaded">
    <app-header/>
    <main id="main" class="main">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" :key="$route.fullPath"/>
        </transition>
      </router-view>
      <div class="copied">
        <div class="copied__content">
          <font-awesome-icon icon="clipboard-check" class="copied__icon"/>
          <span>Link Copied to Clipboard</span>
        </div>
      </div>
    </main>
  </div>
</template>

<script>
import AppHeader from '@/components/AppHeader.vue'

export default {
  components: { AppHeader },
  data () {
    return {
      loaded: false
    }
  },
  methods: {
    importList () {
      const newList = JSON.parse(atob(this.$route.query.import.toString()))

      // If this list already exists we have to run a differential on the items, otherwise just add it.
      const existingList = this.$store.state.lists.find(list => list.id === newList.id)
      if (existingList) {
        newList.i.forEach(newListItem => {
          // If this item already exists on this list, update it appropriately, otherwise just add it.
          const existingListItem = existingList.i.find(existingListItem => existingListItem.id === newListItem.id)
          if (existingListItem) {
            if (existingListItem.d || newListItem.d) {
              // TODO: Actually delete the item from the array here.
              newListItem.d = existingListItem.d ?? newListItem.d
            }
            if (existingListItem.u >= newListItem.u) {
              newListItem = existingListItem
            }
          } else {
            existingList.i.push(newListItem)
          }
        })

        this.$store.dispatch('updateList', newList)
      } else {
        this.$store.dispatch('createList', newList)
      }

      this.$router.replace({ name: 'List', params: { id: newList.id } })
    }
  },
  mounted () {
    this.$store.dispatch('init').then(() => {
      this.loaded = true

      if (this.$route.query.import) {
        this.importList()
      }
    })
  }
}
</script>

<style lang="scss">
.main {
  @apply p-6 w-full max-w-lg mx-auto;
}

.copied {
  @apply fixed grid place-items-center right-0 left-0 text-center pb-6 pointer-events-none transition-all ease-in-out;
  bottom: -4rem;

  &__content {
    @apply bg-gl-green py-2 px-3 text-sm rounded shadow text-white font-medium;
  }

  &__icon {
    @apply text-base mr-2;
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: all 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.fade-leave-to {
  transform: translateX(-4rem);
}

.fade-enter-from {
  transform: translateX(4rem);
}
</style>
