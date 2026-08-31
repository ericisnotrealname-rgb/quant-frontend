<template>
  <div class="page-container">
    <div class="page-heading">
      <div>
        <span class="eyebrow">DATASOURCES</span>
        <h1>数据源管理</h1>
        <p>配置第三方行情数据源、查看快照与同步日志，并按标的查询 K 线数据。</p>
      </div>
      <el-button type="primary" @click="openDialog()">新增数据源</el-button>
    </div>

    <el-card class="card-block">
      <div class="toolbar">
        <el-input v-model="keyword" clearable placeholder="搜索数据源名称或类型" style="max-width: 260px" />
        <el-select v-model="activeFilter" clearable placeholder="状态筛选" style="width: 160px">
          <el-option label="启用" :value="true" />
          <el-option label="停用" :value="false" />
        </el-select>
      </div>

      <el-table :data="filteredSources" v-loading="loading" stripe>
        <el-table-column prop="name" label="数据源名称" min-width="160" />
        <el-table-column prop="source_type" label="类型" width="130">
          <template #default="{ row }">
            <el-tag :type="sourceTypeTag(row.source_type)">{{ sourceLabel(row.source_type) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="endpoint" label="Endpoint" min-width="180" show-overflow-tooltip />
        <el-table-column prop="priority" label="优先级" width="100" />
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="row.is_active ? 'success' : 'info'">{{ row.is_active ? '启用' : '停用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="openDialog(row)">编辑</el-button>
            <el-button size="small" type="warning" plain @click="toggleActive(row)">
              {{ row.is_active ? '停用' : '启用' }}
            </el-button>
            <el-popconfirm title="确认删除该数据源？" @confirm="remove(row.id)">
              <template #reference>
                <el-button size="small" type="danger" plain>删除</el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-row :gutter="16" class="section-row">
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-title">实时快照</div>
          </template>
          <el-table :data="snapshots.slice(0, 6)" v-loading="snapshotLoading" stripe>
            <el-table-column prop="symbol.code" label="代码" width="100" />
            <el-table-column prop="price" label="最新价" width="110" />
            <el-table-column prop="change" label="涨跌幅" width="110" />
          </el-table>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-title">K 线同步日志</div>
          </template>
          <el-table :data="syncLogs.slice(0, 6)" v-loading="logsLoading" stripe>
            <el-table-column prop="symbol.code" label="代码" width="100" />
            <el-table-column prop="sync_type" label="类型" width="110" />
            <el-table-column prop="status" label="状态" width="110">
              <template #default="{ row }">
                <el-tag :type="syncStatusType(row.status)">{{ syncStatusLabel(row.status) }}</el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑数据源' : '新增数据源'" width="560px">
      <el-form :model="form" label-width="110px">
        <el-form-item label="数据源名称" required>
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="数据源类型" required>
          <el-select v-model="form.source_type" style="width: 100%">
            <el-option label="AkShare" value="akshare" />
            <el-option label="TuShare" value="tushare" />
            <el-option label="TDX" value="tdx" />
            <el-option label="YFinance" value="yfinance" />
          </el-select>
        </el-form-item>
        <el-form-item label="Endpoint">
          <el-input v-model="form.endpoint" placeholder="https://..." />
        </el-form-item>
        <el-form-item label="优先级">
          <el-input-number v-model="form.priority" :min="0" :max="99" />
        </el-form-item>
        <el-form-item label="是否启用">
          <el-switch v-model="form.is_active" />
        </el-form-item>
        <el-form-item label="Auth Info">
          <el-input v-model="authInfoText" type="textarea" :rows="4" placeholder='{"token":"..."}' />
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
import { datasourcesApi } from '@/api/datasources'
import type { DataSourceItem, KLineSyncLogItem, RealtimeSnapshotItem } from '@/api/datasources'

const sources = ref<DataSourceItem[]>([])
const snapshots = ref<RealtimeSnapshotItem[]>([])
const syncLogs = ref<KLineSyncLogItem[]>([])
const loading = ref(false)
const snapshotLoading = ref(false)
const logsLoading = ref(false)
const saving = ref(false)
const dialogVisible = ref(false)
const editingId = ref<number | null>(null)
const keyword = ref('')
const activeFilter = ref<boolean | ''>('')

const form = ref({
  name: '',
  source_type: 'akshare' as DataSourceItem['source_type'],
  endpoint: '',
  priority: 0,
  is_active: true,
})
const authInfoText = ref('{}')

const filteredSources = computed(() => {
  return sources.value.filter((item) => {
    const text = keyword.value.trim().toLowerCase()
    const matchesText = !text || item.name.toLowerCase().includes(text) || item.source_type.toLowerCase().includes(text)
    const matchesState = activeFilter.value === '' || item.is_active === activeFilter.value
    return matchesText && matchesState
  })
})

function resetForm() {
  editingId.value = null
  form.value = {
    name: '',
    source_type: 'akshare',
    endpoint: '',
    priority: 0,
    is_active: true,
  }
  authInfoText.value = '{}'
}

function openDialog(row?: DataSourceItem) {
  if (row) {
    editingId.value = row.id
    form.value = {
      name: row.name,
      source_type: row.source_type,
      endpoint: row.endpoint || '',
      priority: row.priority,
      is_active: row.is_active,
    }
    authInfoText.value = JSON.stringify(row.auth_info ?? {}, null, 2)
  } else {
    resetForm()
  }
  dialogVisible.value = true
}

function sourceLabel(type: string) {
  return ({ akshare: 'AkShare', tushare: 'TuShare', tdx: 'TDX', yfinance: 'YFinance' } as Record<string, string>)[type] || type
}

function sourceTypeTag(type: string) {
  return ({ akshare: 'primary', tushare: 'warning', tdx: 'info', yfinance: 'success' } as Record<string, string>)[type] || 'info'
}

async function loadSources() {
  loading.value = true
  try {
    const response = await datasourcesApi.sources()
    sources.value = response.data
  } catch (error) {
    ElMessage.error('数据源列表加载失败')
    console.error(error)
  } finally {
    loading.value = false
  }
}

async function loadSnapshots() {
  snapshotLoading.value = true
  try {
    const response = await datasourcesApi.snapshots({ limit: 6 })
    snapshots.value = response.data
  } catch (error) {
    console.error(error)
  } finally {
    snapshotLoading.value = false
  }
}

async function loadSyncLogs() {
  logsLoading.value = true
  try {
    const response = await datasourcesApi.syncLogs({ limit: 6 })
    syncLogs.value = response.data
  } catch (error) {
    console.error(error)
  } finally {
    logsLoading.value = false
  }
}

async function submitForm() {
  if (!form.value.name.trim()) {
    ElMessage.warning('数据源名称不能为空')
    return
  }

  let parsedAuthInfo: Record<string, unknown>
  try {
    parsedAuthInfo = authInfoText.value ? JSON.parse(authInfoText.value || '{}') : {}
  } catch (error) {
    ElMessage.warning('Auth Info 必须是合法的 JSON 格式')
    return
  }

  saving.value = true
  try {
    const payload = {
      ...form.value,
      endpoint: form.value.endpoint || null,
      auth_info: parsedAuthInfo,
    }

    if (editingId.value) {
      await datasourcesApi.updateSource(editingId.value, payload)
      ElMessage.success('数据源已更新')
    } else {
      await datasourcesApi.createSource(payload)
      ElMessage.success('数据源已创建')
    }

    dialogVisible.value = false
    resetForm()
    await loadSources()
  } catch (error) {
    ElMessage.error('保存失败')
    console.error(error)
  } finally {
    saving.value = false
  }
}

async function toggleActive(row: DataSourceItem) {
  try {
    await datasourcesApi.updateSource(row.id, { is_active: !row.is_active })
    ElMessage.success(row.is_active ? '已停用' : '已启用')
    await loadSources()
  } catch (error) {
    ElMessage.error('状态更新失败')
    console.error(error)
  }
}

async function remove(id: number) {
  try {
    await datasourcesApi.deleteSource(id)
    ElMessage.success('删除成功')
    await loadSources()
  } catch (error) {
    ElMessage.error('删除失败')
    console.error(error)
  }
}

function syncStatusLabel(value: string) {
  return ({ success: '成功', failed: '失败', partial: '部分成功' } as Record<string, string>)[value] || value
}

function syncStatusType(value: string) {
  return ({ success: 'success', failed: 'danger', partial: 'warning' } as Record<string, string>)[value] || 'info'
}

onMounted(async () => {
  await Promise.all([loadSources(), loadSnapshots(), loadSyncLogs()])
})
</script>

<style scoped>
.page-container { max-width: 1280px; margin: 0 auto; }
.page-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 24px; }
.eyebrow { color: #d97706; font-size: 11px; font-weight: 700; letter-spacing: 1.8px; }
h1 { margin: 6px 0; color: #172033; font-size: 36px; }
p { color: #667085; }
.toolbar { display: flex; gap: 12px; margin-bottom: 16px; }
.card-block { margin-bottom: 16px; }
.section-row { margin-top: 8px; }
.card-title { font-weight: 700; }
</style>
