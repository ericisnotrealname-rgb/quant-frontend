import api from './index'

export interface DataSourceItem {
  id: number
  name: string
  source_type: 'akshare' | 'tushare' | 'tdx' | 'yfinance'
  endpoint: string | null
  auth_info: Record<string, unknown>
  priority: number
  is_active: boolean
  created_at: string
  updated_at: string
}

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

export const datasourcesApi = {
  sources(params?: Record<string, unknown>) {
    return api.get<DataSourceItem[]>('/datasources/sources/', { params })
  },
  createSource(data: Partial<DataSourceItem> & { auth_info?: Record<string, unknown> }) {
    return api.post<DataSourceItem>('/datasources/sources/', data)
  },
  updateSource(id: number, data: Partial<DataSourceItem> & { auth_info?: Record<string, unknown> }) {
    return api.patch<DataSourceItem>(`/datasources/sources/${id}/`, data)
  },
  deleteSource(id: number) {
    return api.delete(`/datasources/sources/${id}/`)
  },
  snapshots(params?: Record<string, unknown>) {
    return api.get<RealtimeSnapshotItem[]>('/datasources/snapshots/', { params })
  },
  syncLogs(params?: Record<string, unknown>) {
    return api.get<KLineSyncLogItem[]>('/datasources/sync-logs/', { params })
  },
  queryKline(params: { symbol: string; start: string; end: string }) {
    return api.get('/datasources/kline/query/', { params })
  },
  syncKline(data: Record<string, unknown>) {
    return api.post('/datasources/kline/sync/', data)
  },
}
