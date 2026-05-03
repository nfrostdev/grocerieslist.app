import { createRouter, createWebHistory } from 'vue-router'
import Lists from '../views/Lists.vue'

const routes = [
  {
    path: '/',
    name: 'Lists',
    component: Lists
  },
  {
    path: '/new',
    name: 'New',
    component: () => import('../views/New.vue')
  },
  {
    path: '/:id',
    name: 'List',
    component: () => import('../views/List.vue')
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

export default router
