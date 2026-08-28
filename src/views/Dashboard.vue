<template>
  <div class="page-container">
    <div class="page-heading">
      <div>
        <span class="eyebrow">EXECUTION CONTROL</span>
        <h1>执行监控</h1>
        <p>跟踪策略运行、事件处理与委托状态。</p>
      </div>
      <el-button :loading="loading" @click="loadData"><el-icon><Refresh /></el-icon>刷新数据</el-button>
    </div>
    <el-alert v-if="error" :title="error" type="error" show-icon closable @close="error = ''" />
    <div class="metrics">
      <div class="metric"><span>执行记录</span><strong>{{ logs.length }}</strong><small>Execution logs</small></div>
      <div class="metric"><span>成功率</span><strong>{{ successRate }}%</strong><small>Completed successfully</small></div>
      <div class="metric"><span>运行中</span><strong>{{ activeRuns }}</strong><small>Active runs</small></div>
      <div class="metric"><span>委托单</span><strong>{{ orders.length }}</strong><small>Orders tracked</small></div>
    </div>
    <section class="panel">
      <div class="panel-header">
        <div><span class="panel-kicker">EXECUTION LOGS</span><h2>策略执行记录</h2></div>
        <el-select v-model="statusFilter" clearable placeholder="全部状态" style="width: 140px"><el-option label="成功" value="success" /><el-option label="失败" value="failed" /><el-option label="已拦截" value="blocked" /></el-select>
      </div>
      <el-table v-loading="loading" :data="filteredLogs" stripe empty-text="暂无执行记录">
        <el-table-column prop="trigger_time" label="触发时间" min-width="180"><template #default="{ row }">{{ formatDate(row.trigger_time) }}</template></el-table-column>
        <el-table-column prop="symbol" label="标的" width="120" />
        <el-table-column prop="final_direction" label="方向" width="100"><template #default="{ row }"><el-tag :type="directionType(row.final_direction)">{{ directionLabel(row.final_direction) }}</el-tag></template></el-table-column>
        <el-table-column prop="status" label="状态" width="110"><template #default="{ row }"><el-tag :type="statusType(row.status)">{{ statusLabel(row.status) }}</el-tag></template></el-table-column>
        <el-table-column prop="duration_ms" label="耗时" width="110"><template #default="{ row }">{{ row.duration_ms ?? '-' }} ms</template></el-table-column>
        <el-table-column prop="error_msg" label="异常" min-width="220" show-overflow-tooltip />
      </el-table>
    </section>
    <section class="panel">
      <div class="panel-header"><div><span class="panel-kicker">ORDERS</span><h2>委托单</h2></div><span class="count-label">{{ orders.length }} 条</span></div>
      <el-table v-loading="loading" :data="orders" stripe empty-text="暂无委托单">
        <el-table-column prop="symbol" label="标的" width="120" /><el-table-column prop="direction" label="方向" width="100"><template #default="{ row }"><el-tag :type="row.direction === 'buy' ? 'success' : 'danger'">{{ row.direction === 'buy' ? '买入' : '卖出' }}</el-tag></template></el-table-column>
        <el-table-column prop="price" label="价格" width="120" /><el-table-column prop="volume" label="数量" width="120" /><el-table-column prop="status" label="状态" width="110" /><el-table-column prop="updated_at" label="更新时间" min-width="180"><template #default="{ row }">{{ formatDate(row.updated_at) }}</template></el-table-column>
      </el-table>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Refresh } from '@element-plus/icons-vue'
import { executionApi } from '@/api/execution'
import type { ExecutionLog, Order } from '@/types/api'

const logs = ref<ExecutionLog[]>([])
const orders = ref<Order[]>([])
const activeRuns = ref(0)
const loading = ref(false)
const error = ref('')
const statusFilter = ref('')
const filteredLogs = computed(() => statusFilter.value ? logs.value.filter((log) => log.status === statusFilter.value) : logs.value)
const successRate = computed(() => logs.value.length ? Math.round(logs.value.filter((log) => log.status === 'success').length / logs.value.length * 100) : 0)

async function loadData() {
  loading.value = true
  error.value = ''
  try {
    const [logResponse, orderResponse, runResponse] = await Promise.all([executionApi.logs(), executionApi.orders(), executionApi.runs({ status: 'running' })])
    logs.value = logResponse.data
    orders.value = orderResponse.data
    activeRuns.value = runResponse.data.length
  } catch (cause) {
    error.value = '执行数据加载失败，请确认后端服务已启动。'
    console.error(cause)
  } finally {
    loading.value = false
  }
}

function formatDate(value: string | null) { return value ? new Date(value).toLocaleString('zh-CN') : '-' }
function directionLabel(value: number) { return value === 1 ? '做多' : value === -1 ? '做空' : '观望' }
function directionType(value: number) { return value === 1 ? 'success' : value === -1 ? 'danger' : 'info' }
function statusLabel(value: string) { return value === 'success' ? '成功' : value === 'failed' ? '失败' : '已拦截' }
function statusType(value: string) { return value === 'success' ? 'success' : value === 'failed' ? 'danger' : 'warning' }
onMounted(loadData)
</script>

<style scoped>
.page-container { max-width: 1280px; margin: 0 auto; }
.page-heading, .panel-header { display: flex; align-items: center; justify-content: space-between; gap: 20px; }
.page-heading { margin-bottom: 28px; }
.eyebrow, .panel-kicker { color: #d97706; font-size: 11px; font-weight: 700; letter-spacing: 1.8px; }
h1 { margin: 6px 0; color: #172033; font-size: 36px; } h2 { margin: 4px 0 0; color: #172033; font-size: 20px; } p, .count-label { color: #667085; }
.metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin: 22px 0; }
.metric { padding: 18px 20px; border-left: 3px solid #d97706; background: #fff; box-shadow: 0 8px 24px rgba(23, 32, 51, .06); }
.metric span, .metric small { display: block; color: #667085; } .metric strong { display: block; color: #172033; font-size: 30px; margin: 5px 0; } .metric small { color: #98a2b3; font-size: 11px; }
.panel { padding: 24px; margin-top: 20px; border: 1px solid #e6e8ec; border-radius: 8px; background: #fff; box-shadow: 0 10px 30px rgba(23, 32, 51, .06); }
@media (max-width: 760px) { .metrics { grid-template-columns: repeat(2, 1fr); } .page-heading { align-items: flex-start; } h1 { font-size: 30px; } }
</style>
