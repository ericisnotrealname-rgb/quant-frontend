<template>
  <div class="page-container">
    <div class="page-heading">
      <div>
        <span class="eyebrow">MARKET UNIVERSE</span>
        <h1>自选池</h1>
        <p>管理策略可用的标的范围与分组。</p>
      </div>
      <el-button :loading="loading" @click="loadData">
        <el-icon><Refresh /></el-icon>刷新
      </el-button>
    </div>

    <el-alert v-if="error" :title="error" type="error" show-icon closable @close="error = ''" />

    <div class="watchlist-grid">
      <section class="panel">
        <div class="panel-header">
          <div>
            <span class="panel-kicker">GROUPS</span>
            <h2>关注分组</h2>
          </div>
          <el-tag type="info">{{ groups.length }}</el-tag>
        </div>
        <el-checkbox-group v-model="selectedGroups" class="group-list">
          <el-checkbox v-for="group in groups" :key="group.id" :value="group.id" border>
            <span>{{ group.name }}</span>
            <small>{{ group.symbols.length }} 个标的</small>
          </el-checkbox>
        </el-checkbox-group>
        <el-empty v-if="!groups.length" description="暂无分组" :image-size="72" />
        <el-button class="save-button" type="primary" :loading="saving" @click="saveWatchlist">
          保存自选配置
        </el-button>
      </section>

      <section class="panel symbols-panel">
        <div class="panel-header">
          <div>
            <span class="panel-kicker">SYMBOLS</span>
            <h2>标的目录</h2>
          </div>
          <span class="count-label">{{ filteredSymbols.length }} / {{ symbols.length }}</span>
        </div>
        <el-input v-model="search" clearable placeholder="搜索代码或名称" class="search-input">
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-table v-loading="loading" :data="filteredSymbols" height="440" stripe>
          <el-table-column prop="code" label="代码" width="130" />
          <el-table-column prop="name" label="名称" min-width="150" />
          <el-table-column prop="market" label="市场" width="100" />
          <el-table-column prop="exchange" label="交易所" width="110" />
        </el-table>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh, Search } from '@element-plus/icons-vue'
import { watchlistsApi } from '@/api/watchlists'
import type { GroupItem, SymbolItem } from '@/types/api'

const symbols = ref<SymbolItem[]>([])
const groups = ref<GroupItem[]>([])
const selectedGroups = ref<number[]>([])
const search = ref('')
const loading = ref(false)
const saving = ref(false)
const error = ref('')

const filteredSymbols = computed(() => {
  const query = search.value.trim().toLowerCase()
  if (!query) return symbols.value
  return symbols.value.filter((symbol) =>
    symbol.code.toLowerCase().includes(query) || symbol.name.toLowerCase().includes(query),
  )
})

async function loadData() {
  loading.value = true
  error.value = ''
  try {
    const [symbolResponse, groupResponse, watchlistResponse] = await Promise.all([
      watchlistsApi.symbols(),
      watchlistsApi.groups(),
      watchlistsApi.watchlist(),
    ])
    symbols.value = symbolResponse.data
    groups.value = groupResponse.data
    selectedGroups.value = watchlistResponse.data.groups.map((group) => group.id)
  } catch (cause) {
    error.value = '自选池数据加载失败，请确认后端服务已启动。'
    console.error(cause)
  } finally {
    loading.value = false
  }
}

async function saveWatchlist() {
  saving.value = true
  try {
    await watchlistsApi.updateWatchlist(selectedGroups.value)
    ElMessage.success('自选配置已保存')
  } catch (cause) {
    ElMessage.error('保存失败，请稍后重试')
    console.error(cause)
  } finally {
    saving.value = false
  }
}

onMounted(loadData)
</script>

<style scoped>
.page-container { max-width: 1280px; margin: 0 auto; }
.page-heading, .panel-header { display: flex; align-items: center; justify-content: space-between; gap: 20px; }
.page-heading { margin-bottom: 28px; }
.eyebrow, .panel-kicker { color: #d97706; font-size: 11px; font-weight: 700; letter-spacing: 1.8px; }
h1 { margin: 6px 0; color: #172033; font-size: 36px; }
h2 { margin: 4px 0 0; color: #172033; font-size: 20px; }
p { color: #667085; }
.watchlist-grid { display: grid; grid-template-columns: minmax(260px, .75fr) minmax(0, 1.5fr); gap: 20px; margin-top: 18px; }
.panel { padding: 24px; border: 1px solid #e6e8ec; border-radius: 8px; background: #fff; box-shadow: 0 10px 30px rgba(23, 32, 51, .06); }
.group-list { display: grid; gap: 10px; margin: 26px 0; }
.group-list :deep(.el-checkbox) { display: flex; justify-content: space-between; width: 100%; height: auto; min-height: 48px; margin: 0; box-sizing: border-box; }
.group-list small { color: #98a2b3; margin-left: 12px; }
.save-button { width: 100%; }
.count-label { color: #667085; font-size: 13px; }
.search-input { margin: 24px 0 14px; max-width: 360px; }
.symbols-panel :deep(.el-table) { color: #344054; }
@media (max-width: 760px) { .watchlist-grid { grid-template-columns: 1fr; } .page-heading { align-items: flex-start; } h1 { font-size: 30px; } }
</style>
