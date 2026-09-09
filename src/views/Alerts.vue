<template>
  <div class="page-container">
    <div class="page-heading">
      <div>
        <span class="eyebrow">ALERTS</span>
        <h1>告警管理</h1>
        <p>集中查看订单失败、策略/计划执行失败、风控违规与系统错误告警，支持确认、解决与重新发送通知。</p>
      </div>
      <el-button :loading="loading" @click="loadAll">
        <el-icon><Refresh /></el-icon>刷新数据
      </el-button>
    </div>

    <el-alert v-if="error" :title="error" type="error" show-icon closable @close="error = ''" />

    <div class="metrics">
      <div class="metric"><span>待处理</span><strong>{{ stats.pending }}</strong><small>Pending alerts</small></div>
      <div class="metric"><span>已确认</span><strong>{{ stats.acknowledged }}</strong><small>Acknowledged</small></div>
      <div class="metric"><span>高 / 紧急</span><strong>{{ stats.high_severity + stats.critical_severity }}</strong><small>High &amp; critical</small></div>
      <div class="metric"><span>告警总数</span><strong>{{ stats.total }}</strong><small>Total alerts</small></div>
    </div>

    <el-card>
      <div class="toolbar">
        <el-input v-model="filters.search" clearable placeholder="标题 / 消息 / 错误代码" style="max-width: 230px" @keyup.enter="applyFilters" />
        <el-select v-model="filters.alert_type" clearable placeholder="告警类型" style="width: 180px" @change="applyFilters">
          <el-option v-for="(label, value) in ALERT_TYPE_LABELS" :key="value" :label="label" :value="value" />
        </el-select>
        <el-select v-model="filters.severity" clearable placeholder="严重程度" style="width: 150px" @change="applyFilters">
          <el-option v-for="(label, value) in SEVERITY_LABELS" :key="value" :label="label" :value="value" />
        </el-select>
        <el-select v-model="filters.status" clearable placeholder="处理状态" style="width: 150px" @change="applyFilters">
          <el-option v-for="(label, value) in STATUS_LABELS" :key="value" :label="label" :value="value" />
        </el-select>
      </div>

      <el-table :data="filteredAlerts" v-loading="loading" stripe empty-text="暂无告警">
        <el-table-column prop="severity" label="级别" width="90">
          <template #default="{ row }">
            <el-tag :type="severityType(row.severity)" effect="plain" round>{{ row.severity_display }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="alert_type" label="类型" width="130">
          <template #default="{ row }">
            <el-tag :type="alertTypeType(row.alert_type)" effect="plain">{{ row.alert_type_display }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="告警内容" min-width="240">
          <template #default="{ row }">
            <div class="alert-title">{{ row.title }}</div>
            <div class="alert-meta">{{ row.error_code || '—' }}</div>
          </template>
        </el-table-column>
        <el-table-column prop="plan_name" label="关联 Plan" width="130">
          <template #default="{ row }">{{ row.plan_name || '—' }}</template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)">{{ row.status_display }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="通知" width="120" align="center">
          <template #default="{ row }">
            <el-tooltip :content="notificationTip(row)" placement="top">
              <span class="notify-dots">
                <span :class="`dot ${row.in_app_notified ? 'on' : ''}`" title="应用内" />
                <span :class="`dot ${row.email_notified ? 'on' : ''}`" title="邮件" />
              </span>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="170">
          <template #default="{ row }">{{ formatDate(row.created_at) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.status === 'pending'" size="small" type="primary" plain @click="acknowledge(row)">确认</el-button>
            <el-button v-if="row.status !== 'resolved'" size="small" type="success" plain @click="openResolve(row)">解决</el-button>
            <el-button size="small" @click="showDetail(row)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
<el-dialog v-model="resolveDialog.visible" title="解决告警" width="520px">
      <el-form label-position="top">
        <el-form-item :label="`告警：${resolveDialog.alert?.title}`" />
        <el-form-item label="解决备注">
          <el-input v-model="resolveDialog.note" type="textarea" :rows="3" maxlength="500" show-word-limit placeholder="可选，记录处理说明" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="resolveDialog.visible = false">取消</el-button>
        <el-button type="success" :loading="busy" @click="submitResolve">确认解决</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="detailVisible" title="告警详情" width="720px">
      <template v-if="detailAlert">
        <div class="detail-head">
          <el-tag :type="severityType(detailAlert.severity)" effect="plain" round>{{ detailAlert.severity_display }}</el-tag>
          <el-tag :type="statusType(detailAlert.status)">{{ detailAlert.status_display }}</el-tag>
          <el-tag :type="alertTypeType(detailAlert.alert_type)" effect="plain">{{ detailAlert.alert_type_display }}</el-tag>
        </div>
        <el-descriptions :column="2" border>
          <el-descriptions-item label="标题">{{ detailAlert.title }}</el-descriptions-item>
          <el-descriptions-item label="错误代码">{{ detailAlert.error_code || '—' }}</el-descriptions-item>
          <el-descriptions-item label="关联 Plan">{{ detailAlert.plan_name || '—' }}</el-descriptions-item>
          <el-descriptions-item label="Suite 运行">{{ detailAlert.suite_run_display || '—' }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ formatDate(detailAlert.created_at) }}</el-descriptions-item>
          <el-descriptions-item label="更新时间">{{ formatDate(detailAlert.updated_at) }}</el-descriptions-item>
          <el-descriptions-item label="应用内通知">
            <el-tag :type="detailAlert.in_app_notified ? 'success' : 'info'" size="small">{{ detailAlert.in_app_notified ? '已发送' : '未发送' }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="邮件通知">
            <el-tag :type="detailAlert.email_notified ? 'success' : 'info'" size="small">{{ detailAlert.email_notified ? '已发送' : '未发送' }}</el-tag>
          </el-descriptions-item>
        </el-descriptions>
        <div class="message-box">
          <div class="message-label">详细消息</div>
          <pre class="message-text">{{ detailAlert.message }}</pre>
        </div>
        <div v-if="detailAlert.notification_error" class="message-box warning">
          <div class="message-label">通知错误</div>
          <pre class="message-text">{{ detailAlert.notification_error }}</pre>
        </div>
        <div class="detail-actions">
          <el-button v-if="detailAlert.status !== 'resolved'" type="success" plain @click="resend(detailAlert)">重新发送通知</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import { executionApi, unwrapList } from '@/api/execution'
import type { Alert, AlertSeverity, AlertStatus, AlertType, AlertStatistics } from '@/types/api'

const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  order_failed: '订单失败',
  suite_failed: '策略执行失败',
  plan_failed: '计划执行失败',
  risk_violation: '风控违规',
  system_error: '系统错误',
}
const SEVERITY_LABELS: Record<AlertSeverity, string> = {
  low: '低',
  medium: '中',
  high: '高',
  critical: '紧急',
}
const STATUS_LABELS: Record<AlertStatus, string> = {
  pending: '待处理',
  acknowledged: '已确认',
  resolved: '已解决',
}

const alerts = ref<Alert[]>([])
const stats = ref<AlertStatistics['overview']>({ total: 0, pending: 0, acknowledged: 0, resolved: 0, high_severity: 0, critical_severity: 0 })
const loading = ref(false)
const busy = ref(false)
const error = ref('')
const detailVisible = ref(false)
const detailAlert = ref<Alert | null>(null)
const resolveDialog = ref<{ visible: boolean; alert: Alert | null; note: string }>({ visible: false, alert: null, note: '' })
const filters = ref({ search: '', alert_type: '' as AlertType | '', severity: '' as AlertSeverity | '', status: '' as AlertStatus | '' })

const filteredAlerts = computed(() => {
  const keyword = filters.value.search.trim().toLowerCase()
  return alerts.value.filter((item) => {
    const matchSearch = !keyword
      || item.title.toLowerCase().includes(keyword)
      || item.message.toLowerCase().includes(keyword)
      || (item.error_code ?? '').toLowerCase().includes(keyword)
    const matchType = !filters.value.alert_type || item.alert_type === filters.value.alert_type
    const matchSeverity = !filters.value.severity || item.severity === filters.value.severity
    const matchStatus = !filters.value.status || item.status === filters.value.status
    return matchSearch && matchType && matchSeverity && matchStatus
  })
})

function severityType(value: AlertSeverity) {
  return ({ low: 'info', medium: 'warning', high: 'warning', critical: 'danger' } as Record<AlertSeverity, string>)[value] || 'info'
}
function alertTypeType(value: AlertType) {
  return ({ order_failed: 'danger', suite_failed: 'warning', plan_failed: 'warning', risk_violation: 'danger', system_error: 'info' } as Record<AlertType, string>)[value] || 'info'
}
function statusType(value: AlertStatus) {
  return ({ pending: 'warning', acknowledged: 'primary', resolved: 'success' } as Record<AlertStatus, string>)[value] || 'info'
}
function notificationTip(row: Alert) {
  const parts: string[] = []
  parts.push(`应用内：${row.in_app_notified ? '已发送' : '未发送'}`)
  parts.push(`邮件：${row.email_notified ? '已发送' : '未发送'}`)
  if (row.notification_error) parts.push(`错误：${row.notification_error}`)
  return parts.join(' · ')
}
function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString('zh-CN') : '-'
}

