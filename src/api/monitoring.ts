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