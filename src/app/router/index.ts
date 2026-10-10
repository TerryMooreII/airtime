import { createRouter, createWebHistory } from 'vue-router'

import { applyTitle, authGuard } from './guards'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior: (_to, _from, saved) => saved ?? { top: 0 },
  routes: [
    // --- App ---------------------------------------------------------------
    {
      path: '/',
      name: 'home',
      component: () => import('@/features/home/HomeView.vue'),
      meta: { requiresAuth: true, title: 'Upcoming' },
    },
    {
      path: '/search',
      name: 'search',
      component: () => import('@/features/search/SearchView.vue'),
      meta: { requiresAuth: true, title: 'Search' },
    },
    {
      path: '/library',
      name: 'library',
      component: () => import('@/features/library/LibraryView.vue'),
      meta: { requiresAuth: true, title: 'My shows' },
    },
    {
      path: '/shows/:id(\\d+)',
      name: 'show',
      component: () => import('@/features/shows/ShowDetailView.vue'),
      props: true,
      meta: { requiresAuth: true, title: 'Show' },
    },
    {
      path: '/notifications',
      name: 'notifications',
      component: () => import('@/features/notifications/NotificationsView.vue'),
      meta: { requiresAuth: true, title: 'Notifications' },
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/features/settings/SettingsView.vue'),
      meta: { requiresAuth: true, title: 'Settings' },
    },

    // --- Admin -------------------------------------------------------------
    {
      path: '/admin',
      component: () => import('@/features/admin/AdminLayout.vue'),
      meta: { requiresAdmin: true, layout: 'admin' },
      children: [
        {
          path: '',
          name: 'admin',
          component: () => import('@/features/admin/AdminDashboardView.vue'),
          meta: { requiresAdmin: true, title: 'Admin' },
        },
        {
          path: 'shows',
          name: 'admin-shows',
          component: () => import('@/features/admin/AdminShowsView.vue'),
          meta: { requiresAdmin: true, title: 'Admin · Shows' },
        },
        {
          path: 'users',
          name: 'admin-users',
          component: () => import('@/features/admin/AdminUsersView.vue'),
          meta: { requiresAdmin: true, title: 'Admin · Users' },
        },
        {
          path: 'sync',
          name: 'admin-sync',
          component: () => import('@/features/admin/AdminSyncView.vue'),
          meta: { requiresAdmin: true, title: 'Admin · Sync' },
        },
      ],
    },

    // --- Auth --------------------------------------------------------------
    {
      path: '/login',
      name: 'login',
      component: () => import('@/features/auth/LoginView.vue'),
      meta: { guestOnly: true, layout: 'auth', title: 'Sign in' },
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('@/features/auth/RegisterView.vue'),
      meta: { guestOnly: true, layout: 'auth', title: 'Create account' },
    },
    {
      path: '/forgot-password',
      name: 'forgot-password',
      component: () => import('@/features/auth/ForgotPasswordView.vue'),
      meta: { guestOnly: true, layout: 'auth', title: 'Forgot password' },
    },
    {
      path: '/verify-email',
      name: 'verify-email',
      component: () => import('@/features/auth/VerifyEmailView.vue'),
      meta: { layout: 'auth', title: 'Verify your email' },
    },
    {
      path: '/auth/callback',
      name: 'auth-callback',
      component: () => import('@/features/auth/AuthCallbackView.vue'),
      meta: { layout: 'auth', title: 'Signing you in' },
    },
    {
      path: '/auth/reset-password',
      name: 'reset-password',
      component: () => import('@/features/auth/ResetPasswordView.vue'),
      meta: { layout: 'auth', title: 'Reset password' },
    },

    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/features/NotFoundView.vue'),
      meta: { layout: 'blank', title: 'Not found' },
    },
  ],
})

router.beforeEach(authGuard)
router.afterEach((to) => applyTitle(to.meta.title))

export default router
