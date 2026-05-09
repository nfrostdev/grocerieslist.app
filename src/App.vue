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
    <import-modal v-if="pendingImport"
                  v-model:open="importOpen"
                  :incoming="pendingImport"
                  :existing="existingMatch"
                  @replace="onReplace"
                  @merge="onMerge"
                  @copy="onCopy"
                  @cancel="onCancel"/>
    <toast-container/>
    <div aria-live="polite" aria-atomic="true" class="sr-only">{{ liveMessage }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, shallowRef, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import ImportModal from '@/components/ImportModal.vue'
import ToastContainer from '@/components/ToastContainer.vue'
import { useListsStore } from '@/stores/lists'
import { useLiveRegion } from '@/composables/useLiveRegion'
import type List from '@/classes/List'
import * as sync from '@/sync'

const router = useRouter()
const listsStore = useListsStore()
const loaded = ref(false)
const { message: liveMessage, announce } = useLiveRegion()

const importOpen = ref(false)
const pendingImport = shallowRef<List | null>(null)
const existingMatch = shallowRef<List | null>(null)

async function handleImportFragment () {
  const m = /^#import=(.+)$/.exec(window.location.hash)
  if (!m) return
  history.replaceState({}, '', window.location.pathname + window.location.search)

  const { decodeList } = await import('@/utils/share')
  const result = decodeList(m[1])
  if (!result.ok) {
    announce(result.reason === 'newer-schema'
      ? 'This list was shared from a newer version. Update the app to import it.'
      : "Couldn't read shared list — try rescanning.")
    return
  }
  pendingImport.value = result.list
  existingMatch.value = listsStore.getListFromId(result.list.id) ?? null
  importOpen.value = true
}

function finishImport (id: string, message: string) {
  importOpen.value = false
  announce(message)
  router.replace({ name: 'List', params: { id } })
}

function onReplace () {
  if (!pendingImport.value) return
  const { id, n } = pendingImport.value
  listsStore.replaceList(pendingImport.value)
  finishImport(id, `Imported "${n}"`)
}

function onMerge () {
  if (!pendingImport.value) return
  const { id, n } = pendingImport.value
  listsStore.mergeList(pendingImport.value)
  finishImport(id, `Merged "${n}"`)
}

function onCopy () {
  if (!pendingImport.value) return
  const { n } = pendingImport.value
  const newId = listsStore.importAsCopy(pendingImport.value)
  finishImport(newId, `Imported "${n}" as a new list`)
}

function onCancel () {
  pendingImport.value = null
  existingMatch.value = null
}

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

async function handleHashChange () {
  await handleImportFragment()
  await handleJoinFragment()
}

onMounted(async () => {
  listsStore.init()
  loaded.value = true
  sync.startPolling()
  await handleHashChange()
  window.addEventListener('hashchange', handleHashChange)
})

onUnmounted(() => {
  window.removeEventListener('hashchange', handleHashChange)
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
