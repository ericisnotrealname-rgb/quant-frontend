<template>
  <div class="page-container">
    <div class="page-heading">
      <div>
        <span class="eyebrow">INTRADAY MONITORING</span>
        <h1>分时监控</h1>
        <p>多市场盘中监控（A / HK / US · 时区感知 · 临时数据收盘清空）。</p>
      </div>
      <div class="heading-actions">
        <el-select v-model="symbolCode" filterable placeholder="选择标的" style="width: 260px">
          <el-option
            v-for="item in symbolOptions"
            :key="item.code"
            :label="`${item.code} ${item.name}`"
            :value="item.code"
          />
        </el-select>
        <el-button :loading="loading" @click="refresh(false)">
          <el-icon><Refresh /></el-icon>刷新
        </el-button>
      </div>
    </div>

    <el-alert v-if="error" :title="error" type="error" show-icon closable @close="error = ''" />

    <div class="status-bar">
      <el-tag :type="sessionTagType" size="large">{{ sessionLabel }}</el-tag>
      <span class="status-item">市场：{{ marketLabel }}</span>
      <span class="status-item">时区：{{ timezone }}</span>
      <span class="status-item">昨收：{{ preCloseText }}</span>
      <span class="status-item">最新：{{ latestPriceText }}</span>
      <span class="status-item" :style="{ color: latestChangeColor }">涨跌：{{ latestChangeText }}</span>
      <span class="status-item">数据点：{{ points.length }}</span>
      <el-tag v-if="pollingActive" type="success" size="small">轮询中 {{ POLL_MS / 1000 }}s/次</el-tag>
      <el-tag v-else type="info" size="small">轮询已暂停</el-tag>
    </div>

    <section class="panel">
      <div class="panel-header">
        <div>
          <span class="panel-kicker">INTRADAY</span>
          <h2>今日分时曲线</h2>
        </div>
        <div class="legend-hint">
          <span class="dot blue" />现价
          <span class="dot yellow" />均价
          <span class="dot red" />上涨
          <span class="dot green" />下跌
        </div>
      </div>
      <div v-if="points.length" ref="chartRef" class="chart" />
      <el-empty
        v-else-if="!loading"
        description="暂无分时数据：交易时段内由 sample_intraday 命令每分钟采样写入（外部 cron 触发）"
        :image-size="80"
      />
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Refresh } from '@element-plus/icons-vue'
import { echarts } from '@/utils/echarts'
import type { EChartsType } from '@/utils/echarts'
import { monitoringApi } from '@/api/monitoring'
import type { IntradayPayload, IntradayPointItem } from '@/api/monitoring'
import { watchlistsApi } from '@/api/watchlists'
import type { SymbolItem } from '@/types/api'

const POLL_MS = 15_000

const symbolOptions = ref<SymbolItem[]>([])
const symbolCode = ref('')
const payload = ref<IntradayPayload | null>(null)
const points = ref<IntradayPointItem[]>([])
const loading = ref(false)
const error = ref('')
const pollingActive = ref(false)
const chartRef = ref<HTMLElement | null>(null)

let chartInstance: EChartsType | null = null
let timer: ReturnType<typeof setInterval> | null = null

const SESSION_META: Record<string, { label: string; type: string }> = {
  trading: { label: '交易中', type: 'success' },
  lunch_break: { label: '午休', type: 'warning' },
  pre_market: { label: '开盘前', type: 'info' },
  closed: { label: '已收盘', type: 'info' },
}
const MARKET_LABELS: Record<string, string> = { A: 'A股', HK: '港股', US: '美股' }

const timezone = computed(() => payload.value?.timezone ?? '-')
const marketLabel = computed(() => MARKET_LABELS[payload.value?.market ?? ''] ?? payload.value?.market ?? '-')
const sessionStatus = computed(() => payload.value?.session_status ?? 'closed')
const sessionLabel = computed(() => (SESSION_META[sessionStatus.value] ?? SESSION_META.closed).label)
const sessionTagType = computed(() => (SESSION_META[sessionStatus.value] ?? SESSION_META.closed).type)
const preCloseText = computed(() => payload.value?.pre_close || '-')
const latestPriceText = computed(() => points.value.length ? points.value[points.value.length - 1].price : '-')
const latestChange = computed(() => (points.value.length ? Number(points.value[points.value.length - 1].change) : 0))
const latestChangeText = computed(() => (points.value.length ? `${points.value[points.value.length - 1].change}%` : '-'))
const latestChangeColor = computed(() => (latestChange.value > 0 ? '#dc2626' : latestChange.value < 0 ? '#16a34a' : '#667085'))

