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

      <div v-if="klineRows.length" class="kline-chart-wrap">
        <div class="chart-toolbar">
          <el-checkbox v-model="showMa">显示 MA</el-checkbox>
          <el-checkbox v-model="showVolume">显示成交量</el-checkbox>
          <el-checkbox v-model="showMacd">显示 MACD</el-checkbox>
          <el-checkbox v-model="showKdj">显示 KDJ</el-checkbox>
          <el-checkbox v-model="showRsi">显示 RSI</el-checkbox>
        </div>
        <div ref="chartRef" :style="{ height: chartHeight }" class="kline-chart" />
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
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { echarts } from '@/utils/echarts'
import type { EChartsType } from '@/utils/echarts'
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
const chartRef = ref<HTMLElement | null>(null)
let chartInstance: EChartsType | null = null

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
const showMa = ref(true)
const showVolume = ref(true)
const showMacd = ref(false)
const showKdj = ref(false)
const showRsi = ref(false)

// ================= 修复：动态计算总高度（包含底部滑块空间） =================
const chartHeight = computed(() => {
  const mainHeight = 280
  const panelHeight = 100
  const gap = 10 // 单独分图之间的间距
  const bottomOffset = 60 // 给底部 dataZoom 滑块预留空间，防止遮挡
  const extra = (showVolume.value ? 1 : 0) + (showMacd.value ? 1 : 0) + (showKdj.value ? 1 : 0) + (showRsi.value ? 1 : 0)
  return `${20 + mainHeight + extra * (panelHeight + gap) + bottomOffset}px` // 20 为顶部 legend 预留空间
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

function toNumber(value: string | number | null | undefined) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function calculateMA(data: KLineQueryItem[], period: number) {
  const result: Array<number | null> = []
  for (let i = 0; i < data.length; i += 1) {
    if (i < period - 1) {
      result.push(null)
      continue
    }
    const slice = data.slice(i - period + 1, i + 1)
    const avg = slice.reduce((sum, item) => sum + toNumber(item.close), 0) / period
    result.push(Number(avg.toFixed(4)))
  }
  return result
}

function calculateVolumeColor(close: number, open: number) {
  return close >= open ? '#26a69a' : '#ef5350'
}

function calculateMACD(data: KLineQueryItem[]) {
  const ema = (values: number[], period: number) => {
    const out: number[] = []
    const k = 2 / (period + 1)
    values.forEach((value, index) => {
      if (index === 0) {
        out.push(value)
      } else {
        out.push(value * k + out[index - 1] * (1 - k))
      }
    })
    return out
  }

  const closes = data.map((item) => toNumber(item.close))
  const ema12 = ema(closes, 12)
  const ema26 = ema(closes, 26)
  const dif = closes.map((_, index) => Number((ema12[index] - ema26[index]).toFixed(4)))
  const deaValues: number[] = []
  for (let i = 0; i < dif.length; i += 1) {
    if (i === 0) {
      deaValues.push(dif[i])
    } else {
      const prev = deaValues[i - 1] ?? dif[i - 1]
      const next = dif[i] * (2 / (9 + 1)) + prev * (1 - 2 / (9 + 1))
      deaValues.push(Number(next.toFixed(4)))
    }
  }
  const macd = dif.map((value, index) => Number(((value - (deaValues[index] ?? value)) * 2).toFixed(4)))
  return { dif, dea: deaValues, macd }
}

function calculateRSI(data: KLineQueryItem[], period = 14) {
  const closes = data.map((item) => toNumber(item.close))
  const result: Array<number | null> = []
  for (let i = 0; i < closes.length; i += 1) {
    if (i === 0) {
      result.push(50)
      continue
    }

    let gains = 0
    let losses = 0
    for (let j = Math.max(0, i - period + 1); j <= i; j += 1) {
      const delta = closes[j] - closes[j - 1 < 0 ? j : j - 1]
      if (delta >= 0) gains += delta
      else losses += Math.abs(delta)
    }

    if (i < period) {
      result.push(50)
      continue
    }

    const rs = losses === 0 ? 100 : gains / losses
    result.push(Number((100 - 100 / (1 + rs)).toFixed(4)))
  }
  return result
}

function calculateKDJ(data: KLineQueryItem[], period = 9) {
  const closes = data.map((item) => toNumber(item.close))
  const highs = data.map((item) => toNumber(item.high))
  const lows = data.map((item) => toNumber(item.low))
  const kValues: Array<number | null> = []
  const dValues: Array<number | null> = []
  const jValues: Array<number | null> = []

  for (let i = 0; i < data.length; i += 1) {
    const start = Math.max(0, i - period + 1)
    const windowHigh = Math.max(...highs.slice(start, i + 1))
    const windowLow = Math.min(...lows.slice(start, i + 1))
    const rsv = windowHigh === windowLow ? 50 : ((closes[i] - windowLow) / (windowHigh - windowLow)) * 100

    if (i === 0) {
      kValues.push(50)
      dValues.push(50)
      jValues.push(50)
      continue
    }

    const prevK = kValues[i - 1] ?? 50
    const prevD = dValues[i - 1] ?? 50
    const k = rsv * 1 / 3 + prevK * 2 / 3
    const d = k * 1 / 3 + prevD * 2 / 3
    const j = 3 * k - 2 * d

    kValues.push(Number(k.toFixed(4)))
    dValues.push(Number(d.toFixed(4)))
    jValues.push(Number(j.toFixed(4)))
  }

  return { k: kValues, d: dValues, j: jValues }
}

function renderKlineChart(rows: KLineQueryItem[]) {
  if (!chartRef.value) return

  if (!chartInstance) {
    chartInstance = echarts.init(chartRef.value)
  }

  const sortedRows = [...rows].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const dates = sortedRows.map((item) => item.date)
  const candleData = sortedRows.map((item) => [
    toNumber(item.open),
    toNumber(item.close),
    toNumber(item.low),
    toNumber(item.high),
  ])
  const ma5 = calculateMA(sortedRows, 5)
  const ma10 = calculateMA(sortedRows, 10)
  const ma20 = calculateMA(sortedRows, 20)
  const volumeData = sortedRows.map((item) => ({
    value: toNumber(item.volume),
    itemStyle: {
      color: calculateVolumeColor(toNumber(item.close), toNumber(item.open)),
    },
  }))
  const { dif, dea, macd } = calculateMACD(sortedRows)
  const { k, d, j } = calculateKDJ(sortedRows)
  const rsi = calculateRSI(sortedRows)

  // ================= 修改：动态计算 Y 轴最大/最小值并预留高度 + 取整 =================
  // MACD：围绕 0 轴对称，取绝对值最大的一项，并预留 20% 的余量，向上取整
  const macdMaxAbs = Math.ceil(
    Math.max(
      ...dif.map(Math.abs),
      ...dea.map(Math.abs),
      ...macd.map(Math.abs)
    ) * 1.2
  )

  // KDJ：基于基础范围 0-100，如数据超出则动态扩充边界，并预留 15% 空间
  const kdjMax = Math.max(...k.filter(v => v !== null), ...d.filter(v => v !== null), ...j.filter(v => v !== null))
  const kdjMin = Math.min(...k.filter(v => v !== null), ...d.filter(v => v !== null), ...j.filter(v => v !== null))
  const kdjRange = kdjMax - kdjMin
  const kdjBoundaryMax = Math.ceil(Math.max(100, kdjMax + kdjRange * 0.15)) // 向上取整
  const kdjBoundaryMin = Math.floor(Math.min(0, kdjMin - kdjRange * 0.15)) // 向下取整

  // RSI：基于基础范围 0-100，如数据超出则动态扩充边界，并预留 15% 空间
  const rsiMax = Math.max(...rsi.filter(v => v !== null))
  const rsiMin = Math.min(...rsi.filter(v => v !== null))
  const rsiRange = rsiMax - rsiMin
  const rsiBoundaryMax = Math.ceil(Math.max(100, rsiMax + rsiRange * 0.15)) // 向上取整
  const rsiBoundaryMin = Math.floor(Math.min(0, rsiMin - rsiRange * 0.15)) // 向下取整
  // ==============================================================================

  // 独立分图构建，确保取消勾选后彻底隐藏且自动向上排布
  const grids: any[] = []
  let currentTop = 20
  const mainHeight = 280
  const panelHeight = 100
  const gap = 10 // 独立分图之间的间隙

  // 主K线图
  grids.push({ left: 16, right: 16, top: currentTop, height: mainHeight, containLabel: true })
  currentTop += mainHeight + gap

  // 成交量
  if (showVolume.value) {
    grids.push({ left: 16, right: 16, top: currentTop, height: panelHeight, containLabel: true })
    currentTop += panelHeight + gap
  }

  // MACD
  if (showMacd.value) {
    grids.push({ left: 16, right: 16, top: currentTop, height: panelHeight, containLabel: true })
    currentTop += panelHeight + gap
  }

  // KDJ
  if (showKdj.value) {
    grids.push({ left: 16, right: 16, top: currentTop, height: panelHeight, containLabel: true })
    currentTop += panelHeight + gap
  }

  // RSI
  if (showRsi.value) {
    grids.push({ left: 16, right: 16, top: currentTop, height: panelHeight, containLabel: true })
    currentTop += panelHeight + gap
  }

  const xAxis: any[] = [{
    type: 'category',
    data: dates,
    boundaryGap: false,
    axisLine: { lineStyle: { color: '#d9dee8' } },
    axisTick: { show: false },
    axisLabel: { color: '#667085', fontSize: 10 },
    splitLine: { show: false },
  }]
  const yAxis: any[] = [{
    type: 'value',
    scale: true,
    boundaryGap: [0.01, 0.01],
    axisLabel: { color: '#667085' },
    splitLine: { lineStyle: { color: '#edf1f7' } },
  }]
  const series: any[] = [{
    name: 'K线',
    type: 'candlestick',
    data: candleData,
    itemStyle: {
      color: '#26a69a',
      color0: '#ef5350',
      borderColor: '#26a69a',
      borderColor0: '#ef5350',
    },
    xAxisIndex: 0,
    yAxisIndex: 0,
  }]

  if (showMa.value) {
    const maSeries = [
      { name: 'MA5', data: ma5, color: '#7c4dff' },
      { name: 'MA10', data: ma10, color: '#ffb300' },
      { name: 'MA20', data: ma20, color: '#29b6f6' },
    ]
    maSeries.forEach((item) => {
      series.push({
        name: item.name,
        type: 'line',
        smooth: true,
        data: item.data,
        lineStyle: { width: 1.5, color: item.color },
        symbol: 'none',
      })
    })
  }

  // 动态记录当前附图索引，保证和 grids 数组索引对应
  let currentGridIndex = 1
  let currentAxisIndex = 1

  // 1: 成交量
  if (showVolume.value) {
    xAxis.push({
      type: 'category',
      gridIndex: currentGridIndex,
      data: dates,
      boundaryGap: false,
      axisLine: { lineStyle: { color: '#d9dee8' } },
      axisTick: { show: false },
      axisLabel: { show: false },
      splitLine: { show: false },
    })
    yAxis.push({
      type: 'value',
      gridIndex: currentGridIndex,
      scale: true,
      axisLabel: { color: '#667085', formatter: (value: number) => `${(value / 10000).toFixed(1)}w` },
      splitLine: { lineStyle: { color: '#edf1f7' } },
    })
    series.push({
      name: '成交量',
      type: 'bar',
      xAxisIndex: currentAxisIndex,
      yAxisIndex: currentAxisIndex,
      data: volumeData,
      barWidth: '60%',
      itemStyle: {
        color: (params: any) => {
          const index = params.dataIndex
          const current = sortedRows[index]
          if (!current) return '#26a69a'
          return calculateVolumeColor(toNumber(current.close), toNumber(current.open))
        },
      },
    })
    currentGridIndex++
    currentAxisIndex++
  }

  // 2: MACD (应用动态 Y 轴配置)
  if (showMacd.value) {
    xAxis.push({
      type: 'category',
      gridIndex: currentGridIndex,
      data: dates,
      boundaryGap: false,
      axisLine: { lineStyle: { color: '#d9dee8' } },
      axisTick: { show: false },
      axisLabel: { show: false },
      splitLine: { show: false },
    })
    yAxis.push({
      type: 'value',
      gridIndex: currentGridIndex,
      axisLabel: { color: '#667085' },
      max: macdMaxAbs, // 向上取整后传入，负数取反即为向下取整
      min: -macdMaxAbs, 
      splitLine: { lineStyle: { color: '#edf1f7' } },
    })
    series.push({
      name: 'DIF',
      type: 'line',
      xAxisIndex: currentAxisIndex,
      yAxisIndex: currentAxisIndex,
      data: dif,
      smooth: true,
      lineStyle: { width: 1.5, color: '#5b8def' },
      symbol: 'none',
    })
    series.push({
      name: 'DEA',
      type: 'line',
      xAxisIndex: currentAxisIndex,
      yAxisIndex: currentAxisIndex,
      data: dea,
      smooth: true,
      lineStyle: { width: 1.5, color: '#f59e0b' },
      symbol: 'none',
    })
    series.push({
      name: 'MACD',
      type: 'bar',
      xAxisIndex: currentAxisIndex,
      yAxisIndex: currentAxisIndex,
      data: macd,
      barWidth: '60%',
      itemStyle: {
        color: (params: any) => (params.data >= 0 ? '#26a69a' : '#ef5350'),
      },
    })
    currentGridIndex++
    currentAxisIndex++
  }

  // 3: KDJ (应用动态 Y 轴配置)
  if (showKdj.value) {
    xAxis.push({
      type: 'category',
      gridIndex: currentGridIndex,
      data: dates,
      boundaryGap: false,
      axisLine: { lineStyle: { color: '#d9dee8' } },
      axisTick: { show: false },
      axisLabel: { show: false },
      splitLine: { show: false },
    })
    yAxis.push({
      type: 'value',
      gridIndex: currentGridIndex,
      min: kdjBoundaryMin, // 向下取整
      max: kdjBoundaryMax, // 向上取整
      axisLabel: { color: '#667085' },
      splitLine: { lineStyle: { color: '#edf1f7' } },
    })
    series.push({
      name: 'K',
      type: 'line',
      xAxisIndex: currentAxisIndex,
      yAxisIndex: currentAxisIndex,
      data: k,
      smooth: true,
      lineStyle: { width: 1.5, color: '#ec4899' },
      symbol: 'none',
    })
    series.push({
      name: 'D',
      type: 'line',
      xAxisIndex: currentAxisIndex,
      yAxisIndex: currentAxisIndex,
      data: d,
      smooth: true,
      lineStyle: { width: 1.5, color: '#8b5cf6' },
      symbol: 'none',
    })
    series.push({
      name: 'J',
      type: 'line',
      xAxisIndex: currentAxisIndex,
      yAxisIndex: currentAxisIndex,
      data: j,
      smooth: true,
      lineStyle: { width: 1.5, color: '#f97316' },
      symbol: 'none',
    })
    currentGridIndex++
    currentAxisIndex++
  }

  // 4: RSI (应用动态 Y 轴配置)
  if (showRsi.value) {
    xAxis.push({
      type: 'category',
      gridIndex: currentGridIndex,
      data: dates,
      boundaryGap: false,
      axisLine: { lineStyle: { color: '#d9dee8' } },
      axisTick: { show: false },
      axisLabel: { show: false },
      splitLine: { show: false },
    })
    yAxis.push({
      type: 'value',
      gridIndex: currentGridIndex,
      min: rsiBoundaryMin, // 向下取整
      max: rsiBoundaryMax, // 向上取整
      axisLabel: { color: '#667085' },
      splitLine: { lineStyle: { color: '#edf1f7' } },
    })
    series.push({
      name: 'RSI',
      type: 'line',
      xAxisIndex: currentAxisIndex,
      yAxisIndex: currentAxisIndex,
      data: rsi,
      smooth: true,
      lineStyle: { width: 1.5, color: '#10b981' },
      symbol: 'none',
    })
    series.push({
      name: 'RSI 70',
      type: 'line',
      xAxisIndex: currentAxisIndex,
      yAxisIndex: currentAxisIndex,
      data: Array(dates.length).fill(70),
      lineStyle: { width: 1, color: '#f59e0b', type: 'dashed' },
      symbol: 'none',
      silent: true,
    })
    series.push({
      name: 'RSI 30',
      type: 'line',
      xAxisIndex: currentAxisIndex,
      yAxisIndex: currentAxisIndex,
      data: Array(dates.length).fill(30),
      lineStyle: { width: 1, color: '#6b7280', type: 'dashed' },
      symbol: 'none',
      silent: true,
    })
  }

  // 传入 true (notMerge) 强制全量重绘，彻底消除隐藏后残留的旧图重叠
  chartInstance.setOption({
    backgroundColor: '#fff',
    animation: false,
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      backgroundColor: 'rgba(17, 24, 39, 0.88)',
      borderWidth: 0,
      textStyle: { color: '#fff' },
    },
    legend: {
      top: 0,
      left: 'center',
      data: series.filter((item) => item.name && !['RSI 70', 'RSI 30'].includes(item.name)).map((item) => item.name),
      textStyle: { fontSize: 11 },
    },
    grid: grids,
    xAxis,
    yAxis,
    dataZoom: [
      {
        type: 'inside',
        start: 60,
        end: 100,
        xAxisIndex: xAxis.map((_, i) => i),
      },
      {
        type: 'slider',
        show: true,
        start: 60,
        end: 100,
        bottom: 10,
      },
    ],
    series,
  }, true)
}

// ================= 修复：监听 chartHeight 变化，并调用 resize 使图表自适应 =================
watch(
  [klineRows, showVolume, showMacd, showKdj, showRsi, chartHeight],
  ([rows]) => {
    if (rows.length) {
      nextTick(() => {
        renderKlineChart(rows)
        chartInstance?.resize() // 高度变化后强制重绘，防止变形重叠
      })
    }
  },
  { deep: true },
)

onBeforeUnmount(() => {
  chartInstance?.dispose()
})

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
.kline-chart-wrap { margin-top: 16px; }
.chart-toolbar { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 12px; }
.kline-chart { width: 100%; min-height: 420px; }
</style>