export interface SymbolItem {
  id: number
  code: string
  name: string
  market: string
  exchange?: string
}

export interface GroupItem {
  id: number
  name: string
  symbols: SymbolItem[]
}

export interface Watchlist {
  id: number
  user: number
  groups: GroupItem[]
}

export interface ExecutionLog {
  id: number
  plan: number | null
  symbol: string
  trigger_time: string
  duration_ms: number | null
  final_direction: -1 | 0 | 1
  node_snapshots: Record<string, unknown>
  error_msg: string
  status: 'success' | 'failed' | 'blocked'
}

export interface Order {
  id: number
  log: number
  symbol: string
  direction: 'buy' | 'sell'
  price: string
  volume: number
  status: 'pending' | 'sent' | 'filled' | 'rejected'
  fund_allocation?: number | null
  created_at: string
  updated_at: string
}

export interface FundAllocation {
  id: number
  level: 'plan' | 'suite' | 'case'
  plan: number
  suite: number | null
  case: number | null
  amount: string
  used_amount: string
  status: 'active' | 'released'
  created_at: string
  updated_at: string
}

export interface SuiteRun {
  id: number
  plan: number | null
  suite: number | null
  symbol: string
  status: string
  event_queue: number[]
  started_at: string | null
  ended_at: string | null
  created_at: string
}

export interface NodeRunItem {
  id: number
  run: number
  parent: number | null
  node_type: 'suite' | 'case'
  node_type_display: string
  suite: number | null
  suite_name: string | null
  case: number | null
  case_name: string | null
  symbol: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  status_display: string
  direction: -1 | 0 | 1
  result: Record<string, unknown>
  started_at: string
  ended_at: string | null
}

export interface EventItem {
  id: number
  run: number
  event_type: string
  source: string
  payload: Record<string, unknown>
  status: 'pending' | 'processing' | 'done' | 'failed'
  created_at: string
  processed_at: string | null
}

export interface TopologyEdgeItem {
  id: number
  from_suite: number
  to_suite: number
  condition: Record<string, unknown>
  event_condition: {
    event_type: string
    case_id?: number
    next_event?: string
    op?: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'between'
    field?: string
    threshold?: number | [number, number]
  }
  weight: number
}

export interface TopologyCaseItem {
  id: number
  name: string
  node_type: CaseItem['node_type']
  status: CaseItem['status']
  params: Record<string, unknown>
}

export interface TopologyPayload {
  suite: SuiteItem
  cases: TopologyCaseItem[]
  edges: TopologyEdgeItem[]
}

export interface EventTypeItem {
  name: string
  scope: 'system' | 'plugin' | 'user'
  description: string
}

export interface CaseItem {
  id: number
  name: string
  node_type: 'signal' | 'filter' | 'verdict' | 'executor'
  params: Record<string, unknown>
  version: number
  status: 'draft' | 'published' | 'archived'
  run_status: 'new' | 'running' | 'done' | 'failed'
}

export interface SuiteItem {
  id: number
  name: string
  aggregate_method: 'weighted_sum' | 'vote' | 'and' | 'or'
  status: 'draft' | 'published' | 'archived'
  run_status: 'new' | 'running' | 'done' | 'interrupt'
  version: number
  cases: number[]
  allocated_capital?: string | null
}

export type PlanPositionMode = 'both' | 'long_only' | 'short_only' | 'flat'

export interface PlanItem {
  id: number
  name: string
  root_suite: number
  trigger_type: 'time' | 'event' | 'manual'
  cron_expr: string | null
  event_type: string | null
  symbol_scope: Record<string, unknown>
  exec_mode: 'serial' | 'parallel' | 'fail_stop'
  retry_policy: Record<string, unknown>
  account_id?: string
  allocated_capital?: string | null
  available_capital?: string | null
  status: 'draft' | 'published' | 'archived'
  run_status: 'new' | 'running' | 'done' | 'interrupt'
  suite_start_mode: 'auto' | 'manual'
  version: number
  // ---- Plan 级风控限额（F1）----
  // 语义：null = 不限制（不是 0）。金额以字符串返回（Decimal 序列化，不做浮点转换）。
  risk_position_mode?: PlanPositionMode
  risk_max_order_volume?: number | null
  risk_max_order_value?: string | null
  risk_max_daily_value?: string | null
  risk_max_account_value?: string | null
  risk_max_position_value?: string | null
  risk_max_position_volume?: number | null
  /** 交易时段窗口，形如 [[9,30,11,30],[13,0,15,0]]；null = 用默认 A 股时段 */
  risk_allowed_sessions?: number[][] | null
}

export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export type AlertType = 'order_failed' | 'suite_failed' | 'plan_failed' | 'risk_violation' | 'system_error'
export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical'
export type AlertStatus = 'pending' | 'acknowledged' | 'resolved'

