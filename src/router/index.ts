import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/users',
    },
    {
      path: '/home',
      name: 'home',
      component: () => import('@/views/Home.vue'),
      meta: { title: '首页', requiresAuth: true },
    },
    {
      path: '/users',
      name: 'users',
      component: () => import('@/views/Users.vue'),
      meta: { title: '用户认证', requiresAuth: true },
    },
    {
      path: '/symbols',
      name: 'symbols',
      component: () => import('@/views/Symbols.vue'),
      meta: { title: '标的管理', requiresAuth: true },
    },
    {
      path: '/groups',
      name: 'groups',
      component: () => import('@/views/Groups.vue'),
      meta: { title: '分组管理', requiresAuth: true },
    },
    {
      path: '/datasources',
      name: 'datasources',
      component: () => import('@/views/Datasources.vue'),
      meta: { title: '数据源管理', requiresAuth: true },
    },
    {
      path: '/cases',
      name: 'cases',
      component: () => import('@/views/Cases.vue'),
      meta: { title: 'Case 管理', requiresAuth: true },
    },
    {
      path: '/suites',
      name: 'suites',
      component: () => import('@/views/Suites.vue'),
      meta: { title: 'Suite 管理', requiresAuth: true },
    },
    {
      path: '/plans',
      name: 'plans',
      component: () => import('@/views/Plans.vue'),
      meta: { title: 'Plan 管理', requiresAuth: true },
    },
    {
      path: '/funds',
      name: 'funds',
      component: () => import('@/views/FundAllocations.vue'),
      meta: { title: '资金占用', requiresAuth: true },
    },
    {
      path: '/execution',
      name: 'execution',
      component: () => import('@/views/ExecutionLogs.vue'),
      meta: { title: '执行日志', requiresAuth: true },
    },
    {
      path: '/trigger',
      name: 'trigger',
      component: () => import('@/views/TriggerExecution.vue'),
      meta: { title: '触发执行', requiresAuth: true },
    },
    {
      path: '/events',
      name: 'events',
      component: () => import('@/views/EventTypes.vue'),
      meta: { title: '事件类型', requiresAuth: true },
    },
    {
      path: '/alerts',
      name: 'alerts',
      component: () => import('@/views/Alerts.vue'),
      meta: { title: '告警管理', requiresAuth: true },
    },
    {
      path: '/alert-channels',
      name: 'alert-channels',
      component: () => import('@/views/AlertChannels.vue'),
      meta: { title: '告警渠道', requiresAuth: true },
    },
    {
      path: '/designer',
      name: 'designer',
      component: () => import('@/views/Designer.vue'),
      meta: { title: '策略设计器', requiresAuth: true },
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: () => import('@/views/Dashboard.vue'),
      meta: { title: '执行监控', requiresAuth: true },
    },
    {
      path: '/watchlist',
      name: 'watchlist',
      component: () => import('@/views/Watchlist.vue'),
      meta: { title: '自选池', requiresAuth: true },
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/Login.vue'),
      meta: { title: '登录' },
    },
  ],
});

router.beforeEach(async (to) => {
  if (!to.meta.requiresAuth) return true
  const auth = useAuthStore()
  if (auth.user || await auth.loadProfile()) return true
  return { name: 'login', query: { redirect: to.fullPath } }
})

export default router;
