<template>
  <div class="page-container">
    <div class="page-heading">
      <div>
        <span class="eyebrow">DATASOURCES</span>
        <h1>数据源管理</h1>
        <p>查看快照与同步日志，并按标的手动拉取和更新 K 线数据。数据源为内置 ashare + gm 适配层（用户自配第三方数据源已于 2026-09-15 移除）。</p>
      </div>
    </div>

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
          <el-checkbox v-model="showVolume">成交量</el-checkbox>
          <el-checkbox v-model="showMacd">MACD</el-checkbox>
          <el-checkbox v-model="showKdj">KDJ</el-checkbox>
          <el-checkbox v-model="showRsi">RSI</el-checkbox>
          <el-checkbox v-model="showWr">WR</el-checkbox>
          <el-checkbox v-model="showCci">CCI</el-checkbox>
          <el-checkbox v-model="showAtr">ATR</el-checkbox>
          <el-checkbox v-model="showObv">OBV</el-checkbox>
          <el-checkbox v-model="showVr">VR</el-checkbox>
          <el-checkbox v-model="showDmi">DMI</el-checkbox>
        </div>
        <div ref="chartRef" :style="{ height: chartHeight }" class="kline-chart" />
      </div>
      <el-empty
        v-else
        v-loading="queryLoading"
        element-loading-text="K 线加载中..."
        description="请选择标的并查询 / 更新 K 线数据"
        :image-size="80"
      />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { echarts } from '@/utils/echarts'
import type { EChartsType } from '@/utils/echarts'
import { datasourcesApi } from '@/api/datasources'
import { watchlistsApi } from '@/api/watchlists'
import type { KLineQueryItem, KLineSyncLogItem, RealtimeSnapshotItem } from '@/api/datasources'
import type { SymbolItem } from '@/types/api'

const snapshots = ref<RealtimeSnapshotItem[]>([])
const syncLogs = ref<KLineSyncLogItem[]>([])
const symbolOptions = ref<SymbolItem[]>([])
const klineRows = ref<KLineQueryItem[]>([])
const snapshotLoading = ref(false)
const logsLoading = ref(false)
const syncLoading = ref(false)
const queryLoading = ref(false)
const chartRef = ref<HTMLElement | null>(null)
let chartInstance: EChartsType | null = null

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
const showWr = ref(false)
const showCci = ref(false)
const showAtr = ref(false)
const showObv = ref(false)
const showVr = ref(false)
const showDmi = ref(false)

// 附图开关清单：顺序即附图自上而下的排列顺序（渲染按此顺序生成 grid）
const SUB_INDICATOR_FLAGS = [
  { key: 'volume', flag: showVolume },
  { key: 'macd', flag: showMacd },
  { key: 'kdj', flag: showKdj },
  { key: 'rsi', flag: showRsi },
  { key: 'wr', flag: showWr },
  { key: 'cci', flag: showCci },
  { key: 'atr', flag: showAtr },
  { key: 'obv', flag: showObv },
  { key: 'vr', flag: showVr },
  { key: 'dmi', flag: showDmi },
] as const

// ================= 增量数据加载：根据缩放范围自动查询日期 =================
const autoFetching = ref(false)
let loadedStart = '' // 当前已加载数据的最早日期
let loadedEnd = '' // 当前已加载数据的最晚日期
const autoSyncedRanges = new Set<string>() // 已尝试自动同步的日期范围，防止死循环
let zoomStart = 60 // dataZoom 当前 start 百分比
let zoomEnd = 100 // dataZoom 当前 end 百分比
let zoomDebounceTimer: ReturnType<typeof setTimeout> | null = null

