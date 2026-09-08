<template>
  <div class="page-container">
    <div class="page-heading">
      <div>
        <span class="eyebrow">SUITE</span>
        <h1>Suite 管理</h1>
        <p>编排组合节点并检查拓扑一致性。</p>
      </div>
      <el-button type="primary" @click="openDialog()">新增 Suite</el-button>
    </div>

    <el-card>
      <el-table :data="suites" v-loading="loading" stripe>
        <el-table-column prop="name" label="名称" min-width="180" />
        <el-table-column prop="aggregate_method" label="聚合方式" width="150">
          <template #default="{ row }">{{ aggregateLabel(row.aggregate_method) }}</template>
        </el-table-column>
        <el-table-column prop="version" label="版本" width="90" />
        <el-table-column prop="allocated_capital" label="占用资金" width="120">
          <template #default="{ row }">{{ row.allocated_capital ?? '—' }}</template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="120">
          <template #default="{ row }"><el-tag :type="statusType(row.status)">{{ statusLabel(row.status) }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="run_status" label="运行状态" width="120">
          <template #default="{ row }"><el-tag :type="runStatusType(row.run_status)">{{ runStatusLabel(row.run_status) }}</el-tag></template>
        </el-table-column>
        <el-table-column label="操作" width="360" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="openDialog(row)">编辑</el-button>
            <el-button size="small" @click="viewTopology(row)">查看拓扑</el-button>
            <el-button size="small" @click="publish(row.id)">发布</el-button>
            <el-button v-if="row.run_status === 'new'" size="small" type="success" @click="start(row.id)">启动</el-button>
            <el-button v-if="row.run_status === 'running'" size="small" type="warning" @click="stop(row.id)">停止</el-button>
            <el-popconfirm title="确认删除该 Suite？" @confirm="remove(row.id)">
              <template #reference>
                <el-button size="small" type="danger" plain>删除</el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑 Suite' : '新增 Suite'" width="460px">
      <el-form :model="form" label-width="110px">
        <el-form-item label="名称" required>
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="聚合方式" required>
          <el-select v-model="form.aggregate_method" style="width: 100%">
            <el-option label="加权求和" value="weighted_sum" />
            <el-option label="投票" value="vote" />
            <el-option label="逻辑与" value="and" />
            <el-option label="逻辑或" value="or" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitForm">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="topologyVisible" title="Suite 拓扑" width="720px">
      <pre class="json-box">{{ topologyText }}</pre>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { strategyApi } from '@/api/strategy'
import type { SuiteItem } from '@/types/api'

const suites = ref<SuiteItem[]>([])
const loading = ref(false)
const saving = ref(false)
const dialogVisible = ref(false)
const topologyVisible = ref(false)
const editingId = ref<number | null>(null)
const topologyText = ref('{}')
const form = ref({ name: '', aggregate_method: 'weighted_sum' as SuiteItem['aggregate_method'] })

function statusLabel(value: string) {
  return ({ draft: '草稿', published: '已发布', archived: '已归档' } as Record<string, string>)[value] || value
}

function statusType(value: string) {
  return ({ draft: 'info', published: 'primary', archived: 'warning' } as Record<string, string>)[value] || 'info'
}

function aggregateLabel(value: string) {
  return ({ weighted_sum: '加权求和', vote: '投票', and: '逻辑与', or: '逻辑或' } as Record<string, string>)[value] || value
}

function runStatusLabel(value: string) {
  return ({ new: '草稿', running: '运行中', done: '已完成', interrupt: '已中断', failed: '失败' } as Record<string, string>)[value] || value
}

function runStatusType(value: string) {
  return ({ new: 'info', running: 'primary', done: 'success', interrupt: 'warning', failed: 'danger' } as Record<string, string>)[value] || 'info'
}

async function start(id: number) {
  try {
    await fetch(`/api/suites/${id}/start/`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'X-CSRFToken': document.cookie.match(/csrftoken=([^;]+)/)?.[1] || '' },
    })
    ElMessage.success('Suite 已启动')
    await loadData()
  } catch (error) {
    ElMessage.error('启动失败')
  }
}

async function stop(id: number) {
  try {
    await fetch(`/api/suites/${id}/stop/`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'X-CSRFToken': document.cookie.match(/csrftoken=([^;]+)/)?.[1] || '' },
    })
    ElMessage.success('Suite 已停止')
    await loadData()
  } catch (error) {
    ElMessage.error('停止失败')
  }
}

function resetForm() {
  form.value = { name: '', aggregate_method: 'weighted_sum' }
  editingId.value = null
}

function openDialog(row?: SuiteItem) {
  if (row) {
    editingId.value = row.id
    form.value = { name: row.name, aggregate_method: row.aggregate_method }
  } else {
    resetForm()
  }
  dialogVisible.value = true
}

async function loadData() {
  loading.value = true
  try {
    const response = await strategyApi.suites()
    suites.value = response.data
  } catch (error) {
    ElMessage.error('Suite 列表加载失败')
    console.error(error)
  } finally {
    loading.value = false
  }
}

async function submitForm() {
  if (!form.value.name.trim()) {
    ElMessage.warning('Suite 名称不能为空')
    return
  }
  saving.value = true
  try {
    if (editingId.value) {
      await strategyApi.createSuite({ ...form.value })
      ElMessage.success('Suite 已更新')
    } else {
      await strategyApi.createSuite({ ...form.value })
      ElMessage.success('Suite 已创建')
    }
    dialogVisible.value = false
    resetForm()
    await loadData()
  } catch (error) {
    ElMessage.error('保存失败')
    console.error(error)
  } finally {
    saving.value = false
  }
}

async function publish(id: number) {
  try {
    await strategyApi.publishSuite(id)
    ElMessage.success('Suite 已发布')
    await loadData()
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.detail || '发布失败')
  }
}

async function remove(id: number) {
  try {
    const response = await fetch(`/api/suites/${id}/`, {
      method: 'DELETE',
      credentials: 'same-origin',
      headers: { 'X-CSRFToken': document.cookie.match(/csrftoken=([^;]+)/)?.[1] || '' },
    })
    if (!response.ok) throw new Error('delete failed')
    ElMessage.success('删除成功')
    await loadData()
  } catch (error) {
    ElMessage.error('删除失败')
    console.error(error)
  }
}

async function viewTopology(row: SuiteItem) {
  try {
    const response = await fetch(`/api/suites/${row.id}/topology/`)
    const payload = await response.json()
    topologyText.value = JSON.stringify(payload, null, 2)
    topologyVisible.value = true
  } catch (error) {
    ElMessage.error('拓扑数据加载失败')
    console.error(error)
  }
}

onMounted(loadData)
</script>

<style scoped>
.page-container { max-width: 1280px; margin: 0 auto; }
.page-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 24px; }
.eyebrow { color: #d97706; font-size: 11px; font-weight: 700; letter-spacing: 1.8px; }
h1 { margin: 6px 0; color: #172033; font-size: 36px; }
p { color: #667085; }
.json-box { margin: 0; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; overflow: auto; max-height: 420px; }
</style>
