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
      <el-tag v-if="streamActive" type="success" size="small">实时推送 (SSE)</el-tag>
      <el-tag v-else-if="pollingActive" type="warning" size="small">轮询中 {{ POLL_MS / 1000 }}s/次（降级）</el-tag>
      <el-tag v-else type="info" size="small">推送已暂停</el-tag>
    </div>

    <section class="panel">
      <div class="panel-header">
        <div>
          <span class="panel-kicker">INTRADAY</span>
          <h2>今日分时曲线</h2>
        </div>
        <div class="legend-hint">
          <span class="indicator-controls">
            <el-checkbox v-model="showMacd" size="small">MACD</el-checkbox>
            <el-checkbox v-model="showKdj" size="small">KDJ</el-checkbox>
            <el-checkbox v-model="showRsi" size="small">RSI</el-checkbox>
          </span>
          <span class="y-span-control">
            <span class="control-label">Y轴最小振幅%</span>
            <el-input-number
              v-model="yMinSpanPct"
              :min="0.1"
              :max="20"
              :step="0.1"
              :precision="1"
              size="small"
              controls-position="right"
              style="width: 110px"
            />
          </span>
          <span class="dot blue" />现价
          <span class="dot yellow" />均价
          <span class="dot red" />分钟上涨
          <span class="dot green" />分钟下跌
        </div>
      </div>
      <div class="alert-bar">
        <span class="alert-title">条件提醒</span>
        <el-checkbox
          v-for="type in ALERT_TYPES"
          :key="type.key"
          v-model="alertFlags[type.key]"
          size="small"
          :class="['alert-item', type.tone === 'warning' ? 'is-top' : 'is-bottom']"
        >{{ type.label }}</el-checkbox>
        <span v-if="alertCount" class="alert-on">已开启 {{ alertCount }} 项 · 仅提示新到数据点</span>
        <span v-else class="alert-hint">开启后在新数据点出现交叉时弹出消息框（默认关闭，刷新不保留）</span>
      </div>
      <div v-if="points.length" ref="chartRef" class="chart" :style="{ height: chartHeight }" />
      <el-empty
        v-else-if="!loading"
        description="暂无分时数据：交易时段内由服务进程内部更新器每分钟自动采样写入"
        :image-size="80"
      />
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElNotification } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import { echarts } from '@/utils/echarts'
import type { EChartsType } from '@/utils/echarts'
import { monitoringApi, subscribeIntradayStream } from '@/api/monitoring'
import type { IntradayPayload, IntradayPointItem, IntradaySessionStatus } from '@/api/monitoring'
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
const streamActive = ref(false)
const chartRef = ref<HTMLElement | null>(null)

let chartInstance: EChartsType | null = null
let chartEl: HTMLElement | null = null
let timer: ReturnType<typeof setInterval> | null = null
let streamHandle: { close: () => void } | null = null
// SSE 连续错误计数：EventSource 会自动重连；连续多次失败且未收到任何消息时降级回轮询
let streamErrorCount = 0
let streamHasMessage = false
const STREAM_MAX_ERRORS = 3

const SESSION_META: Record<string, { label: string; type: string }> = {
  trading: { label: '交易中', type: 'success' },
  lunch_break: { label: '午休', type: 'warning' },
  pre_market: { label: '开盘前', type: 'info' },
  closed: { label: '已收盘', type: 'info' },
}
const MARKET_LABELS: Record<string, string> = { A: 'A股', HK: '港股', US: '美股' }

// 各市场交易时段（与后端 market_calendar 保持一致，end 为结束边界不含）
const MARKET_SESSIONS: Record<string, Array<[string, string]>> = {
  A: [
    ['09:30', '11:30'],
    ['13:00', '15:00'],
  ],
  HK: [
    ['09:30', '12:00'],
    ['13:00', '16:00'],
  ],
  US: [['09:30', '16:00']],
}

function _minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

