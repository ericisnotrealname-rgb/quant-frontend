<template>
  <div class="page-container">
    <div class="page-heading">
      <div>
        <span class="eyebrow">OPERATIONS OVERVIEW</span>
        <h1>运行总览</h1>
        <p>统计在数据库侧聚合，不受列表分页上限影响；存量与健康度指标取全表事实。</p>
      </div>
      <div class="toolbar">
        <el-select v-model="windowDays" style="width: 116px" @change="loadData">
          <el-option label="近 7 天" :value="7" />
          <el-option label="近 14 天" :value="14" />
          <el-option label="近 30 天" :value="30" />
        </el-select>
        <el-switch v-model="autoRefresh" inline-prompt active-text="自动" inactive-text="手动" />
        <el-button :loading="loading" @click="loadData">
          <el-icon><Refresh /></el-icon>刷新
        </el-button>
      </div>
    </div>

    <el-alert v-if="error" :title="error" type="error" show-icon closable class="block" @close="error = ''" />

    <el-alert v-if="health.length" type="warning" show-icon class="block">
      <template #title>需要关注</template>
      <ul class="health-list">
        <li v-for="item in health" :key="item.key">{{ item.text }}</li>
      </ul>
    </el-alert>

    <div class="metrics">
      <div class="metric">
        <span>窗口运行数</span><strong>{{ execution.window_total }}</strong>
        <small>近 {{ overview?.window_days ?? windowDays }} 天</small>
      </div>
      <div class="metric" :class="{ alert: failureRateTone }">
        <span>成功率</span><strong>{{ formatRate(execution.success_rate) }}</strong>
        <small>已终结 {{ execution.settled_total }} 次</small>
      </div>
      <div class="metric">
        <span>平均耗时</span><strong>{{ formatMs(execution.avg_duration_ms) }}</strong>
        <small>ExecutionLog 均值</small>
      </div>
      <div class="metric" :class="{ alert: execution.running_runs > 0 }">
        <span>活跃运行</span><strong>{{ execution.active_runs }}</strong>
        <small>其中 running {{ execution.running_runs }}</small>
      </div>
      <div class="metric" :class="{ alert: alerts.open > 0 }">
        <span>未处理告警</span><strong>{{ alerts.open }}</strong>
        <small>最近 {{ formatDate(alerts.latest_at) }}</small>
      </div>
      <div class="metric" :class="{ alert: orders.unconfirmed > 0 }">
        <span>未确认委托单</span><strong>{{ orders.unconfirmed }}</strong>
        <small>超 {{ Math.round(orders.unconfirmed_after_seconds / 60) }} 分钟</small>
      </div>
    </div>

    <section class="panel">
      <div class="panel-header">
        <div><span class="panel-kicker">EXECUTION TREND</span><h2>执行趋势</h2></div>
        <span class="count-label">近 {{ trendDays }} 天 · 按 {{ overview?.timezone ?? '—' }} 自然日</span>
      </div>
      <div ref="chartRef" v-loading="loading" class="chart"></div>
    </section>

    <div class="grid-3">
      <section class="panel">
        <div class="panel-header"><div><span class="panel-kicker">EXECUTION</span><h2>执行分布</h2></div></div>
        <el-descriptions :column="1" size="small" border>
          <el-descriptions-item label="完成">{{ statusCount('completed') }}</el-descriptions-item>
          <el-descriptions-item label="失败">{{ statusCount('failed') }}</el-descriptions-item>
          <el-descriptions-item label="已停止">{{ statusCount('stopped') }}</el-descriptions-item>
          <el-descriptions-item label="未终结">{{ statusCount('pending') + statusCount('running') }}</el-descriptions-item>
          <el-descriptions-item label="执行意向待消费">{{ intents.pending }}</el-descriptions-item>
          <el-descriptions-item label="已超有效期">
            <span :class="{ danger: intents.expired_candidates > 0 }">{{ intents.expired_candidates }}</span>
          </el-descriptions-item>
        </el-descriptions>
      </section>

      <section class="panel">
        <div class="panel-header"><div><span class="panel-kicker">ORDERS</span><h2>委托单</h2></div></div>
        <el-descriptions :column="1" size="small" border>
          <el-descriptions-item label="窗口笔数">{{ orders.window_total }}</el-descriptions-item>
          <el-descriptions-item label="买入 / 卖出">{{ orders.by_direction.buy ?? 0 }} / {{ orders.by_direction.sell ?? 0 }}</el-descriptions-item>
          <el-descriptions-item label="成交金额">{{ formatMoney(orders.notional_total) }}</el-descriptions-item>
          <el-descriptions-item label="买入金额">{{ formatMoney(orders.notional_direction.buy) }}</el-descriptions-item>
          <el-descriptions-item label="卖出金额">{{ formatMoney(orders.notional_direction.sell) }}</el-descriptions-item>
          <el-descriptions-item label="未确认">
            <span :class="{ danger: orders.unconfirmed > 0 }">{{ orders.unconfirmed }}</span>
          </el-descriptions-item>
        </el-descriptions>
      </section>

      <section class="panel">
        <div class="panel-header"><div><span class="panel-kicker">FUNDS</span><h2>账户资金</h2></div></div>
        <template v-if="funds.configured">
          <el-descriptions :column="1" size="small" border>
            <el-descriptions-item label="总资金">{{ formatMoney(funds.total_capital) }}</el-descriptions-item>
            <el-descriptions-item label="已占用">{{ formatMoney(funds.allocated_capital) }}</el-descriptions-item>
            <el-descriptions-item label="可用">{{ formatMoney(funds.available_capital) }}</el-descriptions-item>
            <el-descriptions-item label="口径">{{ funds.capital_basis }} · {{ funds.source }}</el-descriptions-item>
            <el-descriptions-item label="最近同步">
              <span :class="{ danger: funds.is_stale }">{{ formatDate(funds.synced_at) }}</span>
            </el-descriptions-item>
          </el-descriptions>
        </template>
        <el-empty v-else description="尚未配置账户资金" :image-size="70" />
      </section>
    </div>

    <section class="panel">
      <div class="panel-header"><div><span class="panel-kicker">CONFIG &amp; DATA</span><h2>配置与数据新鲜度</h2></div></div>
      <el-descriptions :column="3" size="small" border>
        <el-descriptions-item label="已发布 Plan">{{ config.plans_published }}</el-descriptions-item>
        <el-descriptions-item label="已发布 Suite">{{ config.suites_published }}</el-descriptions-item>
        <el-descriptions-item label="已发布 Case">{{ config.cases_published }}</el-descriptions-item>
        <el-descriptions-item label="Plan 运行中">{{ config.plans_by_run_status.running ?? 0 }}</el-descriptions-item>
        <el-descriptions-item label="Plan 已完成">{{ config.plans_by_run_status.done ?? 0 }}</el-descriptions-item>
        <el-descriptions-item label="Plan 已中断">{{ config.plans_by_run_status.interrupt ?? 0 }}</el-descriptions-item>
        <el-descriptions-item label="标的 / 分组">{{ freshness.symbols }} / {{ freshness.groups }}</el-descriptions-item>
        <el-descriptions-item label="分时采样点">{{ freshness.intraday_points }}</el-descriptions-item>
        <el-descriptions-item label="最近采样">{{ formatDate(freshness.intraday_last_at) }}</el-descriptions-item>
      </el-descriptions>
      <p class="footnote">
        快照生成于 {{ formatDate(overview?.generated_at) }}；统计窗口起点 {{ formatDate(overview?.window_start) }}。
        分时数据为当日临时数据，收盘清空属正常。
      </p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Refresh } from '@element-plus/icons-vue'
