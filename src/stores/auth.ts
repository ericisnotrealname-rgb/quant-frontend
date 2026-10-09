import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { usersApi, type UserProfile } from '@/api/users'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<UserProfile | null>(null)
  const loading = ref(false)
  const isAuthenticated = computed(() => Boolean(user.value))

  /**
   * 是否仍需部署初始化引导。
   * `null` 表示尚未查询（未知）——路由守卫在未知时按「需要引导」处理，
   * 宁可多跳一次引导页，也不要在未初始化的系统上放行到业务页面。
   */
  const setupRequired = ref<boolean | null>(null)
  let setupChecked = false

  async function loadSetupStatus(force = false) {
    if (setupChecked && !force) return setupRequired.value
    try {
      const response = await usersApi.setupStatus()
      setupRequired.value = response.data.setup_required
    } catch {
      // 查询失败不放行：视为仍需引导，避免把未初始化的系统直接暴露给业务页
      setupRequired.value = true
    } finally {
      setupChecked = true
    }
    return setupRequired.value
  }

  async function loadProfile() {
    loading.value = true
    try {
      const response = await usersApi.profile()
      user.value = response.data
      return user.value
    } catch {
      user.value = null
      return null
    } finally {
      loading.value = false
    }
  }

  async function login(username: string, password: string) {
    const response = await usersApi.login(username, password)
    user.value = response.data
    // 登录即视为系统已初始化，避免守卫反复查询引导状态
    setupRequired.value = false
    setupChecked = true
    return response.data
  }

  /** 完成初始化引导：后端创建超级管理员后已自动登录。 */
  async function completeSetup(payload: Record<string, string>) {
    const response = await usersApi.setup(payload)
    user.value = response.data
    setupRequired.value = false
    setupChecked = true
    return response.data
  }

  async function logout() {
    await usersApi.logout()
    user.value = null
  }

  return {
    user, loading, isAuthenticated, setupRequired,
    loadSetupStatus, loadProfile, login, logout, completeSetup,
  }
})
