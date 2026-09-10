import api from './index'
import type { GroupItem, SymbolItem, Watchlist } from '@/types/api'

export const watchlistsApi = {
  symbols(params?: Record<string, unknown>) {
    // 旧客户端默认拉取较大单页（limit 为后端分页的兼容别名）
    return api.get<SymbolItem[]>('/watchlists/symbols/', { params: { page_size: 500, ...params } })
  },
  createSymbol(data: Partial<SymbolItem>) {
    return api.post<SymbolItem>('/watchlists/symbols/', data)
  },
  updateSymbol(id: number, data: Partial<SymbolItem>) {
    return api.patch<SymbolItem>(`/watchlists/symbols/${id}/`, data)
  },
  deleteSymbol(id: number) {
    return api.delete(`/watchlists/symbols/${id}/`)
  },
  resolveSymbolName(code: string, market?: string) {
    return api.get<{ name: string }>('/watchlists/symbols/resolve-name/', {
      params: { code, market },
    })
  },
  groups(params?: Record<string, unknown>) {
    return api.get<GroupItem[]>('/watchlists/groups/', { params: { page_size: 500, ...params } })
  },
  createGroup(data: { name: string; symbol_ids?: number[] }) {
    return api.post<GroupItem>('/watchlists/groups/', data)
  },
  updateGroup(id: number, data: { name?: string; symbol_ids?: number[] }) {
    return api.patch<GroupItem>(`/watchlists/groups/${id}/`, data)
  },
  addSymbols(groupId: number, symbolIds: number[]) {
    return api.post(`/watchlists/groups/${groupId}/add-symbols/`, { symbol_ids: symbolIds })
  },
  watchlist() {
    return api.get<Watchlist>('/watchlists/watchlist/')
  },
  updateWatchlist(groupIds: number[]) {
    return api.patch<Watchlist>('/watchlists/watchlist/', { group_ids: groupIds })
  },
}