export interface Alert {
  id: number
  alert_type: AlertType
  alert_type_display: string
  severity: AlertSeverity
  severity_display: string
  status: AlertStatus
  status_display: string
  plan: number | null
  plan_name: string | null
  suite_run: number | null
  suite_run_display: string | null
  order: number | null
  title: string
  message: string
  error_code: string | null
  in_app_notified: boolean
  email_notified: boolean
  notification_error: string
  acknowledged_by: number | null
  acknowledged_at: string | null
  resolved_by: number | null
  resolved_at: string | null
  created_at: string
  updated_at: string
}

export type AlertChannelType = 'in_app' | 'email'

export interface AlertChannel {
  id: number
  channel_type: AlertChannelType
  channel_type_display: string
  is_enabled: boolean
  email_recipients: string[]
  email_subject_prefix: string
  min_severity: AlertSeverity
  min_severity_display: string
  alert_types: AlertType[]
  created_at: string
  updated_at: string
}

export interface AlertStatistics {
  overview: {
    total: number
    pending: number
    acknowledged: number
    resolved: number
    high_severity: number
    critical_severity: number
  }
  by_type: { alert_type: AlertType; count: number }[]
}

// ---------------------------------------------------------------------------
// N-06 运行总览（Dashboard）
// 统计口径由后端在 DB 侧聚合：比率型指标受 window_days 限制，存量/健康度取全表事实。
// 金额一律以字符串返回（Decimal 序列化，不做浮点转换）。
// ---------------------------------------------------------------------------

export interface DashboardExecution {
  window_total: number
  by_status: Record<string, number>
  settled_total: number
  /** 分母为 0 时后端返回 null（表示「无终结样本」，而非 0%） */
  success_rate: number | null
  failure_rate: number | null
  avg_duration_ms: number | null
  /** 全表事实，不受 window_days 限制 */
  active_runs: number
  running_runs: number
}

export interface DashboardIntents {
  pending: number
  /** 超过有效期、下次调度器启动会被收口为 PENDING_EXPIRED 的条数 */
  expired_candidates: number
  max_age_seconds: number
}

export interface DashboardOrders {
  window_total: number
  by_status: Record<string, number>
  by_direction: Record<string, number>
  notional_total: string | null
  notional_direction: Record<string, string>
  /** 超时未确认（可能已提交券商未回写），需人工对账 */
  unconfirmed: number
  unconfirmed_after_seconds: number
}

export interface DashboardFunds {
  configured: boolean
  total_capital?: string
  allocated_capital?: string
  available_capital?: string
  source?: string
  capital_basis?: string
  synced_at?: string | null
  is_stale?: boolean
}

export interface DashboardAlerts {
  /** 全表未处理 */
  open: number
  open_by_severity: Record<string, number>
  window_total: number
  window_by_type: Record<string, number>
  latest_at: string | null
}

export interface DashboardConfig {
  plans_published: number
  plans_by_run_status: Record<string, number>
  suites_published: number
  cases_published: number
}

export interface DashboardFreshness {
  intraday_last_at: string | null
  intraday_points: number
  symbols: number
  groups: number
}

export interface DashboardOverview {
  generated_at: string
  window_days: number
  window_start: string
  timezone: string
  execution: DashboardExecution
  intents: DashboardIntents
  orders: DashboardOrders
  funds: DashboardFunds
  alerts: DashboardAlerts
  config: DashboardConfig
  data_freshness: DashboardFreshness
}

export interface DashboardTrendPoint {
  date: string
  total: number
  completed: number
  failed: number
  stopped: number
  settled: number
  success_rate: number | null
}

export interface DashboardTrend {
  days: number
  series: DashboardTrendPoint[]
}

/** gm 账户预配置（预置 gm user id，按该 id 匹配 Plan 的资金占用） */
export type AccountCapitalBasis = 'total' | 'cash' | 'available'

export interface AccountPosition {
  symbol: string
  volume: string
  price: string | null
  market_value: string
  is_external: boolean
}

export interface AccountFundConfig {
  id: number
  account_id: string
  masked_account_id: string
  display_name: string
  remark: string
  is_active: boolean
  label: string
  total_capital: string
  source: 'manual' | 'gm'
  capital_basis: AccountCapitalBasis
  /** 按持仓结构给出的口径建议（'' 表示无建议） */
  basis_suggestion: AccountCapitalBasis | ''
  available_cash: string | null
  market_value: string | null
  frozen_cash: string | null
  synced_at: string | null
  is_stale: boolean
  position_count: number
  position_volume: string
  positions: AccountPosition[]
  position_symbols: string[]
  has_external_position: boolean
  external_position_symbols: string[]
  position_synced_at: string | null
  allocated_capital: string
  available_capital: string
}

export interface AccountSyncResult {
  account: AccountFundConfig
  sync: Record<string, unknown> & { basis_suggestion?: string }
}
