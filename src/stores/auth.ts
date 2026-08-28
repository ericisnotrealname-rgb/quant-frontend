import { defineStore } from 'pinia'
import { ref } from 'vue'
import { usersApi, type UserProfile } from '@/api/users'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<UserProfile | null>(null)
  const loading = ref(false)

  async function loadProfile() {
    loading.value = true
    try {
      user.value = (await usersApi.profile()).data
      return user.value
    } catch {
      user.value = null
      return null
    } finally {
      loading.value = false
    }
  }

  async function login(username: string, password: string) {
    user.value = (await usersApi.login(username, password)).data
  }

  async function logout() {
    await usersApi.logout()
    user.value = null
  }

  return { user, loading, loadProfile, login, logout }
})
