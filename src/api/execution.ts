import api from './index'
import type { ExecutionLog, Order, SuiteRun } from '@/types/api'

export const executionApi = {
  logs(params?: Record<string, unknown>) {
    return api.get<ExecutionLog[]>('/execution/logs/', { params })
  },
  orders(params?: Record<string, unknown>) {
    return api.get<Order[]>('/execution/orders/', { params })
  },
  runs(params?: Record<string, unknown>) {
    return api.get<SuiteRun[]>('/execution/runs/', { params })
  },
  trigger(planId: number, symbols: string[], payload?: Record<string, unknown>) {
    return api.post<{ run_ids: number[] }>('/execution/trigger/', {
      plan_id: planId,
      symbols,
      payload,
    })
  },
}
