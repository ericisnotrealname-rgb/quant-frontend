import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { usersApi, type UserProfile } from '@/api/users'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<UserProfile | null>(null)
  const loading = ref(false)
  const isAuthenticated = computed(() => Boolean(user.value))

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
    return response.data
  }

  async function logout() {
    await usersApi.logout()
    user.value = null
  }

  return { user, loading, isAuthenticated, loadProfile, login, logout }
})
