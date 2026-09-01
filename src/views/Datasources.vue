<template>
  <div class="page-container">
    <div class="page-heading">
      <div>
        <span class="eyebrow">DATASOURCES</span>
        <h1>数据源管理</h1>
        <p>配置第三方行情数据源、查看快照与同步日志，并按标的手动拉取和更新 K 线数据。</p>
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

    <el-card class="card-block sync-card">
      <template #header>
        <div class="card-title">按标的手动同步 K 线数据</div>
      </template>

      <el-form :model="syncForm" inline class="sync-form">
        <el-form-item label="标的">
          <el-select v-model="syncForm.symbol" placeholder="请选择标的" clearable style="width: 180px">
            <el-option
              v-for="symbol in symbolOptions"
              :key="symbol.id"
              :label="`${symbol.code} ${symbol.name}`"
              :value="symbol.code"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="同步类型">
          <el-select v-model="syncForm.sync_type" style="width: 140px">
            <el-option label="日线" value="daily" />
            <el-option label="分钟线" value="minute" disabled />
          </el-select>
        </el-form-item>
        <el-form-item label="开始日期">
          <el-date-picker v-model="syncForm.start_date" type="date" value-format="YYYY-MM-DD" style="width: 150px" />
        </el-form-item>
        <el-form-item label="结束日期">
          <el-date-picker v-model="syncForm.end_date" type="date" value-format="YYYY-MM-DD" style="width: 150px" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="syncLoading" @click="handleSyncKline">拉取并更新</el-button>
        </el-form-item>
        <el-form-item>
          <el-button plain @click="handleQueryKline">查询 K 线</el-button>
        </el-form-item>
      </el-form>

      <div v-if="klineRows.length" class="kline-table-wrap">
        <el-table :data="klineRows.slice(0, 10)" stripe>
          <el-table-column prop="date" label="日期" width="120" />
          <el-table-column prop="open" label="开盘" width="100" />
          <el-table-column prop="high" label="最高" width="100" />
          <el-table-column prop="low" label="最低" width="100" />
          <el-table-column prop="close" label="收盘" width="100" />
          <el-table-column prop="volume" label="成交量" width="120" />
        </el-table>
      </div>
      <el-empty v-else description="请选择标的并查询 / 更新 K 线数据" :image-size="80" />
    </el-card>

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
import { watchlistsApi } from '@/api/watchlists'
import type { DataSourceItem, KLineQueryItem, KLineSyncLogItem, RealtimeSnapshotItem } from '@/api/datasources'
import type { SymbolItem } from '@/types/api'

const sources = ref<DataSourceItem[]>([])
const snapshots = ref<RealtimeSnapshotItem[]>([])
const syncLogs = ref<KLineSyncLogItem[]>([])
const symbolOptions = ref<SymbolItem[]>([])
const klineRows = ref<KLineQueryItem[]>([])
const loading = ref(false)
const snapshotLoading = ref(false)
const logsLoading = ref(false)
const saving = ref(false)
const syncLoading = ref(false)
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
const syncForm = ref({
  symbol: '',
  sync_type: 'daily',
  start_date: '',
  end_date: '',
})

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

function defaultDateRange() {
  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - 30)

  const format = (date: Date) => date.toISOString().slice(0, 10)
  syncForm.value.start_date = format(start)
  syncForm.value.end_date = format(end)
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

async function loadSymbolOptions() {
  try {
    const response = await watchlistsApi.symbols({ limit: 500 })
    symbolOptions.value = response.data
    if (!syncForm.value.symbol && response.data[0]) {
      syncForm.value.symbol = response.data[0].code
    }
  } catch (error) {
    console.error(error)
    ElMessage.error('标的列表加载失败')
  }
}

async function handleQueryKline(showMessage = true) {
  if (!syncForm.value.symbol) {
    ElMessage.warning('请选择一个标的后再查询')
    return
  }

  if (!syncForm.value.start_date || !syncForm.value.end_date) {
    ElMessage.warning('查询前请先选择日期范围')
    return
  }

  try {
    const response = await datasourcesApi.queryKline({
      symbol: syncForm.value.symbol,
      start: syncForm.value.start_date,
      end: syncForm.value.end_date,
    })
    klineRows.value = response.data

    if (showMessage) {
      ElMessage.success(`已查询到 ${response.data.length} 条 K 线记录`)
    }
  } catch (error) {
    console.error(error)
    ElMessage.error('K 线查询失败')
  }
}

async function handleSyncKline() {
  if (!syncForm.value.symbol) {
    ElMessage.warning('请选择一个标的再同步数据')
    return
  }

  if (!syncForm.value.start_date || !syncForm.value.end_date) {
    ElMessage.warning('请选择开始和结束日期')
    return
  }

  syncLoading.value = true
  try {
    const response = await datasourcesApi.syncKline({
      symbol: syncForm.value.symbol,
      sync_type: syncForm.value.sync_type,
      start_date: syncForm.value.start_date,
      end_date: syncForm.value.end_date,
      adjust: 'qfq',
    })

    const { added, skipped, error } = response.data
    ElMessage.success(`同步完成：新增 ${added} 条，跳过 ${skipped} 条`)
    if (error) {
      ElMessage.warning(error)
    }

    await Promise.all([loadSyncLogs(), handleQueryKline(false)])
  } catch (error) {
    console.error(error)
    ElMessage.error('手动同步失败')
  } finally {
    syncLoading.value = false
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
  defaultDateRange()
  await Promise.all([loadSources(), loadSnapshots(), loadSyncLogs(), loadSymbolOptions()])
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
.sync-card { margin-top: 16px; }
.sync-form { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
.kline-table-wrap { margin-top: 16px; }
</style>