function _labelOf(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

/** 按市场枚举全交易分钟刻度（A=240 / HK=330 / US=390），X 轴固定不随数据变化 */
function marketSessionMinutes(market: string): string[] {
  const out: string[] = []
  for (const [start, end] of MARKET_SESSIONS[market] ?? MARKET_SESSIONS.A) {
    for (let cur = _minutesOf(start); cur < _minutesOf(end); cur += 1) {
      out.push(_labelOf(cur))
    }
  }
  return out
}

// Y 轴最小振幅（%）：以昨收为中心的最小显示范围，用户可改并保存在前端
const Y_SPAN_STORAGE_KEY = 'monitoring.yMinSpanPct'
const DEFAULT_Y_MIN_SPAN_PCT = 2

function loadYMinSpanPct(): number {
  const saved = Number(localStorage.getItem(Y_SPAN_STORAGE_KEY))
  return Number.isFinite(saved) && saved >= 0.1 && saved <= 20 ? saved : DEFAULT_Y_MIN_SPAN_PCT
}

const yMinSpanPct = ref(loadYMinSpanPct())

watch(yMinSpanPct, (value) => {
  localStorage.setItem(Y_SPAN_STORAGE_KEY, String(value))
  if (points.value.length > 0) renderChart()
})

// ------------------------------------------------------------------ //
// 分时技术指标（MACD / KDJ / RSI）：主图下方独立子图，开关状态持久化
// ------------------------------------------------------------------ //

const INDICATOR_STORAGE_KEY = 'monitoring.indicators'
const INDICATOR_DEFAULTS = { macd: true, kdj: false, rsi: false }

function loadIndicatorFlags(): Record<string, boolean> {
  try {
    const saved = JSON.parse(localStorage.getItem(INDICATOR_STORAGE_KEY) ?? '{}') as Record<string, boolean>
    return {
      macd: typeof saved.macd === 'boolean' ? saved.macd : INDICATOR_DEFAULTS.macd,
      kdj: typeof saved.kdj === 'boolean' ? saved.kdj : INDICATOR_DEFAULTS.kdj,
      rsi: typeof saved.rsi === 'boolean' ? saved.rsi : INDICATOR_DEFAULTS.rsi,
    }
  } catch {
    return { ...INDICATOR_DEFAULTS }
  }
}

const indicatorFlags = ref(loadIndicatorFlags())
const showMacd = computed({
  get: () => indicatorFlags.value.macd,
  set: (value: boolean) => { indicatorFlags.value = { ...indicatorFlags.value, macd: value }; saveIndicators() },
})
const showKdj = computed({
  get: () => indicatorFlags.value.kdj,
  set: (value: boolean) => { indicatorFlags.value = { ...indicatorFlags.value, kdj: value }; saveIndicators() },
})
const showRsi = computed({
  get: () => indicatorFlags.value.rsi,
  set: (value: boolean) => { indicatorFlags.value = { ...indicatorFlags.value, rsi: value }; saveIndicators() },
})

function saveIndicators() {
  localStorage.setItem(INDICATOR_STORAGE_KEY, JSON.stringify(indicatorFlags.value))
  if (points.value.length > 0) void nextTick().then(renderChart)
}

/** 启用的指标数量决定图表总高度（主图+量图固定，指标子图各占一档） */
const chartHeight = computed(() => {
  const count = [showMacd.value, showKdj.value, showRsi.value].filter(Boolean).length
  return `${380 + count * 150}px`
})

type Num = number | null

/** EMA（指数移动平均），period>=1 */
function ema(values: Array<number | null>, period: number): Array<number | null> {
  const out: Num[] = new Array(values.length).fill(null)
  const k = 2 / (period + 1)
  let prev: number | null = null
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i]
    if (value === null) continue
    prev = prev === null ? value : value * k + prev * (1 - k)
    out[i] = prev
  }
  return out
}

interface MacdResult { dif: Num[]; dea: Num[]; macd: Num[] }

/** MACD(12,26,9)：DIF=EMA12-EMA26，DEA=EMA(DIF,9)，MACD=(DIF-DEA)*2 */
function computeMacd(values: Num[]): MacdResult {
  const ema12 = ema(values, 12)
  const ema26 = ema(values, 26)
  const dif: Num[] = values.map((_, i) =>
    ema12[i] !== null && ema26[i] !== null ? (ema12[i] as number) - (ema26[i] as number) : null,
  )
  const dea = ema(dif, 9)
  const macd: Num[] = dif.map((value, i) =>
    value !== null && dea[i] !== null ? ((value - (dea[i] as number)) * 2) : null,
  )
  return { dif, dea, macd }
}

interface KdjResult { k: Num[]; d: Num[]; j: Num[] }

/** KDJ(9,3,3)：RSV=(C-Ln)/(Hn-Ln)*100，K=RSV 的 3 日平滑，D=K 的 3 日平滑，J=3K-2D */
function computeKdj(
  closes: Num[], highs: Num[], lows: Num[], period = 9,
): KdjResult {
  const k: Num[] = new Array(closes.length).fill(null)
  const d: Num[] = new Array(closes.length).fill(null)
  const j: Num[] = new Array(closes.length).fill(null)
  let prevK: number | null = null
  let prevD: number | null = null
  for (let i = 0; i < closes.length; i += 1) {
    const close = closes[i]
    if (close === null) continue
    let high = -Infinity
    let low = Infinity
    for (let n = Math.max(0, i - period + 1); n <= i; n += 1) {
      const h = highs[n] ?? closes[n]
      const l = lows[n] ?? closes[n]
      if (h !== null && h > high) high = h
      if (l !== null && l < low) low = l
    }
    if (!Number.isFinite(high) || !Number.isFinite(low)) continue
    const rsv = high === low ? 50 : ((close - low) / (high - low)) * 100
    prevK = prevK === null ? rsv : (rsv * 2 + prevK) / 3
    prevD = prevD === null ? prevK : (prevK * 2 + prevD) / 3
    k[i] = prevK
    d[i] = prevD
    j[i] = 3 * prevK - 2 * prevD
  }
  return { k, d, j }
}

