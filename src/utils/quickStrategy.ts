/**
 * 策略快速创建向导 · 前端核心（模块10 设计）
 *
 * - params 构建：对齐后端 `apps/cases/serializers.py` 的 CASE_SCHEMA 白名单与
 *   `validate_case_schema` 语义（indicator 目录 / RSI·KDJ 阈值区间 / MACD fast<slow
 *   / order·filter 结构）
 * - 编排结构：对齐 runner/engine.py 事件语义——根 Suite Case 由 SUITE_INIT 触发；
 *   跨阶段（过滤/执行）用「子 Suite + 边事件(CASE_COMPLETED → CASE_START)」串联；
 *   双方向用 op=eq field=direction threshold=±1 分流
 * - 一键链路：复用既有 API 顺序执行「建 Case → 建 Suite(+拓扑) → 发布 Case →
 *   发布 Suite → 建 Plan → 发布 Plan →（可选）启动」，后端零新增接口
 */
import { strategyApi } from '@/api/strategy'
import type { CaseItem, PlanItem, SuiteItem } from '@/types/api'

export type TemplateKind = 'signal_only' | 'signal_executor' | 'dual_direction'

export interface SignalForm {
  indicator: string
  period: number | null
  fast: number | null
  slow: number | null
  signal: number | null
  thresholdOversold: number | null
  thresholdOverbought: number | null
  threshold: number | null
  direction: -1 | 0 | 1
}

export interface FilterForm {
  enabled: boolean
  op: 'keep' | 'drop'
  field: string
  threshold: number | null
}

export interface ExecutorForm {
  direction: 'buy' | 'sell'
  price: string
  volume: number
}

export interface RuntimeForm {
  namePrefix: string
  symbolScopeType: 'all' | 'groups' | 'symbols'
  groupIds: number[]
  symbolCodes: string[]
  triggerType: 'manual' | 'time' | 'event'
  time: string
  weekdays: number[] // 0=周一 … 6=周日（UI 语义）
  eventType: string
  execMode: 'serial' | 'parallel' | 'fail_stop'
  maxRetries: number
  delaySeconds: number
  accountId: string
  allocatedCapital: string
  suiteStartMode: 'auto' | 'manual'
}

export interface TemplateMeta {
  kind: TemplateKind
  label: string
  description: string
  needsFilter: boolean
  needsExecutor: boolean
}

export const QUICK_TEMPLATES: TemplateMeta[] = [
  { kind: 'signal_only', label: '单信号策略', description: '一个技术指标信号，监控到即输出方向（最简，适合先跑通）', needsFilter: false, needsExecutor: false },
  { kind: 'signal_executor', label: '信号 + 执行', description: '指标信号 → 可选过滤 → 自动下单（订单写库，接入风控/资金）', needsFilter: true, needsExecutor: true },
  { kind: 'dual_direction', label: '双向执行', description: '一个信号，向上买入、向下卖出两个方向分支', needsFilter: false, needsExecutor: true },
]

export const INDICATOR_META: Record<string, { label: string; needsPeriod: boolean; macd?: boolean; rsiKdj?: boolean; singleThreshold?: boolean }> = {
  ma: { label: 'MA 均线', needsPeriod: true },
  sma: { label: 'SMA', needsPeriod: true },
  mean: { label: 'Mean 均值', needsPeriod: true },
  ema: { label: 'EMA 指数均线', needsPeriod: true },
  macd: { label: 'MACD', needsPeriod: false, macd: true },
  rsi: { label: 'RSI', needsPeriod: true, rsiKdj: true },
  kdj: { label: 'KDJ', needsPeriod: true, rsiKdj: true },
  boll: { label: 'BOLL 布林', needsPeriod: true, singleThreshold: true },
  roc: { label: 'ROC', needsPeriod: true },
  momentum: { label: 'Momentum', needsPeriod: true },
  pct_change: { label: 'PctChange 涨跌幅', needsPeriod: true },
  volatility: { label: 'Volatility 波动率', needsPeriod: true, singleThreshold: true },
}
export const INDICATOR_IDS = Object.keys(INDICATOR_META)

