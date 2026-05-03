<template>
  <header class="header">
    <div class="header__container">
      <router-link :to="{ name: 'Lists' }" class="header__title">
        <img src="@/assets/logo.svg" alt="Groceries List App Blueberry Logo" class="header__title__logo"/>
        <span>My Lists</span>
      </router-link>
      <router-link :to="{ name: 'New' }" class="header__link">
        <font-awesome-icon icon="plus-square" class="header__link__icon"/>
        <span>New List</span>
      </router-link>
    </div>
  </header>
</template>

<style lang="scss">
@reference "../assets/main.css";

.header {
  @apply grid place-items-center bg-white py-4;
  @apply dark:bg-gl-deep-blue;

  &__container {
    @apply flex justify-between items-center w-full max-w-lg px-6 pb-0;
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
}
</style>
