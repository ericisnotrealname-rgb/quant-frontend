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
