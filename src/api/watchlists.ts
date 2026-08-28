import api from './index'
import type { GroupItem, SymbolItem, Watchlist } from '@/types/api'

export const watchlistsApi = {
  symbols(params?: Record<string, unknown>) {
    return api.get<SymbolItem[]>('/watchlists/symbols/', { params })
  },
  groups(params?: Record<string, unknown>) {
    return api.get<GroupItem[]>('/watchlists/groups/', { params })
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
