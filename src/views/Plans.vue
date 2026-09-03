<template>
  <div class="page-container">
    <div class="page-heading">
      <div>
        <span class="eyebrow">PLAN</span>
        <h1>Plan 管理</h1>
        <p>配置调度计划并管理发布状态。</p>
      </div>
      <el-button type="primary" @click="openDialog()">新增 Plan</el-button>
    </div>

    <el-card>
      <el-table :data="plans" v-loading="loading" stripe>
        <el-table-column prop="name" label="名称" min-width="180" />
        <el-table-column prop="trigger_type" label="触发类型" width="150">
          <template #default="{ row }">{{ triggerLabel(row.trigger_type) }}</template>
        </el-table-column>
        <el-table-column prop="root_suite" label="根 Suite ID" width="120" />
        <el-table-column prop="status" label="状态" width="120">
          <template #default="{ row }"><el-tag :type="statusType(row.status)">{{ statusLabel(row.status) }}</el-tag></template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="openDialog(row)">编辑</el-button>
            <el-button size="small" @click="publish(row.id)">发布</el-button>
            <el-popconfirm title="确认删除该 Plan？" @confirm="remove(row.id)">
              <template #reference>
                <el-button size="small" type="danger" plain>删除</el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑 Plan' : '新增 Plan'" width="620px">
      <el-form :model="form" label-width="120px">
        <el-form-item label="名称" required>
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="触发类型" required>
          <el-select v-model="form.trigger_type" style="width: 100%">
            <el-option label="time" value="time" />
            <el-option label="event" value="event" />
            <el-option label="manual" value="manual" />
          </el-select>
        </el-form-item>
        <el-form-item label="Cron 表达式">
          <el-input v-model="form.cron_expr" />
        </el-form-item>
        <el-form-item label="根 Suite ID" required>
          <el-input v-model.number="form.root_suite" />
        </el-form-item>
        <el-form-item label="标的范围类型" required>
          <el-select v-model="form.scopeType" style="width: 100%"><el-option label="全部标的" value="all" /><el-option label="按分组" value="groups" /><el-option label="按标的" value="symbols" /></el-select>
        </el-form-item>
        <el-form-item v-if="form.scopeType === 'groups'" label="分组">
          <el-select v-model="form.groupIds" multiple filterable style="width: 100%"><el-option v-for="group in groups" :key="group.id" :label="group.name" :value="group.id" /></el-select>
        </el-form-item>
        <el-form-item v-if="form.scopeType === 'symbols'" label="标的">
          <el-select v-model="form.symbolCodes" multiple filterable style="width: 100%"><el-option v-for="symbol in symbols" :key="symbol.id" :label="`${symbol.code} ${symbol.name}`" :value="symbol.code" /></el-select>
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
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { strategyApi } from '@/api/strategy'
import { watchlistsApi } from '@/api/watchlists'
import type { GroupItem, PlanItem, SymbolItem } from '@/types/api'

const plans = ref<PlanItem[]>([])
const groups = ref<GroupItem[]>([])
const symbols = ref<SymbolItem[]>([])
const loading = ref(false)
const saving = ref(false)
const dialogVisible = ref(false)
const editingId = ref<number | null>(null)
const form = ref({
  name: '',
  trigger_type: 'manual' as PlanItem['trigger_type'],
  cron_expr: '',
  root_suite: 0,
  scopeType: 'all' as 'all' | 'groups' | 'symbols',
  groupIds: [] as number[],
  symbolCodes: [] as string[],
})

function statusLabel(value: string) {
  return ({ draft: '草稿', published: '已发布', archived: '已归档' } as Record<string, string>)[value] || value
}

function statusType(value: string) {
  return ({ draft: 'info', published: 'primary', archived: 'warning' } as Record<string, string>)[value] || 'info'
}

function triggerLabel(value: string) {
  return ({ time: 'time', event: 'event', manual: 'manual' } as Record<string, string>)[value] || value
}

function resetForm() {
  form.value = {
    name: '',
    trigger_type: 'manual',
    cron_expr: '',
    root_suite: 0,
    scopeType: 'all', groupIds: [], symbolCodes: [],
  }
  editingId.value = null
}

function openDialog(row?: PlanItem) {
  if (row) {
    editingId.value = row.id
    form.value = {
      name: row.name,
      trigger_type: row.trigger_type,
      cron_expr: row.cron_expr || '',
      root_suite: row.root_suite,
      scopeType: (row.symbol_scope?.type as 'all' | 'groups' | 'symbols') || 'all', groupIds: Array.isArray(row.symbol_scope?.group_ids) ? row.symbol_scope.group_ids as number[] : [], symbolCodes: Array.isArray(row.symbol_scope?.symbol_codes) ? row.symbol_scope.symbol_codes as string[] : [],
    }
  } else {
    resetForm()
  }
  dialogVisible.value = true
}

async function loadData() {
  loading.value = true
  try {
    const response = await strategyApi.plans()
    plans.value = response.data
  } catch (error) {
    ElMessage.error('Plan 列表加载失败')
    console.error(error)
  } finally {
    loading.value = false
  }
}

async function submitForm() {
  if (!form.value.name.trim() || !form.value.root_suite) {
    ElMessage.warning('名称和根 Suite ID 为必填项')
    return
  }
  const symbolScope = form.value.scopeType === 'all' ? { type: 'all' } : form.value.scopeType === 'groups' ? { type: 'groups', group_ids: form.value.groupIds } : { type: 'symbols', symbol_codes: form.value.symbolCodes }
  if (form.value.scopeType === 'groups' && !form.value.groupIds.length) return ElMessage.warning('请选择至少一个分组')
  if (form.value.scopeType === 'symbols' && !form.value.symbolCodes.length) return ElMessage.warning('请选择至少一个标的')

  saving.value = true
  try {
    const payload = {
      name: form.value.name,
      trigger_type: form.value.trigger_type,
      cron_expr: form.value.cron_expr || null,
      root_suite: form.value.root_suite,
      symbol_scope: symbolScope,
    }
    if (editingId.value) {
      await strategyApi.createPlan(payload)
      ElMessage.success('Plan 已更新')
    } else {
      await strategyApi.createPlan(payload)
      ElMessage.success('Plan 已创建')
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
    await strategyApi.publishPlan(id)
    ElMessage.success('Plan 已发布')
    await loadData()
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.detail || '发布失败')
  }
}

async function remove(id: number) {
  try {
    const response = await fetch(`/api/plans/${id}/`, {
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

onMounted(async () => { await loadData(); const [groupResponse, symbolResponse] = await Promise.all([watchlistsApi.groups(), watchlistsApi.symbols({ limit: 500 })]); groups.value = groupResponse.data; symbols.value = symbolResponse.data })
</script>

<style scoped>
.page-container { max-width: 1280px; margin: 0 auto; }
.page-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 24px; }
.eyebrow { color: #d97706; font-size: 11px; font-weight: 700; letter-spacing: 1.8px; }
h1 { margin: 6px 0; color: #172033; font-size: 36px; }
p { color: #667085; }
</style>