/** RSI(N)：基于相邻收盘变动的 Wilder 平滑；样本不足或无波动返回 50（中性） */
function computeRsi(closes: Num[], period = 14): Num[] {
  const out: Num[] = new Array(closes.length).fill(null)
  let avgGain: number | null = null
  let avgLoss: number | null = null
  let seen = 0
  let prevClose: number | null = null
  for (let i = 0; i < closes.length; i += 1) {
    const close = closes[i]
    if (close === null) continue
    if (prevClose !== null) {
      const change = close - prevClose
      const gain = Math.max(change, 0)
      const loss = Math.max(-change, 0)
      seen += 1
      if (avgGain === null || avgLoss === null) {
        avgGain = gain
        avgLoss = loss
      } else {
        avgGain = (avgGain * (period - 1) + gain) / period
        avgLoss = (avgLoss * (period - 1) + loss) / period
      }
      if (seen >= period) {
        const sum = (avgGain ?? 0) + (avgLoss ?? 0)
        out[i] = sum === 0 ? 50 : ((avgGain ?? 0) / sum) * 100
      }
    }
    prevClose = close
  }
  return out
}

/**
 * 分钟成交量 = 相邻「累计成交量」差分。
 *
 * 后端 ``IntradayPoint.volume`` 是当日累计值（gm ``cum_volume`` / akshare spot 累计口径），
 * 直接按累计值画柱只会得到一条单调递增的斜坡，无法反映盘中量能分布。
 * 处理约定：
 * - 首个有效点：开盘至今的累计量即该分钟量；
 * - 数据缺口（缺前一交易分钟）：置 ``null`` 不画柱——把多分钟的量压到一根柱上会造出假天量；
 * - 累计值回退（数据源重置）：夹到 0，避免出现负柱。
 */
function computeMinuteVolumes(cumVolumes: Num[]): Num[] {
  const out: Num[] = new Array(cumVolumes.length).fill(null)
  let prev: number | null = null
  for (let i = 0; i < cumVolumes.length; i += 1) {
    const cum = cumVolumes[i]
    if (cum === null) {
      // 缺口：重置基准，避免下一根柱吞掉多分钟的量
      prev = null
      continue
    }
    if (prev === null) {
      out[i] = i === 0 ? Math.max(0, cum) : null
    } else {
      out[i] = Math.max(0, cum - prev)
    }
    prev = cum
  }
  return out
}

/** 简单移动平均：窗口内有效样本不足 period 时返回 null（不用残缺样本伪造均线） */
function computeMovingAverage(values: Num[], period: number): Num[] {
  const out: Num[] = new Array(values.length).fill(null)
  for (let i = 0; i < values.length; i += 1) {
    if (values[i] === null) continue
    let sum = 0
    let count = 0
    for (let n = Math.max(0, i - period + 1); n <= i; n += 1) {
      const value = values[n]
      if (value === null) continue
      sum += value
      count += 1
    }
    out[i] = count >= period ? sum / period : null
  }
  return out
}

/** 每分钟涨跌方向（1 涨 / 0 平 / -1 跌）：与前一分比较，首根以昨收（或开盘价）为基准 */
function computeMinuteDirections(prices: Num[], basePrice: number): number[] {
  const out: number[] = new Array(prices.length).fill(0)
  let prev: number | null = null
  for (let i = 0; i < prices.length; i += 1) {
    const price = prices[i]
    if (price === null) {
      prev = null
      continue
    }
    const reference = prev ?? (basePrice > 0 ? basePrice : null)
    out[i] = reference === null ? 0 : price > reference ? 1 : price < reference ? -1 : 0
    prev = price
  }
  return out
}

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

// ------------------------------------------------------------------ //
// 条件提醒（纯前端）：MACD / KDJ / RSI 的底部、顶部交叉 → 弹出消息框
//
// 设计边界（与需求一一对应）：
// - 判定完全在前端完成，**不依赖后端改动**，也不向后端发任何请求；
// - 由用户勾选开启，默认全部关闭；**不持久化**（刷新页面即恢复关闭态）；
// - 只对「新到数据点」生效——每次数据到达先建立基线，之后才提示，
//   避免刷新页面/切换标的时把当天历史上的交叉全部补报一遍；
// - 提示用 ElNotification（标题=标的+事件，正文=时间/价格/涨跌幅+交叉说明）。
// ------------------------------------------------------------------ //

type AlertKey = 'macd_bottom' | 'macd_top' | 'kdj_bottom' | 'kdj_top' | 'rsi_bottom' | 'rsi_top'

interface AlertType {
  key: AlertKey
  label: string
  /** 触发时展示给用户的说明文案 */
  desc: string
  /** success=机会类（底部），warning=风险类（顶部） */
  tone: 'success' | 'warning'
}

// 阈值与既有指标子图的参考线保持一致（KDJ 80/20、RSI 70/30）
const KDJ_OVERSOLD = 20
const KDJ_OVERBOUGHT = 80
const RSI_OVERSOLD = 30
const RSI_OVERBOUGHT = 70

