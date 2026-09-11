import api from './index'
import type { CaseItem, FundAllocation, PlanItem, SuiteItem, TopologyPayload } from '@/types/api'

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
  suiteTopology(id: number) {
    return api.get<TopologyPayload>(`/suites/${id}/topology/`)
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
  startSuite(id: number) {
    return api.post<SuiteItem>(`/suites/${id}/start/`)
  },
  stopSuite(id: number) {
    return api.post<SuiteItem>(`/suites/${id}/stop/`)
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
  startPlan(id: number) {
    return api.post<PlanItem>(`/plans/${id}/start/`)
  },
  stopPlan(id: number) {
    return api.post<PlanItem>(`/plans/${id}/stop/`)
  },
  fundAllocations(params?: Record<string, unknown>) {
    return api.get<FundAllocation[]>('/execution/fund-allocations/', { params })
  },
  createFundAllocation(data: Partial<FundAllocation>) {
    return api.post<FundAllocation>('/execution/fund-allocations/', data)
  },
  updateFundAllocation(id: number, data: Partial<FundAllocation>) {
    return api.patch<FundAllocation>(`/execution/fund-allocations/${id}/`, data)
  },
  deleteFundAllocation(id: number) {
    return api.delete(`/execution/fund-allocations/${id}/`)
  },
}
