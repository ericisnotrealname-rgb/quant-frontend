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
  /** 部署初始化：是否仍需引导（已完成则恒为 false，引导不再启用）。 */
  setupStatus() {
    return api.get<{ setup_required: boolean }>('/users/setup/status/')
  },
  /** 部署初始化：创建首个超级管理员，成功后后端已自动登录。 */
  setup(data: Record<string, string>) {
    return api.post<UserProfile>('/users/setup/', data)
  },
}