async function loadSymbols() {
  const seen = new Map<string, SymbolItem>()
  try {
    const watchlist = await watchlistsApi.watchlist()
    for (const group of (watchlist.data?.groups ?? [])) {
      for (const symbol of (group.symbols ?? [])) {
        seen.set(symbol.code, symbol)
      }
    }
  } catch (cause) {
    console.error('自选池加载失败，回退全量标的：', cause)
  }
  if (seen.size === 0) {
    try {
      const all = await watchlistsApi.symbols()
      for (const symbol of all.data) {
        seen.set(symbol.code, symbol)
      }
    } catch (cause) {
      error.value = '标的列表加载失败，请确认后端服务已启动。'
      console.error(cause)
    }
  }
  symbolOptions.value = [...seen.values()]
}

async function refresh(silent = false) {
  if (!symbolCode.value) return
  if (silent) {
    try {
      const response = await monitoringApi.intraday(symbolCode.value)
      applyPayload(response.data)
    } catch (cause) {
      console.error('静默轮询失败：', cause)
    }
    return
  }
  loading.value = true
  error.value = ''
  try {
    const response = await monitoringApi.intraday(symbolCode.value)
    applyPayload(response.data)
  } catch (cause) {
    stopPolling()
    error.value = '分时数据加载失败，请确认后端服务已启动且该标的已配置。'
    console.error(cause)
  } finally {
    loading.value = false
  }
}

function applyPayload(data: IntradayPayload) {
  payload.value = data
  // 增量合并：服务端每次返回当日全量，按 ts 求并集后升序（避免全量重绘）
  const byTs = new Map(points.value.map((point) => [point.ts, point] as const))
  for (const point of (data.points ?? [])) {
    byTs.set(point.ts, point)
  }
  points.value = [...byTs.values()].sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0))
  renderChart()
  schedulePolling()
}

function renderChart() {
  if (!chartRef.value) return
  chartInstance ??= echarts.init(chartRef.value)
  const times = points.value.map((point) => point.local_time)
  const prices = points.value.map((point) => Number(point.price))
  const avgPrices = points.value.map((point) => {
    const value = point.avg_price
    return value === null || value === '' ? null : Number(value)
  })
  const volumes = points.value.map((point) => point.volume)
  const changes = points.value.map((point) => Number(point.change))
  const volumeBars = volumes.map((volume, index) => ({
    value: volume,
    itemStyle: { color: changes[index] > 0 ? '#dc2626' : changes[index] < 0 ? '#16a34a' : '#94a3b8' },
  }))

  chartInstance.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      formatter: (params: unknown) => {
        const list = params as unknown as Array<{ dataIndex?: number }>
        if (!Array.isArray(list) || list.length === 0) return ''
        const point = points.value[Number(list[0].dataIndex ?? 0)]
        if (!point) return ''
        const change = Number(point.change)
        const changeColor = change > 0 ? '#dc2626' : change < 0 ? '#16a34a' : '#667085'
        const rows = [
          `<b>${point.local_time}</b>`,
          `现价：${point.price}`,
          point.avg_price !== null && point.avg_price !== '' ? `均价：${point.avg_price}` : '',
          `涨跌幅：<span style="color:${changeColor}">${point.change}%</span>`,
          `成交量：${point.volume}`,
          point.amount !== null && point.amount !== '' ? `成交额：${point.amount}` : '',
        ]
        return rows.filter(Boolean).join('<br/>')
      },
    },
    legend: {
      data: ['现价', '均价'],
      top: 6,
      itemGap: 16,
      textStyle: { color: '#475467' },
    },
    grid: [
      { left: 66, right: 20, top: 40, height: '56%' },
      { left: 66, right: 20, top: '72%', height: '16%' },
    ],
    xAxis: [
      {
        type: 'category',
        data: times,
        boundaryGap: false,
        axisLabel: { color: '#667085', interval: 'auto', rotate: 45 },
        axisLine: { lineStyle: { color: '#e6e8ec' } },
      },
      {
        type: 'category',
        gridIndex: 1,
        data: times,
        boundaryGap: false,
        axisLabel: { show: false },
        axisTick: { show: false },
        axisLine: { show: false },
      },
    ],
    yAxis: [
      {
        type: 'value',
        scale: true,
        name: '价格',
        nameTextStyle: { color: '#98a2b3' },
        axisLabel: { color: '#667085' },
        splitLine: { lineStyle: { color: '#eef0f4' } },
      },
      {
        type: 'value',
        gridIndex: 1,
        name: '量',
        nameTextStyle: { color: '#98a2b3' },
        axisLabel: { color: '#98a2b3', formatter: formatCompact },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: '现价',
        type: 'line',
        data: prices,
        showSymbol: false,
        smooth: true,
        lineStyle: { color: '#3b82f6', width: 2 },
        emphasis: { focus: 'series' },
      },
      {
        name: '均价',
        type: 'line',
        data: avgPrices,
        showSymbol: false,
        smooth: true,
        lineStyle: { color: '#f59e0b', width: 1.5, type: 'dashed' },
        emphasis: { focus: 'series' },
      },
      {
        name: '成交量',
        type: 'bar',
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: volumeBars,
        barWidth: '62%',
        tooltip: { show: false },
      },
    ],
    dataZoom: [
      { type: 'inside', xAxisIndex: [0, 1], min: 40, max: 100 },
      { type: 'slider', xAxisIndex: [0, 1], bottom: 0, height: 18 },
    ],
  })
}

