<template>
  <div class="page-container">
    <div class="page-heading">
      <div>
        <span class="eyebrow">USER ACCESS</span>
        <h1>用户认证</h1>
        <p>维护当前登录账户与注册入口。</p>
      </div>
    </div>

    <el-row :gutter="20">
      <el-col :span="12">
        <el-card class="panel">
          <template #header>
            <div class="card-title">个人资料</div>
          </template>

          <el-form v-if="profile" :model="profile" label-width="90px" @submit.prevent="saveProfile">
            <el-form-item label="用户名">
              <el-input v-model="profile.username" disabled />
            </el-form-item>
            <el-form-item label="邮箱">
              <el-input v-model="profile.email" />
            </el-form-item>
            <el-form-item label="手机号">
              <el-input v-model="profile.phone" />
            </el-form-item>
            <el-form-item label="公司">
              <el-input v-model="profile.company" />
            </el-form-item>
            <el-form-item label="角色">
              <el-tag v-for="role in profile.roles" :key="role" class="role-tag" type="primary" effect="plain">
                {{ role }}
              </el-tag>
            </el-form-item>
            <el-button type="primary" :loading="saving" @click="saveProfile">保存资料</el-button>
          </el-form>
          <el-empty v-else description="未登录或资料未加载" />
        </el-card>
      </el-col>

      <el-col :span="12">
        <el-card class="panel">
          <template #header>
            <div class="card-title">注册新用户</div>
          </template>

          <el-form :model="registerForm" label-width="90px" @submit.prevent="submitRegister">
            <el-form-item label="用户名" required>
              <el-input v-model="registerForm.username" />
            </el-form-item>
            <el-form-item label="密码" required>
              <el-input v-model="registerForm.password" type="password" show-password />
            </el-form-item>
            <el-form-item label="确认密码" required>
              <el-input v-model="registerForm.password_confirm" type="password" show-password />
            </el-form-item>
            <el-form-item label="邮箱" required>
              <el-input v-model="registerForm.email" />
            </el-form-item>
            <el-form-item label="手机号">
              <el-input v-model="registerForm.phone" />
            </el-form-item>
            <el-form-item label="公司">
              <el-input v-model="registerForm.company" />
            </el-form-item>
            <el-button type="success" :loading="registering" @click="submitRegister">创建账户</el-button>
          </el-form>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { usersApi } from '@/api/users'

const profile = ref<any>(null)
const saving = ref(false)
const registering = ref(false)

const registerForm = ref({
  username: '',
  password: '',
  password_confirm: '',
  email: '',
  phone: '',
  company: '',
})

async function loadProfile() {
  try {
    const response = await usersApi.profile()
    profile.value = response.data
  } catch {
    profile.value = null
  }
}

async function saveProfile() {
  if (!profile.value) return
  saving.value = true
  try {
    const payload = {
      email: profile.value.email,
      phone: profile.value.phone,
      company: profile.value.company,
    }
    const response = await usersApi.register(payload)
    profile.value = response.data
    ElMessage.success('个人资料已保存')
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.detail || '保存失败')
  } finally {
    saving.value = false
  }
}

async function submitRegister() {
  registering.value = true
  try {
    await usersApi.register(registerForm.value)
    ElMessage.success('注册成功，请登录。')
    registerForm.value = {
      username: '',
      password: '',
      password_confirm: '',
      email: '',
      phone: '',
      company: '',
    }
  } catch (error: any) {
    const msg = error?.response?.data
    ElMessage.error(typeof msg === 'string' ? msg : JSON.stringify(msg))
  } finally {
    registering.value = false
  }
}

onMounted(loadProfile)
</script>

<style scoped>
.page-container { max-width: 1200px; margin: 0 auto; }
.page-heading { margin-bottom: 24px; }
.eyebrow { color: #d97706; font-size: 11px; font-weight: 700; letter-spacing: 1.8px; }
h1 { margin: 6px 0; color: #172033; font-size: 36px; }
p { color: #667085; }
.panel { min-height: 420px; }
.card-title { font-weight: 700; }
.role-tag { margin-right: 8px; }
</style>
