import api from './index'

export interface IntradayPointItem {
  ts: string
  local_time: string
  price: string
  change: string
  volume: number
  amount: string | null
  avg_price: string | null
  high: string | null
  low: string | null
  open_price: string | null
  pre_close: string | null
}

export interface IntradayRealtimeItem {
  price: string
  change: string
  volume: number
  turnover: string | null
  high: string | null
  low: string | null
  open_price: string | null
  pre_close: string | null
  updated_at: string | null
}

export type IntradaySessionStatus = 'trading' | 'lunch_break' | 'pre_market' | 'closed'

export interface IntradayStreamHandlers {
  /** 连接建立后的当日全量快照 */
  onSnapshot: (payload: IntradayPayload) => void
  /** 周期推送（默认 15s），前端按 ts 增量合并 */
  onTick: (payload: IntradayPayload) => void
  /** 交易时段状态变化（trading/lunch_break/pre_market/closed） */
  onSession?: (status: IntradaySessionStatus) => void
  /** 连接错误（EventSource 会自动重连；可用作降级轮询的信号） */
  onError?: (event: Event) => void
}

export interface IntradayStreamHandle {
  close: () => void
}

/**
 * SSE 持久化连接：GET {base}/monitoring/intraday/stream/?symbol=xxx
 * 服务端单向持续推送（snapshot → tick* → session），替代原 15s 轮询。
 */
export function subscribeIntradayStream(symbol: string, handlers: IntradayStreamHandlers): IntradayStreamHandle {
  const base = import.meta.env.VITE_API_BASE_URL ?? '/api'
  const source = new EventSource(`${base}/monitoring/intraday/stream/?symbol=${encodeURIComponent(symbol)}`)

  source.addEventListener('snapshot', (event) => {
    handlers.onSnapshot(JSON.parse((event as MessageEvent<string>).data))
  })
  source.addEventListener('tick', (event) => {
    handlers.onTick(JSON.parse((event as MessageEvent<string>).data))
  })
  source.addEventListener('session', (event) => {
    const data = JSON.parse((event as MessageEvent<string>).data) as { session_status: IntradaySessionStatus }
    handlers.onSession?.(data.session_status)
  })
  source.onerror = (event) => handlers.onError?.(event)

  return { close: () => source.close() }
}

export interface IntradayPayload {
  symbol: string
  market: string
  timezone: string
  session_status: IntradaySessionStatus
  pre_close: string | null
  points: IntradayPointItem[]
  realtime?: IntradayRealtimeItem | null
}

export const monitoringApi = {
  /** 当日分时序列（时间升序，不走分页） */
  intraday(symbol: string) {
    return api.get<IntradayPayload>('/monitoring/intraday/', { params: { symbol } })
  },
  /** 最新一条 + RealtimeSnapshot 合并 */
  realtime(symbol: string) {
    return api.get<IntradayPayload>('/monitoring/intraday/realtime/', { params: { symbol } })
  },
}