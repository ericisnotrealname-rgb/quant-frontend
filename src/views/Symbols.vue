<template>
  <div class="page-container">
    <div class="page-heading">
      <div>
        <span class="eyebrow">SYMBOLS</span>
        <h1>标的管理</h1>
        <p>维护全球交易标的列表并支持筛选与增删改。</p>
      </div>
      <el-button type="primary" @click="openDialog()">新增标的</el-button>
    </div>

    <el-card>
      <div class="toolbar">
        <el-input v-model="search" clearable placeholder="搜索代码或名称" style="max-width: 260px" />
        <el-select v-model="marketFilter" clearable placeholder="市场筛选" style="width: 160px">
          <el-option label="A股" value="A" />
          <el-option label="港股" value="HK" />
          <el-option label="美股" value="US" />
        </el-select>
      </div>

      <el-table :data="pagedSymbols" v-loading="loading" stripe>
        <el-table-column prop="code" label="代码" width="120" />
        <el-table-column prop="name" label="名称" min-width="180" />
        <el-table-column prop="market" label="市场" width="120">
          <template #default="{ row }">{{ marketLabel(row.market) }}</template>
        </el-table-column>
        <el-table-column prop="exchange" label="交易所" width="140" />
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="openDialog(row)">编辑</el-button>
            <el-popconfirm title="确认删除该标的？" @confirm="remove(row.id)">
              <template #reference>
                <el-button size="small" type="danger" plain>删除</el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrap">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          :total="filteredSymbols.length"
        />
      </div>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑标的' : '新增标的'" width="540px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="代码" required>
          <el-input v-model="form.code" @blur="syncNameFromCode" />
        </el-form-item>
        <el-form-item label="名称">
          <el-input v-model="form.name" placeholder="可为空，程序将按代码和市场自动补全" />
        </el-form-item>
        <el-form-item label="市场" required>
          <el-select v-model="form.market" style="width: 100%">
            <el-option label="A股" value="A" />
            <el-option label="港股" value="HK" />
            <el-option label="美股" value="US" />
          </el-select>
        </el-form-item>
        <el-form-item label="交易所">
          <el-input v-model="form.exchange" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitForm">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { watchlistsApi } from '@/api/watchlists'
import type { SymbolItem } from '@/types/api'

const symbols = ref<SymbolItem[]>([])
const search = ref('')
const marketFilter = ref('')
const loading = ref(false)
const saving = ref(false)
const dialogVisible = ref(false)
const editingId = ref<number | null>(null)
const currentPage = ref(1)
const pageSize = ref(20)

const form = ref({ code: '', name: '', market: 'A', exchange: '' })

const filteredSymbols = computed(() => {
  const q = search.value.trim().toLowerCase()
  return symbols.value.filter((item) => {
    const matchesText = !q || item.code.toLowerCase().includes(q) || item.name.toLowerCase().includes(q)
    const matchesMarket = !marketFilter.value || item.market === marketFilter.value
    return matchesText && matchesMarket
  })
})

const pagedSymbols = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredSymbols.value.slice(start, start + pageSize.value)
})

function marketLabel(value: string) {
  return { A: 'A股', HK: '港股', US: '美股' }[value] || value
}

function resetForm() {
  form.value = { code: '', name: '', market: 'A', exchange: '' }
  editingId.value = null
}

function openDialog(row?: SymbolItem) {
  if (row) {
    editingId.value = row.id
    form.value = {
      code: row.code,
      name: row.name,
      market: row.market as 'A' | 'HK' | 'US',
      exchange: row.exchange ?? '',
    }
  } else {
    resetForm()
  }
  dialogVisible.value = true
}

async function syncNameFromCode() {
  const code = form.value.code?.trim()
  if (!code || !form.value.market) return
  if (form.value.name && form.value.name.trim()) return

  try {
    const response = await watchlistsApi.resolveSymbolName(code, form.value.market)
    const resolvedName = response.data.name
    if (resolvedName) {
      form.value.name = resolvedName
    }
  } catch (error) {
    console.warn('自动填充名称失败', error)
  }
}

async function loadData() {
  loading.value = true
  try {
    const response = await watchlistsApi.symbols()
    symbols.value = response.data
  } catch (error) {
    ElMessage.error('标的列表加载失败')
    console.error(error)
  } finally {
    loading.value = false
  }
}

async function submitForm() {
  if (!form.value.code) {
    ElMessage.warning('代码不能为空')
    return
  }
  if (!form.value.name.trim()) {
    await syncNameFromCode()
  }
  if (!form.value.name.trim()) {
    ElMessage.warning('名称无法自动识别，请手动填写名称')
    return
  }

  saving.value = true
  try {
    const payload = { ...form.value }
    if (editingId.value) {
      await watchlistsApi.updateSymbol(editingId.value, payload)
    } else {
      await watchlistsApi.createSymbol(payload)
    }
    dialogVisible.value = false
    resetForm()
    ElMessage.success(editingId.value ? '标的已更新' : '新增标的成功')
    await loadData()
  } catch (error) {
    ElMessage.error('保存失败')
    console.error(error)
  } finally {
    saving.value = false
  }
}

async function remove(id: number) {
  try {
    await watchlistsApi.deleteSymbol(id)
    ElMessage.success('删除成功')
    await loadData()
  } catch (error) {
    ElMessage.error('删除失败')
    console.error(error)
  }
}

onMounted(loadData)
</script>

<style scoped>
.page-container { max-width: 1200px; margin: 0 auto; }
.page-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 24px; }
.eyebrow { color: #d97706; font-size: 11px; font-weight: 700; letter-spacing: 1.8px; }
h1 { margin: 6px 0; color: #172033; font-size: 36px; }
p { color: #667085; }
.toolbar { display: flex; gap: 12px; margin-bottom: 16px; }
.pagination-wrap { display: flex; justify-content: flex-end; margin-top: 18px; }
</style>
