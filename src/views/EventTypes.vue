<template>
  <div class="page-container">
    <div class="page-heading">
      <div>
        <span class="eyebrow">EVENT TYPES</span>
        <h1>事件类型</h1>
        <p>查看系统内置、插件和用户自定义事件类型说明。</p>
      </div>
    </div>

    <el-card>
      <el-table :data="eventTypes" v-loading="loading" stripe>
        <el-table-column prop="name" label="事件类型名称" min-width="180" />
        <el-table-column prop="scope" label="作用域" width="180">
          <template #default="{ row }"><el-tag :type="scopeType(row.scope)">{{ scopeLabel(row.scope) }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="description" label="描述" min-width="260" show-overflow-tooltip />
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'

const eventTypes = ref<any[]>([])
const loading = ref(false)

async function loadData() {
  loading.value = true
  try {
    const response = await fetch('/api/execution/event-types/list-all/?include_system=true&page_size=500', { credentials: 'same-origin' })
    const payload = await response.json()
    if (!response.ok) throw new Error('list event types failed')
    // 兼容统一分页响应：直接数组或 { results: [...] } 均可
    eventTypes.value = Array.isArray(payload) ? payload : (Array.isArray(payload?.results) ? payload.results : [])
  } catch (error) {
    ElMessage.error('事件类型加载失败')
    console.error(error)
  } finally {
    loading.value = false
  }
}

function scopeLabel(value: string) {
  return ({ system: '系统内置', plugin: '插件定义', user: '用户自定义' } as Record<string, string>)[value] || value
}

function scopeType(value: string) {
  return ({ system: 'primary', plugin: 'warning', user: 'success' } as Record<string, string>)[value] || 'info'
}

onMounted(loadData)
</script>

<style scoped>
.page-container { max-width: 1200px; margin: 0 auto; }
.page-heading { margin-bottom: 24px; }
.eyebrow { color: #d97706; font-size: 11px; font-weight: 700; letter-spacing: 1.8px; }
h1 { margin: 6px 0; color: #172033; font-size: 36px; }
p { color: #667085; }
</style>