// 切换标的时重置增量加载状态，并自动重新查询 K 线
watch(
  () => syncForm.value.symbol,
  async (newSymbol) => {
    klineRows.value = []
    loadedStart = ''
    loadedEnd = ''
    autoSyncedRanges.clear()
    zoomStart = 60
    zoomEnd = 100
    if (zoomDebounceTimer) {
      clearTimeout(zoomDebounceTimer)
      zoomDebounceTimer = null
    }
    // 图表容器在 v-if 内：klineRows 清空后旧 DOM 被移除，
    // 必须销毁绑定在旧 DOM 上的 echarts 实例并置空，
    // 否则后续 setOption 画在已脱离文档的旧 canvas 上，导致 K 线不显示
    chartInstance?.dispose()
    chartInstance = null

    if (newSymbol && syncForm.value.start_date && syncForm.value.end_date) {
      await handleQueryKline(false)
    }
  },
)

// ================= 修复：动态计算总高度（包含底部滑块空间） =================
const chartHeight = computed(() => {
  const mainHeight = 280
  const panelHeight = 100
  const gap = 10 // 单独分图之间的间距
  const bottomOffset = 60 // 给底部 dataZoom 滑块预留空间，防止遮挡
  const extra = SUB_INDICATOR_FLAGS.filter((item) => item.flag.value).length
  return `${20 + mainHeight + extra * (panelHeight + gap) + bottomOffset}px` // 20 为顶部 legend 预留空间
})

function defaultDateRange() {
  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - 300)

  const format = (date: Date) => date.toISOString().slice(0, 10)
  syncForm.value.start_date = format(start)
  syncForm.value.end_date = format(end)
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

async function autoSyncAndQuery(symbol: string, start: string, end: string): Promise<KLineQueryItem[]> {
  const rangeKey = `${symbol}~${start}~${end}`
  if (autoSyncedRanges.has(rangeKey)) return []
  autoSyncedRanges.add(rangeKey)
  try {
    const response = await datasourcesApi.syncKline({
      symbol,
      sync_type: syncForm.value.sync_type,
      start_date: start,
      end_date: end,
      adjust: 'qfq',
    })
    if (response.data.error) {
      ElMessage.warning(`自动拉取数据失败：${response.data.error}`)
    } else {
      ElMessage.success(`已自动拉取 ${response.data.added} 条新数据`)
      await loadSyncLogs()
    }
  } catch (error) {
    console.error(error)
    ElMessage.warning('自动拉取新数据失败，请手动同步')
    return []
  }
  const retry = await datasourcesApi.queryKline({ symbol, start, end })
  return retry.data
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

  const symbol = syncForm.value.symbol
  const start = syncForm.value.start_date
  const end = syncForm.value.end_date

  queryLoading.value = true
  try {
    let rows = (await datasourcesApi.queryKline({ symbol, start, end })).data
    if (!isRangeCovered(rows, start, end)) {
      // 查询结果未完全覆盖查询天数时，自动拉取新数据后重查一次
      rows = await autoSyncAndQuery(symbol, start, end)
    }

    // 查询期间用户已切换标的时丢弃过期结果，避免旧响应覆盖新标的图表
    if (syncForm.value.symbol !== symbol) return

    loadedStart = start
    loadedEnd = end
    klineRows.value = rows
    zoomStart = 60
    zoomEnd = 100
    autoSyncedRanges.clear()

    if (showMessage) {
      ElMessage.success(`已查询到 ${rows.length} 条 K 线记录`)
    }
  } catch (error) {
    console.error(error)
    ElMessage.error('K 线查询失败')
  } finally {
    queryLoading.value = false
  }
}

async function fetchForRange(fetchStart: string, fetchEnd: string) {
  const symbol = syncForm.value.symbol
  if (!symbol || autoFetching.value) return

  autoFetching.value = true
  try {
    let rows = (await datasourcesApi.queryKline({ symbol, start: fetchStart, end: fetchEnd })).data
    if (!isRangeCovered(rows, fetchStart, fetchEnd)) {
      // 返回数据未完全覆盖查询天数时，自动拉取新数据后重查一次
      rows = await autoSyncAndQuery(symbol, fetchStart, fetchEnd)
    }
    // 请求期间用户已切换标的时丢弃过期结果，避免增量数据合并到新标的图表
    if (!rows.length || syncForm.value.symbol !== symbol) return
    mergeKlineRows(rows)
  } catch (error) {
    console.error(error)
  } finally {
    autoFetching.value = false
  }
}