function applyFilters() {
  // 过滤器通过 computed 即时生效，此函数用于保留 select 触发入口
}

async function loadData() {
  loading.value = true
  error.value = ''
  try {
    const listResponse = await executionApi.alerts()
    alerts.value = unwrapList<Alert>(listResponse.data)
  } catch (cause) {
    error.value = '告警列表加载失败，请确认后端服务已启动。'
    console.error(cause)
  } finally {
    loading.value = false
  }
}

async function loadStats() {
  try {
    const response = await executionApi.alertStatistics()
    stats.value = response.data.overview
  } catch (cause) {
    console.error(cause)
  }
}

async function loadAll() {
  await Promise.all([loadData(), loadStats()])
}

async function acknowledge(row: Alert) {
  busy.value = true
  try {
    const response = await executionApi.alertAction(row.id, { action: 'acknowledge' })
ElMessage.success(response.data.message)
    await loadAll()
  } catch (cause) {
    ElMessage.error('确认告警失败')
    console.error(cause)
  } finally {
    busy.value = false
  }
}

function openResolve(row: Alert) {
  resolveDialog.value = { visible: true, alert: row, note: '' }
}

async function submitResolve() {
  const alert = resolveDialog.value.alert
  if (!alert) return
  busy.value = true
  try {
    const response = await executionApi.alertAction(alert.id, { action: 'resolve', note: resolveDialog.value.note })
    ElMessage.success(response.data.message)
    resolveDialog.value.visible = false
    await loadAll()
  } catch (cause) {
    ElMessage.error('解决告警失败')
    console.error(cause)
  } finally {
    busy.value = false
  }
}

