import api from './index'
import type { DashboardOverview, DashboardTrend } from '@/types/api'

/**
 * N-06 运行总览（只读聚合）。
 *
 * 与其它列表接口不同：这两个端点返回**单对象快照**，不分页
 * （N-01：单对象/详情接口保持原结构），因此 axios 拦截器不会解包 results。
 * 统计口径全部由后端在 DB 侧聚合，前端不再拉列表自己算。
 */
export const dashboardApi = {
  overview(windowDays?: number) {
    return api.get<DashboardOverview>('/dashboard/overview/', {
      params: windowDays ? { window_days: windowDays } : undefined,
    })
  },
  executionTrend(days = 14) {
    return api.get<DashboardTrend>('/dashboard/execution-trend/', { params: { days } })
  },
}