import { dashboardApi } from '@/api/dashboard'
import type { DashboardOverview, DashboardTrendPoint } from '@/types/api'
import { echarts } from '@/utils/echarts'
import type { EChartsType } from '@/utils/echarts'

const AUTO_REFRESH_MS = 30_000

const overview = ref<DashboardOverview | null>(null)
const trend = ref<DashboardTrendPoint[]>([])
const windowDays = ref(7)
const trendDays = 14
const autoRefresh = ref(true)
const loading = ref(false)
const error = ref('')
const chartRef = ref<HTMLElement | null>(null)

let chart: EChartsType | null = null
let timer: number | undefined

// ---- 分块默认值：未加载完成前也能安全渲染 ----
const execution = computed(() => overview.value?.execution ?? {
  window_total: 0, by_status: {}, settled_total: 0, success_rate: null,
  failure_rate: null, avg_duration_ms: null, active_runs: 0, running_runs: 0,
})
const intents = computed(() => overview.value?.intents ?? {
  pending: 0, expired_candidates: 0, max_age_seconds: 300,
})
const orders = computed(() => overview.value?.orders ?? {
  window_total: 0, by_status: {}, by_direction: {}, notional_total: null,
  notional_direction: {}, unconfirmed: 0, unconfirmed_after_seconds: 1800,
})
const funds = computed(() => overview.value?.funds ?? { configured: false })
const alerts = computed(() => overview.value?.alerts ?? {
  open: 0, open_by_severity: {}, window_total: 0, window_by_type: {}, latest_at: null,
})
const config = computed(() => overview.value?.config ?? {
  plans_published: 0, plans_by_run_status: {}, suites_published: 0, cases_published: 0,
})
const freshness = computed(() => overview.value?.data_freshness ?? {
  intraday_last_at: null, intraday_points: 0, symbols: 0, groups: 0,
})