function formatCompact(value: number | string): string {
  const number = Number(value)
  if (number >= 1_0000) return `${Math.round(number / 1_0000)}万`
  if (number >= 1_000) return `${(number / 1_000).toFixed(1)}k`
  return String(number)
}

function schedulePolling() {
  stopPolling()
  if (sessionStatus.value === 'trading') {
    pollingActive.value = true
    timer = setInterval(() => void refresh(true), POLL_MS)
  }
}

function stopPolling() {
  if (timer !== null) {
    clearInterval(timer)
    timer = null
  }
  pollingActive.value = false
}

function handleResize() {
  chartInstance?.resize()
}

watch(symbolCode, (code) => {
  if (!code) return
  points.value = []
  payload.value = null
  chartInstance?.clear()

  void refresh(false)
})

onMounted(async () => {
  await loadSymbols()
  if (symbolOptions.value.length === 0) {
    if (!error.value) error.value = '暂无标的，请先在「标的管理」中导入标的。'
    return
  }
  window.addEventListener('resize', handleResize)
  const preferred = symbolOptions.value.find((item) => item.market === 'A') ?? symbolOptions.value[0]
  symbolCode.value = preferred.code
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  stopPolling()
  chartInstance?.dispose()
  chartInstance = null
})
</script>

<style scoped>
.page-container {
  max-width: 1280px;
  margin: 0 auto;
}

.page-heading,
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.page-heading {
  margin-bottom: 22px;
}

.eyebrow,
.panel-kicker {
  color: #d97706;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1.8px;
}

h1 {
  margin: 6px 0;
  color: #172033;
  font-size: 36px;
}

h2 {
  margin: 4px 0 0;
  color: #172033;
  font-size: 20px;
}

p {
  color: #667085;
}

.heading-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.status-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  padding: 12px 16px;
  border: 1px solid #e6e8ec;
  border-radius: 8px;
  background: #fff;
  margin-bottom: 16px;
}

.status-item {
  color: #667085;
  font-size: 13px;
}

.legend-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #667085;
  font-size: 12px;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-right: 2px;
}

.dot.blue {
  background: #3b82f6;
}

.dot.yellow {
  background: #f59e0b;
}

.dot.red {
  background: #dc2626;
}

.dot.green {
  background: #16a34a;
}

.panel {
  padding: 24px;
  margin-top: 20px;
  border: 1px solid #e6e8ec;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 10px 30px rgba(23, 32, 51, 0.06);
}

.chart {
  width: 100%;
  height: 420px;
  margin-top: 14px;
}

@media (max-width: 760px) {
  .page-heading {
    align-items: flex-start;
  }

  h1 {
    font-size: 30px;
  }

  .chart {
    height: 360px;
  }
}
</style>