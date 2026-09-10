import api from './index'
import type { Alert, AlertChannel, AlertStatistics, ExecutionLog, Order, SuiteRun } from '@/types/api'

function unwrapList<T>(data: unknown): T[] {
  return Array.isArray(data) ? data : (data as { results?: T[] })?.results ?? []
}

export const executionApi = {
  logs(params?: Record<string, unknown>) {
    return api.get<ExecutionLog[]>('/execution/logs/', { params: { page_size: 500, ...params } })
  },
  orders(params?: Record<string, unknown>) {
    return api.get<Order[]>('/execution/orders/', { params: { page_size: 500, ...params } })
  },
  runs(params?: Record<string, unknown>) {
    return api.get<SuiteRun[]>('/execution/runs/', { params: { page_size: 500, ...params } })
  },
  trigger(planId: number, symbols: string[], payload?: Record<string, unknown>) {
    return api.post<{ run_ids: number[] }>('/execution/trigger/', {
      plan_id: planId,
      symbols,
      payload,
    })
  },

  // 告警
  alerts(params?: Record<string, unknown>) {
    return api.get<Alert[]>('/execution/alerts/', { params: { page_size: 500, ...params } })
  },
  alert(id: number) {
    return api.get<Alert>(`/execution/alerts/${id}/`)
  },
  alertStatistics() {
    return api.get<AlertStatistics>('/execution/alerts/statistics/')
  },
  alertAction(id: number, payload: { action: 'acknowledge' | 'resolve'; note?: string }) {
    return api.post<{ status: string; message: string }>(`/execution/alerts/${id}/actions/`, payload)
  },
  resendAlertNotifications(id: number) {
    return api.post<{ status: string; message: string }>(`/execution/alerts/${id}/resend-notifications/`)
  },

  // 告警渠道
  alertChannels() {
    return api.get<AlertChannel[]>('/execution/alert-channels/', { params: { page_size: 500 } })
  },
  createAlertChannel(payload: Partial<AlertChannel>) {
    return api.post<AlertChannel>('/execution/alert-channels/', payload)
  },
  updateAlertChannel(id: number, payload: Partial<AlertChannel>) {
    return api.patch<AlertChannel>(`/execution/alert-channels/${id}/`, payload)
  },
  deleteAlertChannel(id: number) {
    return api.delete<void>(`/execution/alert-channels/${id}/`)
  },
  reloadAlertChannels() {
    return api.post<{ status: string; message: string }>('/execution/alert-channels/reload/')
  },
}

/** 兼容列表数据（直接数组或分页结构） */
export { unwrapList }