function showDetail(row: Alert) {
  detailAlert.value = row
  detailVisible.value = true
}

async function resend(row: Alert) {
  busy.value = true
  try {
    const response = await executionApi.resendAlertNotifications(row.id)
    ElMessage.success(response.data.message)
    await loadAll()
  } catch (cause: any) {
    ElMessage.error(String(cause?.response?.data?.detail ?? '重新发送通知失败'))
    console.error(cause)
  } finally {
    busy.value = false
  }
}

onMounted(loadAll)
</script>
<style scoped>
.page-container { max-width: 1400px; margin: 0 auto; }
.page-heading { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-bottom: 24px; }
.eyebrow { color: #d97706; font-size: 11px; font-weight: 700; letter-spacing: 1.8px; }
h1 { margin: 6px 0; color: #172033; font-size: 36px; }
p { color: #667085; }
.toolbar { display: flex; gap: 12px; margin-bottom: 18px; }
.metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 20px; }
.metric { padding: 18px 20px; border-left: 3px solid #d97706; background: #fff; box-shadow: 0 8px 24px rgba(23, 32, 51, .06); }
.metric span, .metric small { display: block; color: #667085; }
.metric strong { display: block; color: #172033; font-size: 30px; margin: 5px 0; }
.metric small { color: #98a2b3; font-size: 11px; }
.alert-title { color: #172033; font-weight: 600; }
.alert-meta { color: #98a2b3; font-size: 12px; }
.notify-dots { display: inline-flex; gap: 6px; }
.dot { width: 10px; height: 10px; border-radius: 50%; background: #e5e7eb; }
.dot.on { background: #44c06e; }
.detail-head { display: flex; gap: 8px; margin-bottom: 18px; }
.message-box { margin-top: 16px; border: 1px solid #e5e7eb; border-radius: 8px; background: #f8fafc; padding: 12px 16px; }
.message-box.warning { border-color: #f0a020; background: #fff7e8; }
.message-label { font-size: 12px; color: #667085; font-weight: 700; margin-bottom: 8px; }
.message-text { margin: 0; white-space: pre-wrap; word-break: break-word; }
.detail-actions { margin-top: 16px; }
@media (max-width: 760px) { .metrics { grid-template-columns: repeat(2, 1fr); } h1 { font-size: 30px; } }
</style>