export const TEMPLATE_LABELS: Record<TemplateKind, string> = {
  signal_only: '单信号策略',
  signal_executor: '信号 + 执行',
  dual_direction: '双向执行',
}

// ---------------------------------------------------------------------------
// params 构建（对齐后端 CASE_SCHEMA 白名单）
// ---------------------------------------------------------------------------

export function buildSignalParams(form: SignalForm, triggerEvent = 'SUITE_INIT'): Record<string, unknown> {
  const params: Record<string, unknown> = {
    trigger: { event_type: triggerEvent },
    indicator: form.indicator,
    direction: form.direction,
  }
  if (form.indicator === 'macd') {
    if (form.fast !== null && form.fast !== undefined) params.fast = form.fast
    if (form.slow !== null && form.slow !== undefined) params.slow = form.slow
    if (form.signal !== null && form.signal !== undefined) params.signal = form.signal
  } else if (form.period !== null && form.period !== undefined) {
    params.period = form.period
  }
  if (form.indicator === 'rsi' || form.indicator === 'kdj') {
    if (form.thresholdOversold !== null && form.thresholdOversold !== undefined) params.threshold_oversold = form.thresholdOversold
    if (form.thresholdOverbought !== null && form.thresholdOverbought !== undefined) params.threshold_overbought = form.thresholdOverbought
  } else if (form.threshold !== null && form.threshold !== undefined) {
    params.threshold = form.threshold
  }
  return params
}

export function buildFilterParams(form: FilterForm, triggerEvent = 'CASE_START'): Record<string, unknown> {
  const filter: Record<string, unknown> = { op: form.op }
  if (form.field) filter.field = form.field
  if (form.threshold !== null && form.threshold !== undefined) filter.threshold = form.threshold
  return { trigger: { event_type: triggerEvent }, filter }
}

export function buildExecutorParams(form: ExecutorForm, direction: -1 | 1, triggerEvent = 'CASE_START'): Record<string, unknown> {
  const order = { direction: form.direction, price: Number(form.price), volume: form.volume }
  return {
    trigger: { event_type: triggerEvent },
    result: { direction, order: { ...order } },
    order: { ...order },
  }
}

// ---------------------------------------------------------------------------
// 前端轻量校验（对齐后端 validate_case_schema，返回首个错误或 null）
// ---------------------------------------------------------------------------

function finiteNumber(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value)
}

export function validateSignalForm(form: SignalForm): string | null {
  if (!INDICATOR_IDS.includes(form.indicator)) return '请选择指标'
  const meta = INDICATOR_META[form.indicator]
  if (meta.needsPeriod && (form.period === null || !Number.isInteger(form.period) || (form.period as number) < 1)) {
    return '周期必须是不小于 1 的整数'
  }
  if (form.indicator === 'macd') {
    if (form.fast !== null && form.fast !== undefined && (!Number.isInteger(form.fast) || form.fast < 1)) return 'MACD fast 必须是不小于 1 的整数'
    if (form.slow !== null && form.slow !== undefined && (!Number.isInteger(form.slow) || form.slow < 1)) return 'MACD slow 必须是不小于 1 的整数'
    if (form.fast !== null && form.slow !== null && form.slow !== undefined && form.fast !== undefined && form.fast >= form.slow) {
      return 'MACD fast 必须小于 slow'
    }
    if (form.signal !== null && form.signal !== undefined && (!Number.isInteger(form.signal) || form.signal < 1)) return 'MACD signal 必须是不小于 1 的整数'
  }
  if (form.indicator === 'rsi' || form.indicator === 'kdj') {
    const lo = form.thresholdOversold
    const hi = form.thresholdOverbought
    if (lo !== null && lo !== undefined && (!finiteNumber(lo) || lo < 0 || lo > 100)) return '超卖阈值必须在 0~100 之间'
    if (hi !== null && hi !== undefined && (!finiteNumber(hi) || hi < 0 || hi > 100)) return '超买阈值必须在 0~100 之间'
    if (lo !== null && hi !== null && lo !== undefined && hi !== undefined && lo >= hi) return '超卖阈值必须小于超买阈值'
  }
  if (form.threshold !== null && form.threshold !== undefined && !finiteNumber(form.threshold)) return '阈值必须是有限数值'
  if (form.direction !== -1 && form.direction !== 0 && form.direction !== 1) return '方向必须是 -1、0 或 1'
  return null
}

