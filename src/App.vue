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
    <toast-container/>
    <div aria-live="polite" aria-atomic="true" class="sr-only">{{ liveMessage }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import ToastContainer from '@/components/ToastContainer.vue'
import { useListsStore } from '@/stores/lists'
import { useLiveRegion } from '@/composables/useLiveRegion'
import * as sync from '@/sync'

const router = useRouter()
const listsStore = useListsStore()
const loaded = ref(false)
const { message: liveMessage, announce } = useLiveRegion()

async function handleJoinFragment () {
  const m = /^#join=([^.]+)\.(.+)$/.exec(window.location.hash)
  if (!m) return
  history.replaceState({}, '', window.location.pathname + window.location.search)

  const [, listId, token] = m

  if (sync.getMeta(listId)) {
    router.replace({ name: 'List', params: { id: listId } })
    return
  }

  const ok = await sync.join(listId, token)
  if (ok) {
    router.replace({ name: 'List', params: { id: listId } })
  } else {
    announce('Could not join list — link may be invalid or revoked.')
  }
}

onMounted(async () => {
  listsStore.init()
  loaded.value = true
  sync.startPolling()
  await handleJoinFragment()
  window.addEventListener('hashchange', handleJoinFragment)
})

onUnmounted(() => {
  window.removeEventListener('hashchange', handleJoinFragment)
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