const ALERT_TYPES: AlertType[] = [
  {
    key: 'macd_bottom', label: 'MACD底部交叉',
    desc: 'DIF 上穿 DEA 且交叉前双线均在 0 轴下方（低位金叉）', tone: 'success',
  },
  {
    key: 'macd_top', label: 'MACD顶部交叉',
    desc: 'DIF 下穿 DEA 且交叉前双线均在 0 轴上方（高位死叉）', tone: 'warning',
  },
  {
    key: 'kdj_bottom', label: 'KDJ底部交叉',
    desc: `K 上穿 D 且交叉前双线均处超卖区（<${KDJ_OVERSOLD}）`, tone: 'success',
  },
  {
    key: 'kdj_top', label: 'KDJ顶部交叉',
    desc: `K 下穿 D 且交叉前双线均处超买区（>${KDJ_OVERBOUGHT}）`, tone: 'warning',
  },
  {
    key: 'rsi_bottom', label: 'RSI底部交叉',
    desc: `RSI 由下向上穿过 ${RSI_OVERSOLD}（脱离超卖）`, tone: 'success',
  },
  {
    key: 'rsi_top', label: 'RSI顶部交叉',
    desc: `RSI 由上向下穿过 ${RSI_OVERBOUGHT}（脱离超买）`, tone: 'warning',
  },
]

// 未持久化：普通 ref（区别于上方 indicatorFlags 的 localStorage 存储）
const alertFlags = ref<Record<AlertKey, boolean>>({
  macd_bottom: false, macd_top: false, kdj_bottom: false, kdj_top: false,
  rsi_bottom: false, rsi_top: false,
})

/** 已开启的提醒项数（仅用于 UI 提示） */
const alertCount = computed(() => ALERT_TYPES.filter((t) => alertFlags.value[t.key]).length)

/** 已评估到的最新数据时间戳；换标的时清空（首帧只建基线不提示） */
let alertSymbol = ''
let alertEvaluatedTs = ''

/** 上穿：前一根 A<=B 且当根 A>B（任一侧缺失则不判定） */
function crossUp(a: Num[], b: Num[], i: number): boolean {
  if (i === 0) return false
  const [pa, pb, ca, cb] = [a[i - 1], b[i - 1], a[i], b[i]]
  if (pa === null || pb === null || ca === null || cb === null) return false
  return pa <= pb && ca > cb
}

/** 下穿：前一根 A>=B 且当根 A<B（任一侧缺失则不判定） */
function crossDown(a: Num[], b: Num[], i: number): boolean {
  if (i === 0) return false
  const [pa, pb, ca, cb] = [a[i - 1], b[i - 1], a[i], b[i]]
  if (pa === null || pb === null || ca === null || cb === null) return false
  return pa >= pb && ca < cb
}

interface AlertIndicators {
  dif: Num[]
  dea: Num[]
  k: Num[]
  d: Num[]
  rsi: Num[]
}

/** 一次性算齐三个指标（每根约 240 点，成本可忽略），供交叉判定复用 */
function computeAlertIndicators(series: AlignedSeries): AlertIndicators {
  const { dif, dea } = computeMacd(series.prices)
  const { k, d } = computeKdj(series.prices, series.highs, series.lows)
  return { dif, dea, k, d, rsi: computeRsi(series.prices) }
}

/**
 * 判定第 i 根 K 线触发了哪些交叉事件（纯函数，不依赖开关状态）。
 *
 * 关键语义是「带位置约束的交叉」——仅区分金叉/死叉会把大量中位震荡算作信号，
 * 故底部/顶部要求交叉**发生在对应极值区**：
 * - MACD：交叉**前**双线同侧（都在 0 轴下=低位金叉 / 都在 0 轴上=高位死叉）；
 * - KDJ：交叉**前**双线同处超卖(<20)或超买(>80)区；
 * - RSI：与阈值线本身交叉（上穿 30 / 下穿 70）。
 *
 * 用「交叉前」而非「交叉后」的取值：交叉后价格已从极值区反弹离开，
 * 用后置值会漏掉刚脱离超卖区的那次金叉。
 */
function detectCrossSignals(ind: AlertIndicators, i: number): AlertKey[] {
  const out: AlertKey[] = []
  if (i < 1) return out

  const [dPrev, ePrev] = [ind.dif[i - 1], ind.dea[i - 1]]
  const bothBelowZero = dPrev !== null && ePrev !== null && dPrev < 0 && ePrev < 0
  const bothAboveZero = dPrev !== null && ePrev !== null && dPrev > 0 && ePrev > 0
  if (bothBelowZero && crossUp(ind.dif, ind.dea, i)) out.push('macd_bottom')
  if (bothAboveZero && crossDown(ind.dif, ind.dea, i)) out.push('macd_top')

  const [kPrev, dPrevK] = [ind.k[i - 1], ind.d[i - 1]]
  const bothOversold = kPrev !== null && dPrevK !== null && kPrev < KDJ_OVERSOLD && dPrevK < KDJ_OVERSOLD
  const bothOverbought = kPrev !== null && dPrevK !== null && kPrev > KDJ_OVERBOUGHT && dPrevK > KDJ_OVERBOUGHT
  if (bothOversold && crossUp(ind.k, ind.d, i)) out.push('kdj_bottom')
  if (bothOverbought && crossDown(ind.k, ind.d, i)) out.push('kdj_top')

  const [rPrev, rNow] = [ind.rsi[i - 1], ind.rsi[i]]
  if (rPrev !== null && rNow !== null) {
    if (rPrev < RSI_OVERSOLD && rNow >= RSI_OVERSOLD) out.push('rsi_bottom')
    if (rPrev > RSI_OVERBOUGHT && rNow <= RSI_OVERBOUGHT) out.push('rsi_top')
  }
  return out
}

