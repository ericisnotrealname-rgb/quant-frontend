<template>
  <div class="page-container">
    <div class="page-heading">
      <div>
        <span class="eyebrow">CASE</span>
        <h1>Case 管理</h1>
        <p>配置原子策略节点并维护发布状态。</p>
      </div>
      <el-button type="primary" @click="openDialog()">新增 Case</el-button>
    </div>

    <el-card>
      <div class="toolbar">
        <el-select v-model="statusFilter" clearable placeholder="状态筛选" style="width: 160px">
          <el-option label="草稿" value="draft" />
          <el-option label="已发布" value="published" />
          <el-option label="已归档" value="archived" />
        </el-select>
      </div>

      <el-table :data="filteredCases" v-loading="loading" stripe>
        <el-table-column prop="name" label="名称" min-width="180" />
        <el-table-column prop="node_type" label="节点类型" width="140">
          <template #default="{ row }">{{ nodeLabel(row.node_type) }}</template>
        </el-table-column>
        <el-table-column prop="version" label="版本" width="90" />
        <el-table-column prop="status" label="状态" width="120">
          <template #default="{ row }"><el-tag :type="statusType(row.status)">{{ statusLabel(row.status) }}</el-tag></template>
        </el-table-column>
        <el-table-column label="参数" min-width="180">
          <template #default="{ row }">
            <el-tooltip :content="JSON.stringify(row.params, null, 2)" placement="top">
              <span class="json-preview">{{ conciseJson(row.params) }}</span>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button size="small" :disabled="row.status !== 'draft'" @click="openDialog(row)">编辑</el-button>
            <el-button size="small" :disabled="row.status !== 'draft'" @click="publish(row.id)">发布</el-button>
            <el-popconfirm title="确认删除该 Case？" @confirm="remove(row.id)">
              <template #reference>
                <el-button size="small" type="danger" plain :disabled="row.status !== 'draft'">删除</el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑 Case' : '新增 Case'" width="560px">
      <el-form :model="form" label-width="110px">
        <el-form-item label="名称" required>
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="节点类型" required>
          <el-select v-model="form.node_type" style="width: 100%">
            <el-option label="signal" value="signal" />
            <el-option label="filter" value="filter" />
            <el-option label="verdict" value="verdict" />
            <el-option label="executor" value="executor" />
          </el-select>
        </el-form-item>
        <el-form-item label="参数 JSON" required>
          <el-input v-model="form.paramsText" type="textarea" :rows="8" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitForm">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { strategyApi } from '@/api/strategy'
import type { CaseItem } from '@/types/api'

const cases = ref<CaseItem[]>([])
const loading = ref(false)
const saving = ref(false)
const statusFilter = ref('')
const dialogVisible = ref(false)
const editingId = ref<number | null>(null)
const form = ref({ name: '', node_type: 'signal', paramsText: '{}' })

const filteredCases = computed(() => {
  return cases.value.filter((item) => !statusFilter.value || item.status === statusFilter.value)
})

function nodeLabel(value: string) {
  return ({ signal: 'signal', filter: 'filter', verdict: 'verdict', executor: 'executor' } as Record<string, string>)[value] || value
}

function statusLabel(value: string) {
  return ({ draft: '草稿', published: '已发布', archived: '已归档' } as Record<string, string>)[value] || value
}

function statusType(value: string) {
  return ({ draft: 'info', published: 'primary', archived: 'warning' } as Record<string, string>)[value] || 'info'
}

function conciseJson(value: Record<string, unknown>) {
  try {
    return JSON.stringify(value || {})
  } catch {
    return '{}'
  }
}

function resetForm() {
  form.value = { name: '', node_type: 'signal', paramsText: '{}' }
  editingId.value = null
}

function openDialog(row?: CaseItem) {
  if (row) {
    editingId.value = row.id
    form.value = { name: row.name, node_type: row.node_type, paramsText: JSON.stringify(row.params || {}, null, 2) }
  } else {
    resetForm()
  }
  dialogVisible.value = true
}

async function loadData() {
  loading.value = true
  try {
    const response = await strategyApi.cases()
    cases.value = response.data
  } catch (error) {
    ElMessage.error('Case 列表加载失败')
    console.error(error)
  } finally {
    loading.value = false
  }
}

async function submitForm() {
  if (!form.value.name.trim()) {
    ElMessage.warning('Case 名称不能为空')
    return
  }
  try {
    JSON.parse(form.value.paramsText)
  } catch {
    ElMessage.warning('参数必须为合法 JSON')
    return
  }

  saving.value = true
  try {
    const payload: Partial<CaseItem> = {
      name: form.value.name,
      node_type: form.value.node_type as CaseItem['node_type'],
      params: JSON.parse(form.value.paramsText),
    }
    if (editingId.value) {
      await strategyApi.updateCase(editingId.value, payload)
      ElMessage.success('Case 已更新')
    } else {
      await strategyApi.createCase(payload)
      ElMessage.success('Case 已创建')
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
    await strategyApi.publishCase(id)
    ElMessage.success('Case 已发布')
    await loadData()
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.detail || '发布失败')
  }
}

async function remove(id: number) {
  try {
    await fetch(`/api/cases/${id}/`, {
      method: 'DELETE',
      credentials: 'same-origin',
      headers: { 'X-CSRFToken': document.cookie.match(/csrftoken=([^;]+)/)?.[1] || '' },
    })
    ElMessage.success('删除成功')
    await loadData()
  } catch (error) {
    ElMessage.error('删除失败')
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
.toolbar { margin-bottom: 16px; }
.json-preview { display: inline-block; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
