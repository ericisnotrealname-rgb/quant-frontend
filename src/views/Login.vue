<template>
  <div class="login-page">
    <div class="login-panel">
      <span class="eyebrow">QUANT ENGINE</span>
      <h1>登录交易工作台</h1>
      <p>使用平台账户继续。</p>
      <el-alert v-if="error" :title="error" type="error" show-icon closable @close="error = ''" />
      <el-form :model="form" @submit.prevent="submit">
        <el-form-item label="用户名"><el-input v-model="form.username" autocomplete="username" /></el-form-item>
        <el-form-item label="密码"><el-input v-model="form.password" type="password" show-password autocomplete="current-password" /></el-form-item>
        <el-button native-type="submit" type="primary" :loading="loading" class="submit">登录</el-button>
      </el-form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const form = reactive({ username: '', password: '' })
const loading = ref(false)
const error = ref('')

async function submit() {
  loading.value = true
  error.value = ''
  try {
    await auth.login(form.username, form.password)
    await router.replace(typeof route.query.redirect === 'string' ? route.query.redirect : '/watchlist')
  } catch {
    error.value = '用户名或密码错误。'
  } finally { loading.value = false }
}
</script>

<style scoped>
.login-page { min-height: 70vh; display: grid; place-items: center; }.login-panel { width: min(420px, 100%); padding: 36px; background: #fff; border: 1px solid #e6e8ec; border-radius: 8px; box-shadow: 0 16px 40px rgba(23, 32, 51, .08); }.eyebrow { color: #d97706; font-size: 11px; font-weight: 700; letter-spacing: 1.8px; }h1 { margin: 10px 0 6px; color: #172033; font-size: 28px; }p { margin-bottom: 26px; color: #667085; }.submit { width: 100%; margin-top: 10px; }
</style>