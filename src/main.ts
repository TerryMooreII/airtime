import { createPinia } from 'pinia'
import { createApp } from 'vue'

import App from './App.vue'
import router from './app/router'
import './design-system/tokens.css'
import './design-system/base.css'

createApp(App).use(createPinia()).use(router).mount('#app')