// 边界容差天数：容忍查询区间两端的双休日 / 节假日（无交易日）
const DATE_BOUNDARY_TOLERANCE_DAYS = 7

/**
 * 判断返回的 K 线数据是否完全覆盖查询区间：
 * 区间内最早返回的记录需落在区间起点（含容差）之前或当天，
 * 最晚返回的记录需落在区间终点（含容差）之前或当天，
 * 否则视为该区间数据不完整，需要触发自动同步拉取。
 */
function isRangeCovered(rows: KLineQueryItem[], start: string, end: string) {
  if (!rows.length) return false
  const earliest = rows.reduce((min, row) => (row.date < min ? row.date : min), rows[0].date)
  const latest = rows.reduce((max, row) => (row.date > max ? row.date : max), rows[0].date)
  return earliest <= shiftDate(start, DATE_BOUNDARY_TOLERANCE_DAYS) && latest >= shiftDate(end, -DATE_BOUNDARY_TOLERANCE_DAYS)
}

function shiftDate(dateStr: string, days: number) {
  const date = new Date(dateStr)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

function mergeKlineRows(newRows: KLineQueryItem[]) {
  const map = new Map<string, KLineQueryItem>()
  for (const row of klineRows.value) map.set(row.date, row)
  for (const row of newRows) {
    map.set(row.date, row)
    if (!loadedStart || row.date < loadedStart) loadedStart = row.date
    if (!loadedEnd || row.date > loadedEnd) loadedEnd = row.date
  }
  klineRows.value = [...map.values()]
  // merge 后由 watch(klineRows) 触发全量重绘，缩放百分比通过 zoomStart/zoomEnd 保留
}

function handleChartZoom() {
  if (!chartInstance) return
  const option = chartInstance.getOption() as { dataZoom?: Array<{ start?: number; end?: number }> }
  const dz = option?.dataZoom?.[0]
  if (!dz) return
  zoomStart = dz.start ?? zoomStart
  zoomEnd = dz.end ?? zoomEnd

  const total = klineRows.value.length
  if (!total || !syncForm.value.symbol) return

  const sorted = [...klineRows.value].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const startIdx = Math.max(0, Math.floor((zoomStart / 100) * (total - 1)))
  const endIdx = Math.min(total - 1, Math.ceil((zoomEnd / 100) * (total - 1)))
  const viewStart = sorted[startIdx]?.date
  const viewEnd = sorted[endIdx]?.date
  if (!viewStart || !viewEnd) return

  const earliestLoaded = sorted[0].date
  // 可见窗口最左侧（日期最早）的数据就是已加载 Rows 中的最早记录 → 用户已拖到左边界，向前增量查询
  if (viewStart <= earliestLoaded) {
    // 按当前可见窗口宽度向左扩展查询范围
    const windowDays = Math.max(10, Math.ceil((new Date(viewEnd).getTime() - new Date(viewStart).getTime()) / 86400000))
    const fetchStart = shiftDate(earliestLoaded, -windowDays)
    // 已加载范围更早时无需重复拉取
    if (loadedStart && fetchStart >= loadedStart) return

    if (zoomDebounceTimer) clearTimeout(zoomDebounceTimer)
    zoomDebounceTimer = setTimeout(() => void fetchForRange(fetchStart, earliestLoaded), 400)
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
    autoSyncedRanges.clear() // 手动同步后允许自动拉取再次尝试

    await Promise.all([loadSyncLogs(), handleQueryKline(false)])
  } catch (error) {
    console.error(error)
    ElMessage.error('手动同步失败')
  } finally {
    syncLoading.value = false
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

// ================= 附图指标计算（统一口径：预热期返回 null，与 MA 一致） =================

/** 真实波幅 TR = max(H-L, |H-prevC|, |L-prevC|) */
function calculateTrueRange(data: KLineQueryItem[]) {
  return data.map((item, i) => {
    const high = toNumber(item.high)
    const low = toNumber(item.low)
    if (i === 0) return high - low
    const prevClose = toNumber(data[i - 1].close)
    return Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose))
  })
}

/** Wilder 平滑（RSI / DMI / ATR 口径）：首值取窗口均值，其后 prev + (x - prev) / period */
function wilderSmooth(values: number[], period: number): Array<number | null> {
  const result: Array<number | null> = []
  let prev: number | null = null
  for (let i = 0; i < values.length; i += 1) {
    if (i < period - 1) {
      result.push(null)
      continue
    }
    if (prev === null) {
      prev = values.slice(0, period).reduce((sum, value) => sum + value, 0) / period
    } else {
      prev = prev + (values[i] - prev) / period
    }
    result.push(prev)
  }
  return result
}

/** 威廉指标 WR(N) = (HH - C) / (HH - LL) × 100，取值 0~100，>80 超买 / <20 超卖 */
function calculateWR(data: KLineQueryItem[], period = 14) {
  const highs = data.map((item) => toNumber(item.high))
  const lows = data.map((item) => toNumber(item.low))
  const closes = data.map((item) => toNumber(item.close))
  return data.map((_, i) => {
    if (i < period - 1) return null
    const window = (values: number[]) => values.slice(i - period + 1, i + 1)
    const hh = Math.max(...window(highs))
    const ll = Math.min(...window(lows))
    const value = hh === ll ? 50 : ((hh - closes[i]) / (hh - ll)) * 100
    return Number(value.toFixed(4))
  })
}

/** 顺势指标 CCI(N) = (TP - MA(TP)) / (0.015 × 平均绝对偏差)，±100 为常态边界 */
function calculateCCI(data: KLineQueryItem[], period = 14) {
  const typicalPrices = data.map(
    (item) => (toNumber(item.high) + toNumber(item.low) + toNumber(item.close)) / 3,
  )
  return data.map((_, i) => {
    if (i < period - 1) return null
    const window = typicalPrices.slice(i - period + 1, i + 1)
    const mean = window.reduce((sum, value) => sum + value, 0) / period
    const deviation = window.reduce((sum, value) => sum + Math.abs(value - mean), 0) / period
    const value = deviation === 0 ? 0 : (typicalPrices[i] - mean) / (0.015 * deviation)
    return Number(value.toFixed(4))
  })
}

/** 平均真实波幅 ATR(N)：TR 的 Wilder 平滑，度量绝对波动幅度（与 RSI 的相对波动互补） */
function calculateATR(data: KLineQueryItem[], period = 14) {
  const smoothed = wilderSmooth(calculateTrueRange(data), period)
  return smoothed.map((value) => (value === null ? null : Number(value.toFixed(4))))
}

/** 能量潮 OBV：按收盘涨跌对成交量做累加，用于观察量价背离 */
function calculateOBV(data: KLineQueryItem[]) {
  const result: number[] = []
  let acc = 0
  for (let i = 0; i < data.length; i += 1) {
    if (i > 0) {
      const diff = toNumber(data[i].close) - toNumber(data[i - 1].close)
      acc += diff > 0 ? toNumber(data[i].volume) : diff < 0 ? -toNumber(data[i].volume) : 0
    }
    result.push(acc)
  }
  return result
}

/** 容量比率 VR(N)：上涨日量与下跌日量之比（含收盘价修正），>150 超买 / <50 超卖 */
function calculateVR(data: KLineQueryItem[], period = 26) {
  const closes = data.map((item) => toNumber(item.close))
  return data.map((_, i) => {
    // 需要 period+1 根收盘价才能比较方向，故预热期多留一根
    if (i < period) return null
    let upVolume = 0
    let downVolume = 0
    let highest = -Infinity
    let lowest = Infinity
    for (let j = i - period + 1; j <= i; j += 1) {
      highest = Math.max(highest, closes[j])
      lowest = Math.min(lowest, closes[j])
      if (j === 0) continue
      const diff = closes[j] - closes[j - 1]
      if (diff > 0) upVolume += toNumber(data[j].volume)
      else if (diff < 0) downVolume += toNumber(data[j].volume)
    }
    const denominator = downVolume + (closes[i] - lowest) / 2
    const value =
      denominator === 0 ? 0 : ((upVolume + (highest - closes[i]) / 2) / denominator) * 100
    return Number(value.toFixed(4))
  })
}

/** 方向性指标 DMI(N)：+DI / -DI / ADX，ADX > 25 视为趋势成立 */
function calculateDMI(data: KLineQueryItem[], period = 14) {
  const plusDm: number[] = []
  const minusDm: number[] = []
  for (let i = 0; i < data.length; i += 1) {
    if (i === 0) {
      plusDm.push(0)
      minusDm.push(0)
      continue
    }
    const upMove = toNumber(data[i].high) - toNumber(data[i - 1].high)
    const downMove = toNumber(data[i - 1].low) - toNumber(data[i].low)
    plusDm.push(upMove > downMove && upMove > 0 ? upMove : 0)
    minusDm.push(downMove > upMove && downMove > 0 ? downMove : 0)
  }

  const atr = wilderSmooth(calculateTrueRange(data), period)
  const smoothPlus = wilderSmooth(plusDm, period)
  const smoothMinus = wilderSmooth(minusDm, period)
  const pdi: Array<number | null> = []
  const mdi: Array<number | null> = []
  const dx: Array<number | null> = []
  for (let i = 0; i < data.length; i += 1) {
    const atrValue = atr[i]
    const plusValue = smoothPlus[i]
    const minusValue = smoothMinus[i]
    if (atrValue === null || plusValue === null || minusValue === null || atrValue === 0) {
      pdi.push(null)
      mdi.push(null)
      dx.push(null)
      continue
    }
    const plusDI = (plusValue / atrValue) * 100
    const minusDI = (minusValue / atrValue) * 100
    pdi.push(Number(plusDI.toFixed(4)))
    mdi.push(Number(minusDI.toFixed(4)))
    const total = plusDI + minusDI
    dx.push(total === 0 ? null : Number(((Math.abs(plusDI - minusDI) / total) * 100).toFixed(4)))
  }

  // ADX = DX 的 period 期平滑。DX 预热期为 null：先压缩有效段再平滑、再映射回原下标——
  // 若直接把预热期当 0 参与平滑，ADX 会被系统性拉低（低位恒在 25 以下的假象）
  const validIndex: number[] = []
  const validValues: number[] = []
  dx.forEach((value, i) => {
    if (value === null) return
    validIndex.push(i)
    validValues.push(value)
  })
  const smoothed = wilderSmooth(validValues, period)
  const adx: Array<number | null> = new Array(data.length).fill(null)
  smoothed.forEach((value, i) => {
    if (value === null) return
    adx[validIndex[i]] = Number(value.toFixed(4))
  })
  return { pdi, mdi, adx }
}

function renderKlineChart(rows: KLineQueryItem[]) {
  if (!chartRef.value) return

  // 防御：切换标的时 v-if 会重建图表容器，旧实例可能仍绑定在已移除的 DOM 上，
  // 此时 setOption 画在脱离文档的旧 canvas 上导致 K 线不显示，必须销毁重建
  if (chartInstance && chartInstance.getDom() !== chartRef.value) {
    chartInstance.dispose()
    chartInstance = null
  }

  if (!chartInstance) {
    chartInstance = echarts.init(chartRef.value)
    // 缩放变化时根据可见日期范围增量拉取数据
    chartInstance.on('datazoom', handleChartZoom)
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
  const { dif, dea, macd } = calculateMACD(sortedRows)
  const { k, d, j } = calculateKDJ(sortedRows)
  const rsi = calculateRSI(sortedRows)
  const wr = calculateWR(sortedRows)
  const cci = calculateCCI(sortedRows)
  const atr = calculateATR(sortedRows)
  const obv = calculateOBV(sortedRows)
  const vr = calculateVR(sortedRows)
  const { pdi, mdi, adx } = calculateDMI(sortedRows)

  // ==============================================================================
  // 附图指标定义表（声明式）：新增指标只需追加一条，布局/坐标轴/图例自动生成。
  // yRange 返回固定边界（缺省则由 ECharts 自适应）；refs 为水平参考虚线。
  // ==============================================================================

  /** Y 轴对称边界（围绕 0），用于 MACD / CCI 这类有明确中轴的指标 */
  function symmetricRange(lines: Array<Array<number | null>>, padding = 1.2) {
    let maxAbs = 0
    lines.forEach((line) => {
      line.forEach((value) => {
        if (value !== null) maxAbs = Math.max(maxAbs, Math.abs(value))
      })
    })
    const bound = Math.ceil(maxAbs * padding)
    return { min: -bound, max: bound }
  }

  /** 有基础量程（0-100）的指标边界：数据超出时动态扩充并预留 15% 空间 */
  function rangedBoundary(lines: Array<Array<number | null>>, baseMin: number, baseMax: number) {
    const values: number[] = []
    lines.forEach((line) => line.forEach((value) => { if (value !== null) values.push(value) }))
    if (values.length === 0) return { min: baseMin, max: baseMax }
    const max = Math.max(...values)
    const min = Math.min(...values)
    const range = max - min
    return {
      min: Math.floor(Math.min(baseMin, min - range * 0.15)),
      max: Math.ceil(Math.max(baseMax, max + range * 0.15)),
    }
  }

  interface SubSeries {
    name: string
    type: 'line' | 'bar'
    data: Array<number | null>
    color: string
    barWidth?: string
    /** 柱状按值正负着色（MACD 柱） */
    colorBySign?: boolean
    /** 柱状按当日涨跌着色（成交量柱） */
    colorByCandle?: boolean
  }

  interface SubIndicatorDef {
    key: string
    label: string
    enabled: () => boolean
    series: SubSeries[]
    /** Y 轴固定边界；min 必填（可锁 0 基线），max=0 表示上界交由 ECharts 自适应 */
    yRange?: { min: number; max: number }
    yFormatter?: (value: number) => string
    refs?: Array<{ value: number; color: string }>
  }

  const subIndicators: SubIndicatorDef[] = [
    {
      key: 'volume',
      label: '成交量',
      enabled: () => showVolume.value,
      series: [{
        name: '成交量',
        type: 'bar',
        data: sortedRows.map((item) => toNumber(item.volume)),
        color: '#26a69a',
        barWidth: '60%',
        colorByCandle: true,
      }],
      yRange: { min: 0, max: 0 },
      yFormatter: (value: number) => `${(value / 10000).toFixed(1)}w`,
    },
    {
      key: 'macd',
      label: 'MACD',
      enabled: () => showMacd.value,
      series: [
        { name: 'DIF', type: 'line', data: dif, color: '#5b8def' },
        { name: 'DEA', type: 'line', data: dea, color: '#f59e0b' },
        { name: 'MACD', type: 'bar', data: macd, color: '#26a69a', barWidth: '60%', colorBySign: true },
      ],
      // MACD：围绕 0 轴对称，取绝对值最大项并预留 20% 余量
      yRange: symmetricRange([dif, dea, macd]),
    },
    {
      key: 'kdj',
      label: 'KDJ',
      enabled: () => showKdj.value,
      series: [
        { name: 'K', type: 'line', data: k, color: '#ec4899' },
        { name: 'D', type: 'line', data: d, color: '#8b5cf6' },
        { name: 'J', type: 'line', data: j, color: '#f97316' },
      ],
      yRange: rangedBoundary([k, d, j], 0, 100),
      refs: [{ value: 80, color: '#f59e0b' }, { value: 20, color: '#6b7280' }],
    },
    {
      key: 'rsi',
      label: 'RSI',
      enabled: () => showRsi.value,
      series: [{ name: 'RSI', type: 'line', data: rsi, color: '#10b981' }],
      yRange: rangedBoundary([rsi], 0, 100),
      refs: [{ value: 70, color: '#f59e0b' }, { value: 30, color: '#6b7280' }],
    },
    {
      key: 'wr',
      label: 'WR(14)',
      enabled: () => showWr.value,
      series: [{ name: 'WR', type: 'line', data: wr, color: '#0ea5e9' }],
      // WR 天然落在 0~100，固定边界即可，无需随数据浮动
      yRange: { min: 0, max: 100 },
      refs: [{ value: 80, color: '#f59e0b' }, { value: 20, color: '#6b7280' }],
    },
    {
      key: 'cci',
      label: 'CCI(14)',
      enabled: () => showCci.value,
      series: [{ name: 'CCI', type: 'line', data: cci, color: '#14b8a6' }],
      // CCI 常态 ±100，极端行情可远越；边界取「至少 ±100」再按数据对称扩展
      yRange: (() => {
        const base = symmetricRange([cci], 1.1)
        const bound = Math.max(Math.abs(base.min), 100)
        return { min: -bound, max: bound }
      })(),
      refs: [{ value: 100, color: '#f59e0b' }, { value: -100, color: '#6b7280' }],
    },
    {
      key: 'atr',
      label: 'ATR(14)',
      enabled: () => showAtr.value,
      series: [{ name: 'ATR', type: 'line', data: atr, color: '#6366f1' }],
    },
    {
      key: 'obv',
      label: 'OBV',
      enabled: () => showObv.value,
      series: [{ name: 'OBV', type: 'line', data: obv, color: '#d946ef' }],
    },
    {
      key: 'vr',
      label: 'VR(26)',
      enabled: () => showVr.value,
      series: [{ name: 'VR', type: 'line', data: vr, color: '#84cc16' }],
      refs: [{ value: 150, color: '#f59e0b' }, { value: 50, color: '#6b7280' }],
    },
    {
      key: 'dmi',
      label: 'DMI(14)',
      enabled: () => showDmi.value,
      series: [
        { name: '+DI', type: 'line', data: pdi, color: '#22c55e' },
        { name: '-DI', type: 'line', data: mdi, color: '#ef4444' },
        { name: 'ADX', type: 'line', data: adx, color: '#eab308' },
      ],
      // ADX > 25 视为趋势成立，故下限保证 25 参考线始终可见
      yRange: (() => {
        const base = rangedBoundary([pdi, mdi, adx], 0, 25)
        return base
      })(),
      refs: [{ value: 25, color: '#f59e0b' }],
    },
  ]

  const activeSubIndicators = subIndicators.filter((item) => item.enabled())

  // 独立分图构建，确保取消勾选后彻底隐藏且自动向上排布
  const grids: any[] = []
  let currentTop = 20
  const mainHeight = 280
  const panelHeight = 100
  const gap = 10 // 独立分图之间的间隙

  // 主K线图
  grids.push({ left: 16, right: 16, top: currentTop, height: mainHeight, containLabel: true })
  currentTop += mainHeight + gap

  // 附图按定义表顺序依次占位，取消勾选即不占空间（下方坐标轴/序列同源生成，天然对齐）
  activeSubIndicators.forEach(() => {
    grids.push({ left: 16, right: 16, top: currentTop, height: panelHeight, containLabel: true })
    currentTop += panelHeight + gap
  })

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

  // 附图坐标轴与序列：按定义表统一生成（gridIndex 与 grids 数组下标天然对齐）
  activeSubIndicators.forEach((indicator, index) => {
    const gridIndex = index + 1

    xAxis.push({
      type: 'category',
      gridIndex,
      data: dates,
      boundaryGap: false,
      axisLine: { lineStyle: { color: '#d9dee8' } },
      axisTick: { show: false },
      axisLabel: { show: false },
      splitLine: { show: false },
    })

    // yRange 未声明时用 scale 自适应（如 ATR / OBV 这类无固定量程的指标）；
    // max=0 是「只锁下限」的哨兵值（成交量柱必须 0 基线，上界交给 ECharts）
    const yRange = indicator.yRange
    yAxis.push({
      type: 'value',
      gridIndex,
      scale: yRange ? false : true,
      ...(yRange && yRange.min !== undefined ? { min: yRange.min } : {}),
      ...(yRange && yRange.max > yRange.min ? { max: yRange.max } : {}),
      axisLabel: {
        color: '#667085',
        ...(indicator.yFormatter ? { formatter: indicator.yFormatter } : {}),
      },
      splitLine: { lineStyle: { color: '#edf1f7' } },
    })

    indicator.series.forEach((item) => {
      const itemStyle: Record<string, unknown> = { color: item.color }
      if (item.colorBySign) {
        itemStyle.color = (params: any) => ((params.data ?? 0) >= 0 ? '#26a69a' : '#ef5350')
      }
      if (item.colorByCandle) {
        itemStyle.color = (params: any) => {
          const current = sortedRows[params.dataIndex]
          if (!current) return item.color
          return calculateVolumeColor(toNumber(current.close), toNumber(current.open))
        }
      }
      series.push({
        name: item.name,
        type: item.type,
        xAxisIndex: gridIndex,
        yAxisIndex: gridIndex,
        data: item.data,
        ...(item.type === 'bar'
          ? { barWidth: item.barWidth ?? '60%', itemStyle }
          : { smooth: true, symbol: 'none', lineStyle: { width: 1.5, color: item.color }, itemStyle }),
      })
    })

    // 参考虚线（超买超卖线等）：silent 不响应交互，也从图例中排除
    indicator.refs?.forEach((reference, refIndex) => {
      series.push({
        name: `${indicator.label} ref${refIndex}`,
        type: 'line',
        xAxisIndex: gridIndex,
        yAxisIndex: gridIndex,
        data: Array(dates.length).fill(reference.value),
        lineStyle: { width: 1, color: reference.color, type: 'dashed' },
        symbol: 'none',
        silent: true,
      })
    })
  })

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
      // 参考虚线（silent）不进图例；否则每个附图的超买超卖线都会挤占图例区
      data: series.filter((item) => item.name && !item.silent).map((item) => item.name),
      textStyle: { fontSize: 11 },
    },
    grid: grids,
    xAxis,
    yAxis,
    dataZoom: [
      {
        type: 'inside',
        start: zoomStart,
        end: zoomEnd,
        xAxisIndex: xAxis.map((_, i) => i),
      },
      {
        type: 'slider',
        show: true,
        start: zoomStart,
        end: zoomEnd,
        bottom: 10,
      },
    ],
    series,
  }, true)
}

// ================= 修复：监听 chartHeight 变化，并调用 resize 使图表自适应 =================
watch(
  // 监听全部附图开关：任一指标增减都会改变图表总高度，需重绘 + resize
  [klineRows, ...SUB_INDICATOR_FLAGS.map((item) => item.flag), chartHeight],
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
  if (zoomDebounceTimer) clearTimeout(zoomDebounceTimer)
  chartInstance?.dispose()
})

onMounted(async () => {
  defaultDateRange()
  await Promise.all([loadSnapshots(), loadSyncLogs(), loadSymbolOptions()])
  // loadSymbolOptions 自动选中首个标的时会触发 symbol watch 自动查询并绘制 K 线，
  // 此处无需重复查询（避免双请求与远程同步竞态）
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