function fmtNum(value: Num): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-'
  return Math.abs(value) >= 100 ? value.toFixed(1) : value.toFixed(3)
}

/**
 * 每次数据到达后评估提醒：只处理**比上次更晚**的新数据点。
 *
 * - 首帧（页面加载 / 切换标的）只把最新时间戳写入基线，不提示——否则会把当天
 *   历史上的每一次交叉都补报出来，沦为噪音；
 * - 全部未开启时也推进基线，确保「中途开启」不会回头补报开启前的历史信号；
 * - 换标的时由 `alertSymbol` 不匹配触发重建基线。
 */
function evaluateAlerts() {
  const pts = points.value
  if (pts.length < 2) return
  const latestTs = pts[pts.length - 1].ts

  if (alertSymbol !== symbolCode.value) {
    alertSymbol = symbolCode.value
    alertEvaluatedTs = latestTs
    return
  }

  const enabled = ALERT_TYPES.filter((t) => alertFlags.value[t.key])
  if (enabled.length === 0 || latestTs <= alertEvaluatedTs) {
    // 未开启也推进基线，避免中途开启时回头补报历史
    alertEvaluatedTs = latestTs
    return
  }

  const series = buildAlignedSeries()
  if (!series) return
  const indicators = computeAlertIndicators(series)

  // 只考察「上次基线之后」新到的数据点（含当根最新点）
  const candidates: number[] = []
  for (let i = 0; i < series.priceTs.length; i += 1) {
    const ts = series.priceTs[i]
    if (ts !== null && ts > alertEvaluatedTs && ts <= latestTs) candidates.push(i)
  }
  const latestIndex = series.fixedTimes.indexOf(pts[pts.length - 1].local_time)
  if (latestIndex >= 0 && !candidates.includes(latestIndex)) candidates.push(latestIndex)

  const fired = new Set<AlertKey>()
  for (const index of candidates) {
    for (const key of detectCrossSignals(indicators, index)) {
      if (alertFlags.value[key]) fired.add(key)
    }
  }
  for (const type of enabled) {
    if (fired.has(type.key)) raiseAlert(type, series, indicators)
  }
  alertEvaluatedTs = latestTs
}

/** 弹出消息框：标题=事件+标的，正文=时间/价格/涨跌幅/交叉说明/指标值 */
function raiseAlert(type: AlertType, series: AlignedSeries, indicators: AlertIndicators) {
  const latest = points.value[points.value.length - 1]
  if (!latest) return
  const index = series.fixedTimes.indexOf(latest.local_time)
  const name = symbolOptions.value.find((item) => item.code === symbolCode.value)?.name ?? ''
  const change = Number(latest.change)
  const changeColor = change > 0 ? '#dc2626' : change < 0 ? '#16a34a' : '#667085'
  const rows = [
    `<b>${latest.local_time}</b>　现价 ${latest.price}` +
      `（<span style="color:${changeColor}">${latest.change}%</span>）`,
    type.desc,
  ]

  // 附加触发那一根的指标值，便于用户复核
  let values = ''
  if (index >= 0) {
    if (type.key.startsWith('macd')) {
      values = `DIF ${fmtNum(indicators.dif[index])} / DEA ${fmtNum(indicators.dea[index])}`
    } else if (type.key.startsWith('kdj')) {
      values = `K ${fmtNum(indicators.k[index])} / D ${fmtNum(indicators.d[index])}`
    } else {
      values = `RSI ${fmtNum(indicators.rsi[index])}`
    }
  }
  if (values) rows.push(`指标值：${values}`)

  ElNotification({
    title: `${type.label} · ${symbolCode.value}${name ? ` ${name}` : ''}`,
    message: rows.join('<br/>'),
    type: type.tone,
    duration: 8000,
    dangerouslyUseHTMLString: true,
    offset: 48,
  })
}

function applyPayload(data: IntradayPayload) {
  payload.value = data
  // 增量合并：服务端每次返回当日全量，按 ts 求并集后升序（避免全量重绘）
  const byTs = new Map(points.value.map((point) => [point.ts, point] as const))
  for (const point of (data.points ?? [])) {
    byTs.set(point.ts, point)
  }
  points.value = [...byTs.values()].sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0))
  // 评估条件提醒（与渲染解耦：首帧只建基线，之后只对新到数据点提示）
  evaluateAlerts()
  // points 从空到非空会触发 v-if 重建图表 div；DOM 更新在 nextTick，
  // 必须等渲染完成后再画图，否则 chartRef 为 null 提前 return（表现为进入页面白图，需手动刷新）
  void nextTick().then(renderChart)
  if (!streamActive.value) schedulePolling()
}