const failureRateTone = computed(() => (execution.value.failure_rate ?? 0) >= 50)

// 健康提示：只在**真的有异常**时出现，避免制造噪音
const health = computed(() => {
  const data = overview.value
  if (!data) return []
  const items: { key: string; text: string }[] = []
  if (data.orders.unconfirmed > 0) {
    items.push({
      key: 'unconfirmed',
      text: `${data.orders.unconfirmed} 张委托单超过 ${Math.round(data.orders.unconfirmed_after_seconds / 60)} 分钟仍未确认（可能已提交券商、未回写），需人工对账。`,
    })
  }
  if (data.intents.expired_candidates > 0) {
    items.push({
      key: 'expired',
      text: `${data.intents.expired_candidates} 个执行意向已超过 ${data.intents.max_age_seconds} 秒有效期，将在下次调度器启动时被收口为 PENDING_EXPIRED。`,
    })
  }
  if (data.execution.running_runs > 0) {
    items.push({
      key: 'running',
      text: `${data.execution.running_runs} 个运行处于 running；若进程已崩溃，会在下次启动时被收口为失败并告警。`,
    })
  }
  if (data.alerts.open > 0) {
    items.push({ key: 'alerts', text: `${data.alerts.open} 条告警未处理。` })
  }
  if (data.funds.configured && data.funds.is_stale) {
    items.push({ key: 'stale', text: '账户资金从未成功同步，额度校验可能使用旧值。' })
  }
  return items
})

function statusCount(status: string) {
  return execution.value.by_status[status] ?? 0
}

function formatRate(value: number | null) {
  return value === null || value === undefined ? '—' : `${value}%`
}

function formatMs(value: number | null) {
  return value === null || value === undefined ? '—' : `${value} ms`
}

function formatMoney(value?: string | null) {
  if (value === undefined || value === null || value === '') return '—'
  const parsed = Number(value)
  if (Number.isNaN(parsed)) return value
  return parsed.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString('zh-CN') : '—'
}

function renderChart() {
  if (!chartRef.value || !trend.value.length) return
  chart ??= echarts.init(chartRef.value)
  chart.setOption({
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
    },
    // 图例固定顶部居中：避免与左右上角的 y 轴名称抢占同一行
    legend: {
      top: 4,
      left: 'center',
      itemWidth: 12,
      itemHeight: 8,
      itemGap: 18,
      textStyle: { fontSize: 12, color: '#475467' },
    },
    // containLabel 让 grid 自动为轴标签留白；top 预留「图例行 + 轴名行」
    grid: { left: 8, right: 8, top: 64, bottom: 8, containLabel: true },
    xAxis: {
      type: 'category',
      data: trend.value.map((item) => item.date.slice(5)),
      axisTick: { alignWithLabel: true },
      axisLabel: { hideOverlap: true, color: '#667085' },
      axisLine: { lineStyle: { color: '#e6e8ec' } },
    },
    yAxis: [
      {
        type: 'value',
        name: '运行数',
        minInterval: 1,
        nameTextStyle: { align: 'left', color: '#98a2b3', fontSize: 11 },
        axisLabel: { color: '#98a2b3' },
        splitLine: { lineStyle: { color: '#eef0f3' } },
      },
      {
        type: 'value',
        name: '成功率 %',
        min: 0,
        max: 100,
        nameTextStyle: { align: 'right', color: '#98a2b3', fontSize: 11 },
        axisLabel: { color: '#98a2b3', formatter: '{value}%' },
        // 右轴不再重复画网格线，避免与左轴叠加成双线
        splitLine: { show: false },
      },
    ],
    series: [
      { name: '完成', type: 'bar', stack: 'runs', barMaxWidth: 22, itemStyle: { color: '#16a34a' }, data: trend.value.map((item) => item.completed) },
      { name: '失败', type: 'bar', stack: 'runs', barMaxWidth: 22, itemStyle: { color: '#dc2626' }, data: trend.value.map((item) => item.failed) },
      { name: '停止', type: 'bar', stack: 'runs', barMaxWidth: 22, itemStyle: { color: '#98a2b3' }, data: trend.value.map((item) => item.stopped) },
      {
        name: '成功率',
        type: 'line',
        yAxisIndex: 1,
        z: 3,
        smooth: true,
        connectNulls: false,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { width: 2, color: '#d97706' },
        itemStyle: { color: '#d97706' },
        // 当天没有「已终结」样本时后端返回 null（表示无数据，而非 0%），用 NaN 断线
        data: trend.value.map((item) => item.success_rate ?? NaN),
        tooltip: {
          valueFormatter: (value: unknown) => {
            const parsed = Number(value)
            return Number.isFinite(parsed) ? `${parsed}%` : '无终结样本';
          },
        },
      },
    ],
  })
}

