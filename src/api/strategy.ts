import api from './index'
import type { CaseItem, PlanItem, SuiteItem } from '@/types/api'

export const strategyApi = {
  cases(params?: Record<string, unknown>) {
    return api.get<CaseItem[]>('/cases/', { params })
  },
  createCase(data: Partial<CaseItem>) {
    return api.post<CaseItem>('/cases/', data)
  },
  updateCase(id: number, data: Partial<CaseItem>) {
    return api.patch<CaseItem>(`/cases/${id}/`, data)
  },
  publishCase(id: number) {
    return api.post<CaseItem>(`/cases/${id}/publish/`)
  },
  suites(params?: Record<string, unknown>) {
    return api.get<SuiteItem[]>('/suites/', { params })
  },
  createSuite(data: Partial<SuiteItem> & { case_ids?: number[] }) {
    return api.post<SuiteItem>('/suites/', data)
  },
  updateTopology(id: number, data: { case_ids: number[]; edges: Record<string, unknown>[] }) {
    return api.post(`/suites/${id}/topology/`, data)
  },
  publishSuite(id: number) {
    return api.post<SuiteItem>(`/suites/${id}/publish/`)
  },
  plans(params?: Record<string, unknown>) {
    return api.get<PlanItem[]>('/plans/', { params })
  },
  createPlan(data: Partial<PlanItem>) {
    return api.post<PlanItem>('/plans/', data)
  },
  publishPlan(id: number) {
    return api.post<PlanItem>(`/plans/${id}/publish/`)
  },
}