/** 一次对齐后的分时序列（渲染与提醒判定共用，避免两处逻辑漂移） */
interface AlignedSeries {
  fixedTimes: string[]
  prices: Num[]
  avgPrices: Num[]
  volumes: Array<number | null>
  highs: Num[]
  lows: Num[]
  pointByTime: Map<string, IntradayPointItem>
  /** 每个刻度对应的点时间戳（缺数据为 null），供提醒按新到数据点判定 */
  priceTs: Array<string | null>
}

/**
 * 把 `points` 按市场固定分钟刻度对齐成定长序列。
 *
 * X 轴按市场固定为全交易分钟（A=240 / HK=330 / US=390），不随已有数据伸缩，
 * 缺数据处为 null。提醒判定与图表渲染共用本函数，保证两侧看到的是同一份数据。
 */
function buildAlignedSeries(): AlignedSeries | null {
  const current = payload.value
  if (!current) return null
  const fixedTimes = marketSessionMinutes(current.market ?? 'A')
  const timeIndex = new Map(fixedTimes.map((label, index) => [label, index] as const))
  const prices: Num[] = new Array(fixedTimes.length).fill(null)
  const avgPrices: Num[] = new Array(fixedTimes.length).fill(null)
  const volumes: Array<number | null> = new Array(fixedTimes.length).fill(null)
  const highs: Num[] = new Array(fixedTimes.length).fill(null)
  const lows: Num[] = new Array(fixedTimes.length).fill(null)
  const priceTs: Array<string | null> = new Array(fixedTimes.length).fill(null)
  const pointByTime = new Map<string, IntradayPointItem>()
  for (const point of points.value) {
    const index = timeIndex.get(point.local_time)
    if (index === undefined) continue
    prices[index] = Number(point.price)
    avgPrices[index] = point.avg_price === null || point.avg_price === '' ? null : Number(point.avg_price)
    volumes[index] = point.volume
    highs[index] = point.high === null || point.high === '' ? null : Number(point.high)
    lows[index] = point.low === null || point.low === '' ? null : Number(point.low)
    priceTs[index] = point.ts
    pointByTime.set(point.local_time, point)
  }
  return { fixedTimes, prices, avgPrices, volumes, highs, lows, pointByTime, priceTs }
}

