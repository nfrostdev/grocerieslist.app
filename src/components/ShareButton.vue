<template>
  <button :title="'Share your ' + list.n + ' list.'" class="share-list-button" @click="shareList(list)">
    <font-awesome-icon v-if="updating" icon="circle-notch" class="share-list-button__icon--spinner"/>
    <font-awesome-icon v-else icon="share-alt"/>
  </button>
</template>

<script>

export default {
  props: {
    list: Object
  },
  data () {
    return {
      updating: false
    }
  },
  methods: {
    copyToClipboard (text) {
      navigator.clipboard.writeText(text)
      const copied = document.querySelector('.copied')
      copied.classList.add('bottom-0')
      setTimeout(() => {
        copied.classList.remove('bottom-0')
      }, 1000)
    },
    async shareList (list) {
      const target = window.location.origin + '?import=' + btoa(JSON.stringify(list))

      if (target.length > 1024) {
        this.copyToClipboard(target)
      } else {
        try {
          this.updating = true
          await fetch('https://api-grocerieslist-app.uc.r.appspot.com?target=' + target, {
            method: 'POST'
          }).then(response => response.json())
            .then(response => {
              this.updating = false
              if (response && response.link) {
                if (navigator.share) {
                  navigator.share({
                    url: response.link,
                    text: 'Check out my ' + list.n + ' list!'
                  })
                } else if (navigator.clipboard) {
                  this.copyToClipboard(response.link)
                } else {
                  alert('Your device does not support the Share or Clipboard API, sorry.')
                }
              } else {
                alert('Failed to generate short link, please try again.')
              }
            })
        } catch (err) {
          this.updating = false
          alert(err)
        }
      }
    }
  }
}
</script>

<style lang="scss">
@reference "../assets/main.css";

.share-list-button {
  @apply flex justify-center items-center bg-white border border-gl-gray rounded-full w-12 h-12 mr-2 p-4 transition duration-200 ease-in-out text-lg;
  @apply dark:bg-gl-darkblue dark:border-gl-deep-blue;

  &:hover, &:focus {
    @apply bg-blue-50 border-blue-300 ring-2 ring-blue-300/50 outline-none;
    @apply dark:bg-gl-deep-blue dark:border-gl-darkblue dark:ring-gl-darkblue;
  }

  &__icon {
    &--spinner {
      @apply text-xl;
      animation: spin 0.75s infinite linear;
    }
  }
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(359deg);
  }
}
</style>
