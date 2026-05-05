<template>
  <div v-if="loaded">
    <a href="#main" class="skip-link">Skip to main content</a>
    <app-header/>
    <main id="main" class="main" tabindex="-1">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" :key="$route.fullPath"/>
        </transition>
      </router-view>
    </main>
    <div aria-live="polite" aria-atomic="true" class="sr-only">{{ liveMessage }}</div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import AppHeader from '@/components/AppHeader.vue'
import { useListsStore } from '@/stores/lists'
import { useLiveRegion } from '@/composables/useLiveRegion'

const listsStore = useListsStore()
const loaded = ref(false)
const { message: liveMessage } = useLiveRegion()

onMounted(() => {
  listsStore.init()
  loaded.value = true
})
</script>

<style lang="scss">
@reference "./assets/main.css";

.skip-link {
  @apply absolute -top-full left-0 z-50 bg-white text-gl-darkblue px-4 py-2 rounded-br font-bold;
  @apply focus:top-0;
}

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
