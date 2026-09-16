import api from './index'

export interface RealtimeSnapshotItem {
  symbol: {
    id: number
    code: string
    name: string
    market: string
  }
  price: string
  change: string
  volume: number
  turnover: string
  high: string
  low: string
  open_price: string
  pre_close: string
  updated_at: string
}

export interface KLineSyncLogItem {
  id: number
  symbol: {
    id: number
    code: string
    name: string
    market: string
  }
  sync_type: 'daily' | 'minute'
  start_date: string
  end_date: string
  records_added: number
  records_skipped: number
  status: 'success' | 'failed' | 'partial'
  error_msg: string
  created_at: string
}

export interface KLineQueryItem {
  symbol: string
  date: string
  open: string | number
  high: string | number
  low: string | number
  close: string | number
  volume: number
  amount: string | number | null
  extra: Record<string, unknown>
}

export const datasourcesApi = {
  snapshots(params?: Record<string, unknown>) {
    return api.get<RealtimeSnapshotItem[]>('/datasources/snapshots/', { params: { page_size: 500, ...params } })
  },
  syncLogs(params?: Record<string, unknown>) {
    return api.get<KLineSyncLogItem[]>('/datasources/sync-logs/', { params: { page_size: 500, ...params } })
  },
  queryKline(params: { symbol: string; start: string; end: string }) {
    return api.get<KLineQueryItem[]>('/datasources/kline/query/', { params: { page_size: 500, ...params } })
  },
  syncKline(data: {
    symbol: string
    sync_type?: string
    start_date?: string
    end_date?: string
    adjust?: string
  }) {
    return api.post<{ symbol: string; added: number; skipped: number; error: string | null }>('/datasources/kline/sync/', data)
  },
}
