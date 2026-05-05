<template>
  <div v-if="loaded">
    <app-header/>
    <main id="main" class="main">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" :key="$route.fullPath"/>
        </transition>
      </router-view>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import AppHeader from '@/components/AppHeader.vue'
import { useListsStore } from '@/stores/lists'

const listsStore = useListsStore()
const loaded = ref(false)

onMounted(() => {
  listsStore.init()
  loaded.value = true
})
</script>

<style lang="scss">
@reference "./assets/main.css";

.main {
  @apply p-6 w-full max-w-lg mx-auto;
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
