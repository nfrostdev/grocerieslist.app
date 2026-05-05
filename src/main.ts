import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './assets/main.css'
import { library } from '@fortawesome/fontawesome-svg-core'
import {
  faCheck,
  faPlusSquare,
  faTimesCircle
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'

library.add(faPlusSquare, faTimesCircle, faCheck)

const app = createApp(App)
  .use(createPinia())
  .use(router)
  .component('font-awesome-icon', FontAwesomeIcon)

router.isReady().then(() => app.mount('#app'))