export function validateFilterForm(form: FilterForm): string | null {
  if (!form.enabled) return null
  if (!form.field.trim()) return '过滤器必须提供 field'
  if (form.threshold === null || form.threshold === undefined || !finiteNumber(form.threshold)) return '过滤器提供 field 时必须同时提供阈值'
  return null
}

export function validateExecutorForm(form: ExecutorForm): string | null {
  if (!finiteNumber(Number(form.price)) || Number(form.price) <= 0) return '订单价格必须为大于 0 的有限数值'
  if (!Number.isInteger(form.volume) || form.volume < 1) return '订单数量必须是不小于 1 的整数'
  return null
}

export function validateRuntimeForm(form: RuntimeForm): string | null {
  if (!form.namePrefix.trim()) return '策略名称不能为空'
  if (form.symbolScopeType === 'groups' && form.groupIds.length === 0) return '请选择至少一个分组'
  if (form.symbolScopeType === 'symbols' && form.symbolCodes.length === 0) return '请选择至少一个标的'
  if (form.triggerType === 'time') {
    if (!/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/.test(form.time)) return '请选择有效的触发时间'
    if (form.weekdays.length === 0) return '请选择至少一个星期'
  }
  if (form.triggerType === 'event' && !form.eventType) return '请选择触发事件'
  if (form.maxRetries < 0 || !Number.isInteger(form.maxRetries)) return '重试次数必须是不小于 0 的整数'
  if (form.delaySeconds < 0 || !Number.isInteger(form.delaySeconds)) return '重试延迟必须是不小于 0 的整数'
  return null
}

// ---------------------------------------------------------------------------
// 蓝图（Blueprint）：模板 → 一组待创建实体
// ---------------------------------------------------------------------------

export interface CaseBlueprint {
  name: string
  node_type: CaseItem['node_type']
  params: Record<string, unknown>
}

export interface SuiteBlueprint {
  name: string
  aggregate_method: SuiteItem['aggregate_method']
  parent?: number // suites 列表中的下标（root 缺省）
  caseIndexes: number[] // cases 列表下标
}

export interface EdgeBlueprint {
  fromSuiteIndex: number
  toSuiteIndex: number
  event_condition: Record<string, unknown>
  weight: number
}

export interface PlanBlueprint {
  name: string
  trigger_type: PlanItem['trigger_type']
  cron_expr: string | null
  event_type: string | null
  /** 标的范围已下沉到 Case.params.symbol_scope，Plan 不再持有该字段 */
  exec_mode: PlanItem['exec_mode']
  retry_policy: Record<string, unknown>
  account_id?: string
  allocated_capital?: string
  suite_start_mode: PlanItem['suite_start_mode']
}

export interface QuickBlueprint {
  cases: CaseBlueprint[]
  suites: SuiteBlueprint[]
  edges: EdgeBlueprint[]
  plan: PlanBlueprint
}

function suiteName(prefix: string, extra: string): string {
  return `${prefix.trim() || '快速策略'}${extra}`
}

