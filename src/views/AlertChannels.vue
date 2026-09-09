<template>
  <div class="page-container">
    <div class="page-heading">
      <div>
        <span class="eyebrow">CHANNELS</span>
        <h1>告警渠道配置</h1>
        <p>配置应用内 / 邮件通知渠道，设置最低告警级别与类型白名单，决定哪些告警通过何种渠道送达。</p>
      </div>
      <div class="heading-actions">
        <el-button :loading="busy" @click="reloadChannels"><el-icon><Refresh /></el-icon>重新加载</el-button>
        <el-button type="primary" @click="openDialog()"><el-icon><Plus /></el-icon>新增渠道</el-button>
      </div>
    </div>

    <el-alert v-if="error" :title="error" type="error" show-icon closable @close="error = ''" />

    <el-card>
      <el-table :data="channels" v-loading="loading" stripe empty-text="暂无告警渠道">
        <el-table-column prop="channel_type" label="渠道类型" width="120">
          <template #default="{ row }">
            <el-tag :type="row.channel_type === 'email' ? 'primary' : 'success'">{{ row.channel_type_display }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="is_enabled" label="启用" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="row.is_enabled ? 'success' : 'info'">{{ row.is_enabled ? '启用' : '禁用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="min_severity" label="最低级别" width="110">
          <template #default="{ row }">
            <el-tag :type="severityType(row.min_severity)" effect="plain">{{ row.min_severity_display }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="邮件收件人" min-width="180">
          <template #default="{ row }">
            <span v-if="row.email_recipients.length" class="recipients">{{ row.email_recipients.join('，') }}</span>
            <span v-else>—</span>
          </template>
        </el-table-column>
        <el-table-column label="告警类型白名单" min-width="220">
          <template #default="{ row }">
            <template v-if="row.alert_types.length">
              <el-tag v-for="item in row.alert_types" :key="item" size="small" effect="plain">{{ alertTypeLabel(item) }}</el-tag>
            </template>
            <span v-else class="muted">全部类型</span>
          </template>
        </el-table-column>
        <el-table-column prop="updated_at" label="更新时间" width="170">
          <template #default="{ row }">{{ formatDate(row.updated_at) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="openDialog(row)">编辑</el-button>
            <el-popconfirm title="确认删除该渠道？" @confirm="remove(row.id)">
              <template #reference>
                <el-button size="small" type="danger" plain>删除</el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑告警渠道' : '新增告警渠道'" width="600px">
      <el-form :model="form" label-width="110px">
        <el-form-item label="渠道类型" required>
          <el-radio-group v-model="form.channel_type" :disabled="!!editingId">
            <el-radio-button value="in_app">应用内通知</el-radio-button>
            <el-radio-button value="email">邮件通知</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="是否启用">
          <el-switch v-model="form.is_enabled" active-text="启用" inactive-text="禁用" />
        </el-form-item>
        <el-form-item label="最低告警级别" required>
          <el-select v-model="form.min_severity" style="width: 180px">
            <el-option v-for="(label, value) in SEVERITY_LABELS" :key="value" :label="`${label}（${value}）`" :value="value" />
          </el-select>
        </el-form-item>
        <el-form-item label="类型白名单">
          <el-select v-model="form.alert_types" multiple clearable placeholder="空表示全部类型" style="width: 260px">
            <el-option v-for="(label, value) in ALERT_TYPE_LABELS" :key="value" :label="label" :value="value" />
          </el-select>
          <div class="form-tip">留空表示接收所有类型的告警。</div>
        </el-form-item>
        <template v-if="form.channel_type === 'email'">
          <el-form-item label="邮件收件人">
            <el-input v-model="emailRecipientsText" type="textarea" :rows="3" placeholder="每行一个邮箱地址" />
          </el-form-item>
          <el-form-item label="邮件主题前缀">
            <el-input v-model="form.email_subject_prefix" placeholder="[量化交易系统]" style="width: 260px" />
          </el-form-item>
        </template>
</el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitForm">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus, Refresh } from '@element-plus/icons-vue'
import { executionApi } from '@/api/execution'
import type { AlertChannel, AlertSeverity, AlertType } from '@/types/api'

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
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const channels = ref<AlertChannel[]>([])
const loading = ref(false)
const saving = ref(false)
const busy = ref(false)
const error = ref('')
const dialogVisible = ref(false)
const editingId = ref<number | null>(null)
const emailRecipientsText = ref('')

const form = ref<{
  channel_type: AlertChannel['channel_type']
  is_enabled: boolean
  min_severity: AlertSeverity
  alert_types: AlertType[]
  email_subject_prefix: string
}>({
  channel_type: 'in_app',
  is_enabled: true,
  min_severity: 'low',
  alert_types: [],
  email_subject_prefix: '[量化交易系统]',
})

function severityType(value: AlertSeverity) {
  return ({ low: 'info', medium: 'warning', high: 'warning', critical: 'danger' } as Record<AlertSeverity, string>)[value] || 'info'
}
function alertTypeLabel(value: string) {
  return ALERT_TYPE_LABELS[value as AlertType] || value
}
function formatDate(value: string) {
  return value ? new Date(value).toLocaleString('zh-CN') : '-'
}

function parseRecipients(text: string): string[] {
  return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
}

function resetForm() {
  editingId.value = null
  emailRecipientsText.value = ''
  form.value = {
    channel_type: 'in_app',
    is_enabled: true,
    min_severity: 'low',
    alert_types: [],
    email_subject_prefix: '[量化交易系统]',
  }
}

function openDialog(row?: AlertChannel) {
  if (row) {
    editingId.value = row.id
    emailRecipientsText.value = row.email_recipients.join('\n')
    form.value = {
      channel_type: row.channel_type,
      is_enabled: row.is_enabled,
      min_severity: row.min_severity,
      alert_types: row.alert_types,
      email_subject_prefix: row.email_subject_prefix,
    }
  } else {
    resetForm()
  }
  dialogVisible.value = true
}

function validateEmails(emails: string[]): string | null {
  for (const email of emails) {
    if (!EMAIL_PATTERN.test(email)) return `无效的邮箱地址：${email}`
  }
  return null
}

async function loadData() {
  loading.value = true
  error.value = ''
  try {
    const response = await executionApi.alertChannels()
    channels.value = response.data
  } catch (cause) {
    error.value = '告警渠道加载失败，请确认后端服务已启动。'
    console.error(cause)
  } finally {
    loading.value = false
  }
}

async function submitForm() {
  const payload: Partial<AlertChannel> = {
    channel_type: form.value.channel_type,
    is_enabled: form.value.is_enabled,
    min_severity: form.value.min_severity,
    alert_types: form.value.alert_types,
    email_subject_prefix: form.value.email_subject_prefix,
  }

  if (form.value.channel_type === 'email') {
    const recipients = parseRecipients(emailRecipientsText.value)
    const invalid = validateEmails(recipients)
    if (invalid) {
      ElMessage.error(invalid)
      return
    }
    if (!recipients.length) {
      ElMessage.warning('邮件渠道至少需要一个收件人')
      return
    }
    payload.email_recipients = recipients
  } else {
    payload.email_recipients = []
  }

  saving.value = true
  try {
    if (editingId.value) {
      await executionApi.updateAlertChannel(editingId.value, payload)
      ElMessage.success('告警渠道已更新')
    } else {
      await executionApi.createAlertChannel(payload)
      ElMessage.success('告警渠道已创建')
    }
    dialogVisible.value = false
    await loadData()
  } catch (cause: any) {
    const detail = cause?.response?.data
    const message = typeof detail === 'string' ? detail
      : detail?.detail || Object.values(detail ?? {}).flat().join('；') || '保存失败'
    ElMessage.error(String(message))
    console.error(cause)
  } finally {
    saving.value = false
  }
}

async function remove(id: number) {
  try {
    await executionApi.deleteAlertChannel(id)
    ElMessage.success('删除成功')
    await loadData()
  } catch (cause) {
    ElMessage.error('删除失败')
    console.error(cause)
  }
}

async function reloadChannels() {
  busy.value = true
  try {
    const response = await executionApi.reloadAlertChannels()
    ElMessage.success(response.data.message)
  } catch (cause) {
    ElMessage.error('重新加载配置失败')
    console.error(cause)
  } finally {
    busy.value = false
  }
}

onMounted(loadData)
</script>
<style scoped>
.page-container { max-width: 1200px; margin: 0 auto; }
.page-heading { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-bottom: 24px; }
.heading-actions { display: flex; gap: 10px; }
.eyebrow { color: #d97706; font-size: 11px; font-weight: 700; letter-spacing: 1.8px; }
h1 { margin: 6px 0; color: #172033; font-size: 36px; }
p { color: #667085; }
.recipients { color: #475467; }
.muted { color: #98a2b3; }
.form-tip { color: #98a2b3; font-size: 12px; line-height: 1.6; }
@media (max-width: 760px) { h1 { font-size: 30px; } }
</style>