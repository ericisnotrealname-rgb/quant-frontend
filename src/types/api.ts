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
