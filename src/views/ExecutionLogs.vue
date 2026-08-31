<template>
  <div class="page-container">
    <div class="page-heading">
      <div>
        <span class="eyebrow">EXECUTION</span>
        <h1>执行日志</h1>
        <p>查看具体执行结果、状态与快照信息。</p>
      </div>
    </div>

    <el-card>
      <div class="toolbar">
        <el-input v-model="symbolFilter" clearable placeholder="标的代码" style="max-width: 220px" />
        <el-select v-model="statusFilter" clearable placeholder="状态筛选" style="width: 180px">
          <el-option label="成功" value="success" />
          <el-option label="失败" value="failed" />
          <el-option label="风控拦截" value="blocked" />
        </el-select>
      </div>

      <el-table :data="filteredLogs" v-loading="loading" stripe>
        <el-table-column prop="trigger_time" label="触发时间" width="180">
          <template #default="{ row }">{{ formatDate(row.trigger_time) }}</template>
        </el-table-column>
        <el-table-column prop="symbol" label="标的代码" width="130" />
        <el-table-column prop="final_direction" label="最终方向" width="120">
          <template #default="{ row }"><el-tag :type="directionType(row.final_direction)">{{ directionLabel(row.final_direction) }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="status" label="执行状态" width="120">
          <template #default="{ row }"><el-tag :type="statusType(row.status)">{{ statusLabel(row.status) }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="plan" label="关联 Plan" width="120" />
        <el-table-column label="详情" min-width="220">
          <template #default="{ row }">
            <el-button size="small" @click="showDetail(row)">查看详情</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="detailVisible" title="执行详情" width="700px">
      <pre class="json-box">{{ detailText }}</pre>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { executionApi } from '@/api/execution'
import type { ExecutionLog } from '@/types/api'

const logs = ref<ExecutionLog[]>([])
const loading = ref(false)
const symbolFilter = ref('')
const statusFilter = ref('')
const detailVisible = ref(false)
const detailText = ref('{}')

const filteredLogs = computed(() => {
  return logs.value.filter((item) => {
    const matchSymbol = !symbolFilter.value || item.symbol.includes(symbolFilter.value)
    const matchStatus = !statusFilter.value || item.status === statusFilter.value
    return matchSymbol && matchStatus
  })
})

async function loadData() {
  loading.value = true
  try {
    const response = await executionApi.logs()
    logs.value = response.data
  } catch (error) {
    ElMessage.error('执行日志加载失败')
    console.error(error)
  } finally {
    loading.value = false
  }
}

function formatDate(value: string | null | undefined) {
  if (!value) return '-'
  return new Date(value).toLocaleString('zh-CN')
}

function directionLabel(value: number | null | undefined) {
  if (value === 1) return '买入/做多'
  if (value === -1) return '卖出/做空'
  return '观望/平仓'
}

function directionType(value: number | null | undefined) {
  if (value === 1) return 'success'
  if (value === -1) return 'danger'
  return 'info'
}

function statusLabel(value: string) {
  return ({ success: '成功', failed: '失败', blocked: '风控拦截' } as Record<string, string>)[value] || value
}

function statusType(value: string) {
  return ({ success: 'success', failed: 'danger', blocked: 'warning' } as Record<string, string>)[value] || 'info'
}

function showDetail(row: ExecutionLog) {
  detailText.value = JSON.stringify({
    id: row.id,
    symbol: row.symbol,
    trigger_time: row.trigger_time,
    status: row.status,
    final_direction: row.final_direction,
    node_snapshots: row.node_snapshots,
    error_msg: row.error_msg,
    plan: row.plan,
  }, null, 2)
  detailVisible.value = true
}

onMounted(loadData)
</script>

<style scoped>
.page-container { max-width: 1280px; margin: 0 auto; }
.page-heading { margin-bottom: 24px; }
.eyebrow { color: #d97706; font-size: 11px; font-weight: 700; letter-spacing: 1.8px; }
h1 { margin: 6px 0; color: #172033; font-size: 36px; }
p { color: #667085; }
.toolbar { display: flex; gap: 12px; margin-bottom: 18px; }
.json-box { margin: 0; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; overflow: auto; max-height: 420px; }
</style>
