<template>
  <div class="setup-page">
    <div class="setup-panel">
      <span class="eyebrow">QUANT ENGINE</span>
      <h1>初始化部署</h1>
      <p class="lead">这是系统的首次启动，请创建第一个账号。它将拥有系统最高权限。</p>

      <el-alert
        v-if="closed"
        title="系统已完成初始化，引导已关闭"
        type="info"
        show-icon
        :closable="false"
      >
        <template #default>
          <p class="alert-body">引导只会开启一次。请前往登录页使用已创建的账号登录。</p>
          <el-button type="primary" @click="goLogin">前往登录</el-button>
        </template>
      </el-alert>

      <template v-else>
        <el-alert
          title="该账号拥有系统全部权限，请使用强密码并妥善保管。"
          type="warning"
          show-icon
          :closable="false"
        />
        <el-form :model="form" @submit.prevent="submit">
          <el-form-item label="用户名" required>
            <el-input v-model="form.username" autocomplete="username" placeholder="建议使用英文或数字" />
          </el-form-item>
          <el-form-item label="密码" required>
            <el-input
              v-model="form.password"
              type="password"
              show-password
              autocomplete="new-password"
              placeholder="至少 8 位，含字母与数字"
            />
          </el-form-item>
          <el-form-item label="确认密码" required>
            <el-input
              v-model="form.password_confirm"
              type="password"
              show-password
              autocomplete="new-password"
            />
          </el-form-item>
          <el-form-item label="邮箱">
            <el-input v-model="form.email" type="email" autocomplete="email" placeholder="可选" />
          </el-form-item>
          <el-form-item label="公司">
            <el-input v-model="form.company" placeholder="可选" />
          </el-form-item>
          <el-alert v-if="error" :title="error" type="error" show-icon closable @close="error = ''" />
          <el-button native-type="submit" type="primary" :loading="submitting" class="submit">
            创建管理员并进入系统
          </el-button>
        </el-form>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()
const submitting = ref(false)
const closed = ref(false)
const error = ref('')
const form = reactive({
  username: '',
  password: '',
  password_confirm: '',
  email: '',
  company: '',
})

/** 已完成初始化时不再允许创建，直接引导去登录页（引导完成后不会被再次启用）。 */
onMounted(async () => {
  const required = await auth.loadSetupStatus()
  closed.value = required === false
})

function goLogin() {
  router.replace({ name: 'login' })
}

async function submit() {
  error.value = ''
  if (!form.username.trim()) {
    error.value = '请填写用户名。'
    return
  }
  if (form.password.length < 8) {
    error.value = '密码至少 8 位。'
    return
  }
  if (form.password !== form.password_confirm) {
    error.value = '两次密码不一致。'
    return
  }
  submitting.value = true
  try {
    await auth.completeSetup({ ...form })
    // 后端创建后已自动登录，直接进入系统
    await router.replace('/watchlist')
  } catch (e: unknown) {
    const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
    error.value = detail || '初始化失败，请检查用户名是否重复。'
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.setup-page { min-height: 100vh; display: grid; place-items: center; padding: 40px 20px; background: #f5f6f8; }
.setup-panel { width: min(480px, 100%); padding: 36px; background: #fff; border: 1px solid #e6e8ec; border-radius: 8px; box-shadow: 0 16px 40px rgba(23, 32, 51, .08); }
.eyebrow { color: #d97706; font-size: 11px; font-weight: 700; letter-spacing: 1.8px; }
h1 { margin: 10px 0 6px; color: #172033; font-size: 28px; }
.lead { margin-bottom: 22px; color: #667085; line-height: 1.6; }
.alert-body { margin: 4px 0 10px; }
.submit { width: 100%; margin-top: 12px; }
</style>
