import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './registerServiceWorker'
import router from './router'
import store from './store'
import './assets/main.css'
import { library } from '@fortawesome/fontawesome-svg-core'
import {
  faCheck,
  faClipboardCheck,
  faPlusSquare,
  faShareAlt,
  faCircleNotch,
  faTimesCircle
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'

library.add(faPlusSquare, faTimesCircle, faClipboardCheck, faShareAlt, faCircleNotch, faCheck)

createApp(App)
  .use(createPinia())
  .use(store)
  .use(router)
  .component('font-awesome-icon', FontAwesomeIcon)
  .mount('#app')