export function buildBlueprint(
  template: TemplateKind,
  signal: SignalForm,
  filter: FilterForm,
  executor: ExecutorForm,
  runtime: RuntimeForm,
): QuickBlueprint {
  const cases: CaseBlueprint[] = [{
    name: suiteName(runtime.namePrefix, ' · 信号'),
    node_type: 'signal',
    params: buildSignalParams(signal, 'SUITE_INIT'),
  }]
  const suites: SuiteBlueprint[] = [{
    name: suiteName(runtime.namePrefix, ''),
    aggregate_method: 'weighted_sum',
    caseIndexes: [0],
  }]
  const edges: EdgeBlueprint[] = []

  if (template === 'signal_executor') {
    // 信号 →（可选 过滤子 Suite）→ 执行子 Suite（跨阶段用边事件串联）
    if (filter.enabled) {
      cases.push({ name: suiteName(runtime.namePrefix, ' · 过滤'), node_type: 'filter', params: buildFilterParams(filter) })
      const filterSuiteIndex = suites.length
      suites.push({
        name: suiteName(runtime.namePrefix, ' · 过滤'),
        aggregate_method: 'weighted_sum',
        parent: 0,
        caseIndexes: [cases.length - 1],
      })
      edges.push({ fromSuiteIndex: 0, toSuiteIndex: filterSuiteIndex, event_condition: { event_type: 'CASE_COMPLETED' }, weight: 1 })
    }
    cases.push({
      name: suiteName(runtime.namePrefix, ' · 执行'),
      node_type: 'executor',
      params: buildExecutorParams(executor, executor.direction === 'buy' ? 1 : -1),
    })
    const executorSuiteIndex = suites.length
    suites.push({
      name: suiteName(runtime.namePrefix, ' · 执行'),
      aggregate_method: 'weighted_sum',
      parent: 0,
      caseIndexes: [cases.length - 1],
    })
    edges.push({
      fromSuiteIndex: filter.enabled ? 1 : 0,
      toSuiteIndex: executorSuiteIndex,
      event_condition: { event_type: 'CASE_COMPLETED' },
      weight: 1,
    })
  } else if (template === 'dual_direction') {
    // root（信号）+ buy/sell 双子 Suite，按 direction 等值分流
    cases.push({
      name: suiteName(runtime.namePrefix, ' · 买入'),
      node_type: 'executor',
      params: buildExecutorParams({ direction: 'buy', price: executor.price, volume: executor.volume }, 1),
    })
    suites.push({ name: suiteName(runtime.namePrefix, ' · 买入'), aggregate_method: 'weighted_sum', parent: 0, caseIndexes: [cases.length - 1] })
    cases.push({
      name: suiteName(runtime.namePrefix, ' · 卖出'),
      node_type: 'executor',
      params: buildExecutorParams({ direction: 'sell', price: executor.price, volume: executor.volume }, -1),
    })
    suites.push({ name: suiteName(runtime.namePrefix, ' · 卖出'), aggregate_method: 'weighted_sum', parent: 0, caseIndexes: [cases.length - 1] })
    edges.push(
      { fromSuiteIndex: 0, toSuiteIndex: 1, event_condition: { event_type: 'CASE_COMPLETED', op: 'eq', field: 'direction', threshold: 1 }, weight: 1 },
      { fromSuiteIndex: 0, toSuiteIndex: 2, event_condition: { event_type: 'CASE_COMPLETED', op: 'eq', field: 'direction', threshold: -1 }, weight: 1 },
    )
  }

  const symbolScope: Record<string, unknown> =
    runtime.symbolScopeType === 'all'
      ? { type: 'all' }
      : runtime.symbolScopeType === 'groups'
        ? { type: 'groups', group_ids: runtime.groupIds }
        : { type: 'symbols', symbol_codes: runtime.symbolCodes }

  // 标的范围下沉到 Case：每个 Case 的 params 携带 symbol_scope，
  // Plan 的标的集合 = 编排树内各 Case 声明的并集
  // （后端 publish_plan 会校验树内至少有一个已发布 Case 声明了标的）。
  for (const item of cases) {
    item.params = { ...item.params, symbol_scope: symbolScope }
  }

  const plan: PlanBlueprint = {
    name: suiteName(runtime.namePrefix, ''),
    trigger_type: runtime.triggerType,
    cron_expr: runtime.triggerType === 'time' ? cronForSchedule(runtime.time, runtime.weekdays) : null,
    event_type: runtime.triggerType === 'event' ? runtime.eventType : null,
    exec_mode: runtime.execMode,
    retry_policy: { max_retries: runtime.maxRetries, delay_seconds: runtime.delaySeconds },
    suite_start_mode: runtime.suiteStartMode,
  }
  if (runtime.accountId.trim() && runtime.allocatedCapital.trim()) {
    plan.account_id = runtime.accountId.trim()
    plan.allocated_capital = runtime.allocatedCapital.trim()
  }

  return { cases, suites, edges, plan }
}

