<template>
  <div class="app-layout">
    <el-container class="shell-container">
      <el-aside :width="isCollapsed ? '72px' : '220px'" class="sidebar">
        <div class="brand">
          <div class="brand-mark">Q</div>
          <span v-if="!isCollapsed">Quant Engine</span>
        </div>

        <el-menu
          :collapse="isCollapsed"
          :default-active="route.path"
          router
          class="nav-menu"
        >
          <el-menu-item index="/users">
            <el-icon><User /></el-icon>
            <template #title>用户认证</template>
          </el-menu-item>
          <el-menu-item index="/symbols">
            <el-icon><TrendCharts /></el-icon>
            <template #title>标的管理</template>
          </el-menu-item>
          <el-menu-item index="/groups">
            <el-icon><Folder /></el-icon>
            <template #title>分组管理</template>
          </el-menu-item>
          <el-menu-item index="/datasources">
            <el-icon><DataAnalysis /></el-icon>
            <template #title>数据源管理</template>
          </el-menu-item>
          <el-menu-item index="/cases">
            <el-icon><Document /></el-icon>
            <template #title>Case 管理</template>
          </el-menu-item>
          <el-menu-item index="/suites">
            <el-icon><Connection /></el-icon>
            <template #title>Suite 管理</template>
          </el-menu-item>
          <el-menu-item index="/plans">
            <el-icon><Calendar /></el-icon>
            <template #title>Plan 管理</template>
          </el-menu-item>
          <el-menu-item index="/funds">
            <el-icon><Wallet /></el-icon>
            <template #title>资金占用</template>
          </el-menu-item>
          <el-menu-item index="/execution">
            <el-icon><DataAnalysis /></el-icon>
            <template #title>执行日志</template>
          </el-menu-item>
          <el-menu-item index="/trigger">
            <el-icon><VideoPlay /></el-icon>
            <template #title>触发执行</template>
          </el-menu-item>
          <el-menu-item index="/events">
            <el-icon><Bell /></el-icon>
            <template #title>事件类型</template>
          </el-menu-item>
          <el-menu-item index="/alerts">
            <el-icon><Warning /></el-icon>
            <template #title>告警管理</template>
          </el-menu-item>
          <el-menu-item index="/alert-channels">
            <el-icon><Setting /></el-icon>
            <template #title>告警渠道</template>
          </el-menu-item>
        </el-menu>
      </el-aside>

      <el-container direction="vertical" class="content-shell">
        <el-header class="topbar">
          <div class="topbar-left">
            <el-button class="collapse-btn" circle @click="toggleCollapse">
              <el-icon><Expand v-if="isCollapsed" /><Fold v-else /></el-icon>
            </el-button>
            <div>
              <div class="page-kicker">QUANT ENGINE</div>
              <h2>{{ pageTitle }}</h2>
            </div>
          </div>

          <div class="topbar-right">
            <template v-if="auth.user">
              <el-dropdown trigger="click">
                <div class="user-badge">
                  <el-avatar :size="32" :style="{ background: '#409eff', color: '#fff' }">
                    {{ auth.user.username.slice(0, 1).toUpperCase() }}
                  </el-avatar>
                  <span>{{ auth.user.username }}</span>
                </div>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item @click="router.push('/users')">个人资料</el-dropdown-item>
                    <el-dropdown-item divided @click="handleLogout">退出登录</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </template>
            <template v-else>
              <el-button type="primary" plain @click="router.push('/login')">登录</el-button>
            </template>
          </div>
        </el-header>

        <el-main class="main-panel">
          <router-view />
        </el-main>
      </el-container>
    </el-container>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElAside, ElAvatar, ElButton, ElContainer, ElDropdown, ElDropdownItem, ElDropdownMenu, ElHeader, ElIcon, ElMain, ElMenu, ElMenuItem } from 'element-plus'
import { Bell, Calendar, Connection, DataAnalysis, Document, Expand, Folder, Fold, Setting, TrendCharts, User, VideoPlay, Wallet, Warning } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const isCollapsed = ref(false)

const pageTitle = computed(() => {
  return (route.meta.title as string) || '工作台'
})

function toggleCollapse() {
  isCollapsed.value = !isCollapsed.value
  localStorage.setItem('quant-layout-collapsed', String(isCollapsed.value))
}

async function handleLogout() {
  await auth.logout()
  await router.push('/login')
}

onMounted(() => {
  const saved = localStorage.getItem('quant-layout-collapsed')
  isCollapsed.value = saved === 'true'
})

watch(
  () => isCollapsed.value,
  (value) => {
    localStorage.setItem('quant-layout-collapsed', String(value))
  },
)
</script>

<style scoped>
.app-layout {
  height: 100vh;
  background: #f5f7fb;
}

.shell-container {
  height: 100%;
}

.sidebar {
  background: linear-gradient(180deg, #101828 0%, #0f172a 100%);
  border-right: 1px solid rgba(255, 255, 255, 0.06);
  transition: width 0.2s ease;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 64px;
  padding: 0 16px;
  color: #fff;
  font-weight: 700;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.brand-mark {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  display: grid;
  place-items: center;
  font-size: 14px;
  font-weight: 800;
}

.nav-menu {
  border-right: none;
  background: transparent;
}

.nav-menu :deep(.el-menu-item) {
  color: rgba(255, 255, 255, 0.82);
  background: transparent;
}

.nav-menu :deep(.el-menu-item.is-active) {
  color: #fff;
  background: rgba(96, 165, 250, 0.15);
}

.nav-menu :deep(.el-menu-item:hover) {
  background: rgba(255, 255, 255, 0.05);
}

.content-shell {
  min-width: 0;
}

.topbar {
  height: 72px;
  background: rgba(255, 255, 255, 0.88);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.collapse-btn {
  border: 1px solid #e5e7eb;
}

.page-kicker {
  color: #d97706;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1.6px;
}

.topbar h2 {
  margin: 4px 0 0;
  color: #111827;
  font-size: 26px;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-badge {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px;
  border: 1px solid #e5e7eb;
  background: #fff;
  border-radius: 999px;
  cursor: pointer;
}

.main-panel {
  min-height: 0;
  padding: 20px;
  overflow: auto;
}

@media (max-width: 760px) {
  .topbar {
    padding: 0 14px;
  }

  .topbar h2 {
    font-size: 20px;
  }
}
</style>