function resizeChart() {
  chart?.resize()
}

async function loadData() {
  loading.value = true
  error.value = ''
  try {
    const [overviewResponse, trendResponse] = await Promise.all([
      dashboardApi.overview(windowDays.value),
      dashboardApi.executionTrend(trendDays),
    ])
    overview.value = overviewResponse.data
    trend.value = trendResponse.data.series
    renderChart()
  } catch (cause) {
    error.value = '运行总览加载失败，请确认后端服务已启动。'
    console.error(cause)
  } finally {
    loading.value = false
  }
}

function stopTimer() {
  if (timer !== undefined) {
    window.clearInterval(timer)
    timer = undefined
  }
}

function startTimer() {
  stopTimer()
  timer = window.setInterval(loadData, AUTO_REFRESH_MS)
}

watch(autoRefresh, (enabled) => {
  if (enabled) startTimer()
  else stopTimer()
})

onMounted(() => {
  loadData()
  if (autoRefresh.value) startTimer()
  window.addEventListener('resize', resizeChart)
})

onBeforeUnmount(() => {
  stopTimer()
  window.removeEventListener('resize', resizeChart)
  chart?.dispose()
  chart = null
})
</script>

<style scoped>
.page-container { max-width: 1280px; margin: 0 auto; }
.page-heading, .panel-header { display: flex; align-items: center; justify-content: space-between; gap: 20px; }
.page-heading { margin-bottom: 28px; }
.toolbar { display: flex; align-items: center; gap: 12px; }
.eyebrow, .panel-kicker { color: #d97706; font-size: 11px; font-weight: 700; letter-spacing: 1.8px; }
h1 { margin: 6px 0; color: #172033; font-size: 36px; }
h2 { margin: 4px 0 0; color: #172033; font-size: 20px; }
p, .count-label, .footnote { color: #667085; }
.block { margin-bottom: 16px; }
.health-list { margin: 6px 0 0; padding-left: 18px; color: #7a5b12; font-size: 13px; line-height: 1.9; }
.metrics { display: grid; grid-template-columns: repeat(6, 1fr); gap: 14px; margin: 22px 0; }
.metric { padding: 18px 20px; border-left: 3px solid #d97706; background: #fff; box-shadow: 0 8px 24px rgba(23, 32, 51, .06); }
.metric.alert { border-left-color: #dc2626; }
.metric span, .metric small { display: block; color: #667085; }
.metric strong { display: block; color: #172033; font-size: 26px; margin: 5px 0; }
.metric small { color: #98a2b3; font-size: 11px; }
.panel { padding: 24px; margin-top: 20px; border: 1px solid #e6e8ec; border-radius: 8px; background: #fff; box-shadow: 0 10px 30px rgba(23, 32, 51, .06); }
.grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
.chart { width: 100%; height: 380px; min-width: 0; }
.danger { color: #dc2626; font-weight: 600; }
.footnote { margin: 14px 0 0; font-size: 12px; }
@media (max-width: 1100px) { .metrics { grid-template-columns: repeat(3, 1fr); } .grid-3 { grid-template-columns: 1fr; } }
@media (max-width: 760px) { .metrics { grid-template-columns: repeat(2, 1fr); } .page-heading { flex-direction: column; align-items: flex-start; } h1 { font-size: 30px; } .chart { height: 320px; } }
</style>
