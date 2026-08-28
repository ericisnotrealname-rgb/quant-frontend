import api from './index'

export interface UserProfile {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  roles: string[]
}

export const usersApi = {
  login(username: string, password: string) {
    return api.post<UserProfile>('/users/login/', { username, password })
  },
  register(data: Record<string, string>) {
    return api.post<UserProfile>('/users/register/', data)
  },
  logout() {
    return api.post('/users/logout/')
  },
  profile() {
    return api.get<UserProfile>('/users/profile/')
  },
}