function renderChart() {
  if (!chartRef.value) return
  // v-if 切换（清空数据/切换标的）会重建图表 div；DOM 元素变化时必须重建实例，
  // 否则旧实例仍绑定在已脱离文档的节点上，setOption 渲染不出来（表现为切标的白图）
  if (chartEl !== chartRef.value) {
    chartInstance?.dispose()
    chartInstance = null
    chartEl = chartRef.value
  }
  chartInstance ??= echarts.init(chartRef.value)

  const aligned = buildAlignedSeries()
  if (!aligned) return
  const { fixedTimes, prices, avgPrices, volumes, highs, lows, pointByTime } = aligned
  // 量能子图：后端 volume/amount 均为当日累计值，柱状必须画「分钟增量」而非累计斜坡
  const minuteVolumes = computeMinuteVolumes(volumes)
  // 柱子按「当分钟涨跌」着色（红涨绿跌），而非按当日累计涨跌幅——
  // 后者在单边行情下会让全天柱子同色，丢失当分钟多空信息
  const minuteDirections = computeMinuteDirections(prices, Number(payload.value?.pre_close ?? 0))
  const volumeBars = minuteVolumes.map((value, index) => ({
    value,
    itemStyle: {
      color: minuteDirections[index] > 0 ? '#dc2626' : minuteDirections[index] < 0 ? '#16a34a' : '#94a3b8',
    },
  }))
  // 量能均线：VOL MA5 / MA10，用于识别放量 / 缩量
  const volumeMa5 = computeMovingAverage(minuteVolumes, 5)
  const volumeMa10 = computeMovingAverage(minuteVolumes, 10)
  // 价格轴：以昨收为中心，最小振幅 = max(实际波动, yMinSpanPct%)
  const preClose = Number(payload.value?.pre_close ?? 0)
  let priceMin: number | undefined
  let priceMax: number | undefined
  if (preClose > 0) {
    let deviation = 0
    for (const value of prices) {
      if (value !== null) deviation = Math.max(deviation, Math.abs(value - preClose))
    }
    const halfSpan = Math.max(deviation, (preClose * yMinSpanPct.value) / 100) * 1.05
    priceMin = Number((preClose - halfSpan).toFixed(4))
    priceMax = Number((preClose + halfSpan).toFixed(4))
  }

  const labelInterval = (index: number): boolean =>
    index % 30 === 0 || index === fixedTimes.length - 1

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      formatter: (params: unknown) => {
        const list = params as unknown as Array<{ dataIndex?: number }>
        if (!Array.isArray(list) || list.length === 0) return ''
        const dataIndex = Number(list[0].dataIndex ?? 0)
        const point = pointByTime.get(fixedTimes[dataIndex])
        if (!point) return ''
        const change = Number(point.change)
        const changeColor = change > 0 ? '#dc2626' : change < 0 ? '#16a34a' : '#667085'
        const minuteVolume = minuteVolumes[dataIndex]
        const rows = [
          `<b>${point.local_time}</b>`,
          `现价：${point.price}`,
          point.avg_price !== null && point.avg_price !== '' ? `均价：${point.avg_price}` : '',
          `涨跌幅：<span style="color:${changeColor}">${point.change}%</span>`,
          // 量能柱画的是分钟增量（累计量差分），两个口径都要给出，避免与柱子对不上
          minuteVolume === null || minuteVolume === undefined
            ? ''
            : `分钟量：${formatCompact(minuteVolume)}`,
          `累计量：${formatCompact(point.volume)}`,
          point.amount !== null && point.amount !== '' ? `累计额：${point.amount}` : '',
        ]
        return rows.filter(Boolean).join('<br/>')
      },
    },
    legend: {
      data: ['现价', '均价', '成交量', '量MA5', '量MA10'],
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
        data: fixedTimes,
        boundaryGap: false,
        axisLabel: { color: '#667085', interval: labelInterval, rotate: 45 },
        axisLine: { lineStyle: { color: '#e6e8ec' } },
      },
      {
        type: 'category',
        gridIndex: 1,
        data: fixedTimes,
        boundaryGap: false,
        axisLabel: { show: false },
        axisTick: { show: false },
        axisLine: { show: false },
      },
    ],
    yAxis: [
      {
        type: 'value',
        min: priceMin,
        max: priceMax,
        scale: priceMin === undefined,
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
        // 量能一律 0 基线：非 0 基线会视觉放大分钟量差异
        min: 0,
        axisLabel: { color: '#98a2b3', formatter: formatCompact },
        splitNumber: 2,
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
      {
        name: '量MA5',
        type: 'line',
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: volumeMa5,
        showSymbol: false,
        smooth: true,
        lineStyle: { color: '#f59e0b', width: 1.2 },
        tooltip: { show: false },
        emphasis: { focus: 'series' },
      },
      {
        name: '量MA10',
        type: 'line',
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: volumeMa10,
        showSymbol: false,
        smooth: true,
        lineStyle: { color: '#8b5cf6', width: 1.2 },
        tooltip: { show: false },
        emphasis: { focus: 'series' },
      },
    ],
    dataZoom: [
      { type: 'inside', xAxisIndex: [0, 1], min: 40, max: 100 },
      { type: 'slider', xAxisIndex: [0, 1], bottom: 0, height: 18 },
    ],
  }
  applyIndicatorLayout(option, {
    fixedTimes,
    labelInterval,
    prices,
    highs,
    lows,
    showMacd: showMacd.value,
    showKdj: showKdj.value,
    showRsi: showRsi.value,
  })
  // 取消勾选副图指标时，旧元素的 grid/series 会残留在图上；先 clear 再整体替换（notMerge）
  chartInstance.clear()
  chartInstance.setOption(option, true)
}

interface IndicatorContext {
  fixedTimes: string[]
  labelInterval: (index: number) => boolean
  prices: Num[]
  highs: Num[]
  lows: Num[]
  showMacd: boolean
  showKdj: boolean
  showRsi: boolean
}

