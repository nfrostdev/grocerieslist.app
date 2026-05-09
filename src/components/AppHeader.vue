<template>
  <header class="header">
    <div class="header__container">
      <nav aria-label="Primary">
        <router-link :to="{ name: 'Lists' }" class="header__title">
          <img src="@/assets/logo.svg" alt="Groceries List App Blueberry Logo" class="header__title__logo"/>
          <span>My Lists</span>
        </router-link>
        <router-link :to="{ name: 'New' }" class="header__link">
          <font-awesome-icon icon="plus-square" class="header__link__icon"/>
          <span>New List</span>
        </router-link>
      </nav>
      <button
        class="header__theme-toggle"
        :aria-label="`Switch to ${nextMode} mode`"
        :aria-pressed="false"
        @click="cycleMode"
      >
        <font-awesome-icon :icon="modeIcon"/>
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useTheme } from '@/composables/useTheme'

const { mode, cycleMode } = useTheme()

const CYCLE = ['light', 'dark', 'system'] as const

const modeIcon = computed(() => {
  if (mode.value === 'dark') return 'moon'
  if (mode.value === 'light') return 'sun'
  return 'desktop'
})

const nextMode = computed(() => {
  const idx = CYCLE.indexOf(mode.value)
  return CYCLE[(idx + 1) % CYCLE.length]
})
</script>

<style lang="scss">
@reference "../assets/main.css";

.header {
  @apply grid place-items-center bg-white py-4;
  @apply dark:bg-gl-deep-blue;

  &__container {
    @apply flex justify-between items-center w-full max-w-lg px-6 pb-0;

    nav {
      @apply flex justify-between items-center w-full;
    }
  }

  &__title {
    @apply flex font-bold text-2xl place-items-center;

    &__logo {
      @apply h-12 mr-1;
    }
  }

  &__link {
    @apply flex justify-center items-center font-bold;

    &__icon {
      @apply mr-2 text-lg;
    }
  }

  &__theme-toggle {
    @apply ml-4 flex items-center justify-center w-9 h-9 rounded-full;
    @apply text-gl-darkblue hover:bg-gl-lightgray focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gl-blueberry;
    @apply dark:text-gray-200 dark:hover:bg-gl-muted-blue;
    flex-shrink: 0;
  }
}
</style>