/** 由 UI 星期语义（0=周一…6=周日）与 HH:MM 生成后端兼容的 5 字段 cron 表达式。 */
export function cronForSchedule(time: string, weekdays: number[]): string {
  const [hour, minute] = time.split(':').map(Number)
  const days = weekdays.length
    ? [...new Set(weekdays)].sort((a, b) => a - b).map((day) => ((day + 1) % 7)).join(',')
    : ''
  return `${minute} ${hour} * * ${days || '*'}`
}

// ---------------------------------------------------------------------------
// 一键链路（模块10 验收核心：复用既有 API 顺序编排，后端零新增接口）
// ---------------------------------------------------------------------------

export interface QuickCreatePartial {
  caseIds: number[]
  suiteIds: number[]
  planId: number | null
}

export interface QuickCreateResult {
  cases: CaseItem[]
  suites: SuiteItem[]
  plan: PlanItem
  steps: string[]
}

export class QuickCreateError extends Error {
  partial: QuickCreatePartial
  steps: string[]

  constructor(message: string, partial: QuickCreatePartial, steps: string[]) {
    super(message)
    this.name = 'QuickCreateError'
    this.partial = partial
    this.steps = steps
  }
}

export async function quickCreateStrategy(bp: QuickBlueprint): Promise<QuickCreateResult> {
  const partial: QuickCreatePartial = { caseIds: [], suiteIds: [], planId: null }
  const steps: string[] = []

  const fail = (message: string): never => {
    throw new QuickCreateError(message, partial, steps)
  }

  // 1. 创建 draft Cases
  const caseItems: CaseItem[] = []
  for (const blueprint of bp.cases) {
    try {
      const created = await strategyApi.createCase({
        name: blueprint.name,
        node_type: blueprint.node_type,
        params: blueprint.params,
      })
      caseItems.push(created.data)
      partial.caseIds.push(created.data.id)
      steps.push(`创建 Case「${blueprint.name}」`)
    } catch (cause) {
      fail(`创建 Case「${blueprint.name}」失败：${errorText(cause)}`)
    }
  }

  // 2. 创建 Suites（root 优先，子 Suite 携带 parent）
  const suiteItems: SuiteItem[] = []
  const suiteId = (index: number) => suiteItems[index].id
  for (const blueprint of bp.suites) {
    try {
      const created = await strategyApi.createSuite({
        name: blueprint.name,
        aggregate_method: blueprint.aggregate_method,
        case_ids: blueprint.caseIndexes.map((index) => caseItems[index].id),
        parent: blueprint.parent !== undefined ? suiteId(blueprint.parent) : undefined,
      })
      suiteItems.push(created.data)
      partial.suiteIds.push(created.data.id)
      steps.push(`创建 Suite「${blueprint.name}」`)
    } catch (cause) {
      fail(`创建 Suite「${blueprint.name}」失败：${errorText(cause)}`)
    }
  }

  // 3. 拓扑边（按 fromSuiteIndex 分组，分别提交到对应 Suite 的出边拓扑）
  const rootSuiteId = suiteItems[0].id
  const edgeGroups = new Map<number, typeof bp.edges>()
  for (const edge of bp.edges) {
    const group = edgeGroups.get(edge.fromSuiteIndex) ?? []
    group.push(edge)
    edgeGroups.set(edge.fromSuiteIndex, group)
  }
  for (const [fromIndex, group] of edgeGroups) {
    try {
      const edgePayload = group.map((edge) => ({
        from_suite: suiteId(edge.fromSuiteIndex),
        to_suite: suiteId(edge.toSuiteIndex),
        event_condition: edge.event_condition,
        weight: edge.weight,
      }))
      await strategyApi.updateTopology(suiteId(fromIndex), {
        case_ids: bp.suites[fromIndex].caseIndexes.map((index) => caseItems[index].id),
        edges: edgePayload,
      })
      steps.push(`写入 Suite「${suiteItems[fromIndex].name}」拓扑边`)
    } catch (cause) {
      fail(`写入 Suite 拓扑边失败：${errorText(cause)}`)
    }
  }

  // 4. 发布 Cases（Suite 发布要求全部 Case 已发布）
  for (const item of caseItems) {
    try {
      await strategyApi.publishCase(item.id)
      steps.push(`发布 Case「${item.name}」`)
    } catch (cause) {
      fail(`发布 Case「${item.name}」失败：${errorText(cause)}`)
    }
  }

  // 5. 发布 Suites（子 Suite 先发布，root 后发布）
  for (let index = suiteItems.length - 1; index >= 0; index -= 1) {
    try {
      await strategyApi.publishSuite(suiteItems[index].id)
      steps.push(`发布 Suite「${suiteItems[index].name}」`)
    } catch (cause) {
      fail(`发布 Suite「${suiteItems[index].name}」失败：${errorText(cause)}`)
    }
  }

  // 6. 创建 Plan（fail 恒抛出，catch 后 plan 必已赋值；用确定性赋值断言绕过 TS CFA 对 never 调用的限制）
  let plan!: PlanItem
  try {
    const created = await strategyApi.createPlan({
      name: bp.plan.name,
      root_suite: rootSuiteId,
      trigger_type: bp.plan.trigger_type,
      cron_expr: bp.plan.cron_expr,
      event_type: bp.plan.event_type,
      exec_mode: bp.plan.exec_mode,
      retry_policy: bp.plan.retry_policy,
      suite_start_mode: bp.plan.suite_start_mode,
      account_id: bp.plan.account_id || '',
      allocated_capital: bp.plan.allocated_capital || null,
    })
    plan = created.data
    partial.planId = plan.id
    steps.push(`创建 Plan「${plan.name}」`)
  } catch (cause) {
    fail(`创建 Plan 失败：${errorText(cause)}`)
  }

  // 7. 发布 Plan（要求根 Suite 已发布）
  try {
    await strategyApi.publishPlan(plan.id)
    steps.push(`发布 Plan「${plan.name}」`)
  } catch (cause) {
    fail(`发布 Plan「${plan.name}」失败：${errorText(cause)}`)
  }

  // 8. 可选启动（manual 触发 + auto 启动模式：发布后立即进入 running）。
  //    启动失败不回滚、不触发清理——已发布 Plan 是完整交付物，可在 Plan 管理页手动启动。
  if (bp.plan.trigger_type === 'manual' && bp.plan.suite_start_mode === 'auto') {
    try {
      await strategyApi.startPlan(plan.id)
      steps.push(`启动 Plan「${plan.name}」`)
    } catch (cause) {
      steps.push(`启动 Plan 未成功（可稍后在 Plan 管理页手动启动）：${errorText(cause)}`)
    }
  }

  return { cases: caseItems, suites: suiteItems, plan, steps }
}

/** 清理已经创建的草稿资源（按依赖逆序：Plan → 子 Suite → root Suite → Case）。 */
export async function cleanupCreated(partial: QuickCreatePartial): Promise<number> {
  let removed = 0
  if (partial.planId !== null) {
    try {
      await strategyApi.deletePlan(partial.planId)
      removed += 1
    } catch (cause) {
      console.error('清理 Plan 失败：', cause)
    }
  }
  for (const id of [...partial.suiteIds].reverse()) {
    try {
      await strategyApi.deleteSuite(id)
      removed += 1
    } catch (cause) {
      console.error('清理 Suite 失败：', cause)
    }
  }
  for (const id of partial.caseIds) {
    try {
      await strategyApi.deleteCase(id)
      removed += 1
    } catch (cause) {
      console.error('清理 Case 失败：', cause)
    }
  }
  return removed
}

function errorText(cause: unknown): string {
  if (cause && typeof cause === 'object' && 'response' in cause) {
    const data = (cause as { response?: { data?: { detail?: string } } }).response?.data
    if (data?.detail) return data.detail
  }
  return cause instanceof Error ? cause.message : String(cause)
}