/** 在基础 option 上追加「主图下方」的指标子图：改写主/量 grid 高度，动态追加 grid/axis/series */
function applyIndicatorLayout(option: Record<string, unknown>, ctx: IndicatorContext) {
  const grids = option.grid as Array<Record<string, unknown>>
  const xAxes = option.xAxis as Array<Record<string, unknown>>
  const yAxes = option.yAxis as Array<Record<string, unknown>>
  const series = option.series as Array<Record<string, unknown>>
  // 重新分配纵向空间：主图 30% / 量图 12%（容纳量MA5/量MA10）/ 指标各 11%（间隔 2%），dataZoom 常驻底部
  grids[0] = { ...grids[0], top: 34, height: '30%' }
  grids[1] = { ...grids[1], top: '42%', height: '12%' }

  const enabled: Array<{ name: string; build: (gridIndex: number) => Record<string, unknown>[] }> = []
  if (ctx.showMacd) {
    const { dif, dea, macd } = computeMacd(ctx.prices)
    enabled.push({ name: 'MACD(12,26,9)', build: (i) => [
      {
        name: 'MACD', type: 'bar', xAxisIndex: i, yAxisIndex: i, data: macd,
        barWidth: '62%', tooltip: { show: false },
        itemStyle: { color: (p: { value: number | null }) => ((p.value ?? 0) >= 0 ? '#dc2626' : '#16a34a') },
      },
      { name: 'DIF', type: 'line', xAxisIndex: i, yAxisIndex: i, data: dif, showSymbol: false, lineStyle: { color: '#3b82f6', width: 1.2 } },
      { name: 'DEA', type: 'line', xAxisIndex: i, yAxisIndex: i, data: dea, showSymbol: false, lineStyle: { color: '#f59e0b', width: 1.2 } },
    ] })
  }
  if (ctx.showKdj) {
    const { k, d, j } = computeKdj(ctx.prices, ctx.highs, ctx.lows)
    enabled.push({ name: 'KDJ(9,3,3)', build: (i) => [
      { name: 'K', type: 'line', xAxisIndex: i, yAxisIndex: i, data: k, showSymbol: false, lineStyle: { color: '#3b82f6', width: 1.2 } },
      { name: 'D', type: 'line', xAxisIndex: i, yAxisIndex: i, data: d, showSymbol: false, lineStyle: { color: '#f59e0b', width: 1.2 } },
      { name: 'J', type: 'line', xAxisIndex: i, yAxisIndex: i, data: j, showSymbol: false, lineStyle: { color: '#a855f7', width: 1.2 } },
    ] })
  }
  if (ctx.showRsi) {
    const rsi = computeRsi(ctx.prices)
    enabled.push({ name: 'RSI(14)', build: (i) => [
      {
        name: 'RSI', type: 'line', xAxisIndex: i, yAxisIndex: i, data: rsi,
        showSymbol: false, lineStyle: { color: '#8b5cf6', width: 1.4 },
        markLine: {
          silent: true, symbol: 'none', label: { show: false },
          lineStyle: { color: '#cbd5e1', type: 'dashed' },
          data: [{ yAxis: 30 }, { yAxis: 70 }],
        },
      },
    ] })
  }
  if (enabled.length === 0) return

  let top = 56
  for (const sub of enabled) {
    const gridIndex = xAxes.length
    grids.push({ left: 66, right: 20, top: `${top}%`, height: '11%' })
    xAxes.push({
      type: 'category', gridIndex, data: ctx.fixedTimes, boundaryGap: false,
      axisLabel: { show: false }, axisTick: { show: false }, axisLine: { show: false },
    })
    yAxes.push({
      type: 'value', gridIndex, name: sub.name,
      nameTextStyle: { color: '#98a2b3', fontSize: 11 },
      ...(sub.name.startsWith('RSI') ? { min: 0, max: 100 } : {}),
      axisLabel: { color: '#98a2b3' }, splitNumber: 2,
      splitLine: { lineStyle: { color: '#f1f3f7' } },
    })
    series.push(...sub.build(gridIndex))
    top += 13
  }
  // dataZoom 联动全部 grid（含新增指标子图）
  const allIndexes = xAxes.map((_, index) => index)
  option.dataZoom = [
    { type: 'inside', xAxisIndex: allIndexes, min: 40, max: 100 },
    { type: 'slider', xAxisIndex: allIndexes, bottom: 0, height: 18 },
  ]
}

function formatCompact(value: number | string): string {
  const number = Number(value)
  if (number >= 1_0000) return `${Math.round(number / 1_0000)}万`
  if (number >= 1_000) return `${(number / 1_000).toFixed(1)}k`
  return String(number)
}

function schedulePolling() {
  stopPolling()
  if (streamActive.value) return
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

// ------------------------------------------------------------------ //
// SSE 持久化连接（snapshot → tick* → session），失败自动降级回轮询
// ------------------------------------------------------------------ //

function handleStreamError() {
  streamErrorCount += 1
  if (!streamHasMessage && streamErrorCount >= STREAM_MAX_ERRORS) {
    // 连接始终未成功：降级为 HTTP 轮询
    closeStream()
    streamActive.value = false
    console.error('SSE 连接连续失败，已降级为轮询模式')
    void refresh(true)
    schedulePolling()
  }
}

function startStream() {
  if (!symbolCode.value) return
  closeStream()
  streamErrorCount = 0
  streamHasMessage = false
  streamActive.value = true
  stopPolling()
  streamHandle = subscribeIntradayStream(symbolCode.value, {
    onSnapshot: (data) => {
      streamHasMessage = true
      applyPayload(data)
    },
    onTick: (data) => {
      streamHasMessage = true
      applyPayload(data)
    },
    onSession: (next: IntradaySessionStatus) => {
      if (payload.value) payload.value.session_status = next
      renderChart()
    },
    onError: () => handleStreamError(),
  })
}

function closeStream() {
  streamHandle?.close()
  streamHandle = null
}

function handleResize() {
  chartInstance?.resize()
}

watch(symbolCode, (code) => {
  if (!code) return
  points.value = []
  payload.value = null
  // 彻底重置图表：points 清空触发 v-if 移除 div，旧实例已失效，直接销毁
  chartInstance?.dispose()
  chartInstance = null
  chartEl = null
  // 条件提醒：换标的重建评估基线，新标的首帧只建基线不提示历史交叉
  alertSymbol = ''
  alertEvaluatedTs = ''

  // SSE 持久化连接：切换标的即重建连接；snapshot 事件推送全量
  startStream()
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
  closeStream()
  stopPolling()
  chartInstance?.dispose()
  chartInstance = null
  chartEl = null
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

.y-span-control {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-right: 8px;
}

.control-label {
  color: #667085;
  font-size: 12px;
  white-space: nowrap;
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