<template>
  <div class="page-container">
    <div class="page-heading">
      <div>
        <span class="eyebrow">GROUPS</span>
        <h1>分组管理</h1>
        <p>按主题管理股票分组与其覆盖标的。</p>
      </div>
      <el-button type="primary" @click="openDialog()">新增分组</el-button>
    </div>

    <el-card>
      <el-table :data="groups" v-loading="loading" stripe>
        <el-table-column prop="name" label="分组名称" min-width="180" />
        <el-table-column label="包含标的数量" width="170">
          <template #default="{ row }">{{ row.symbols?.length ?? 0 }}</template>
        </el-table-column>
        <el-table-column label="标的列表" min-width="240">
          <template #default="{ row }">
            <div class="symbol-list">
              <el-tag v-for="symbol in row.symbols?.slice(0, 4) || []" :key="symbol.id" type="info" effect="plain">
                {{ symbol.code }}
              </el-tag>
              <span v-if="row.symbols?.length > 4">+{{ row.symbols.length - 4 }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="260" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="openDialog(row)">编辑</el-button>
            <el-button size="small" @click="openSymbolsDialog(row)">管理标的</el-button>
            <el-popconfirm title="确认删除该分组？" @confirm="remove(row.id)">
              <template #reference>
                <el-button size="small" type="danger" plain>删除</el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑分组' : '新增分组'" width="440px">
      <el-form :model="form" label-width="90px">
        <el-form-item label="分组名称" required>
          <el-input v-model="form.name" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitGroup">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="symbolDialogVisible" :title="`管理标的 - ${selectedGroupName}`" width="700px">
      <div class="symbol-manager">
        <div class="manager-column">
          <h3>当前标的</h3>
          <el-table :data="selectedSymbols" height="300" stripe>
            <el-table-column prop="code" label="代码" />
            <el-table-column prop="name" label="名称" />
            <el-table-column label="操作" width="100">
              <template #default="{ row }">
                <el-button size="small" type="danger" plain @click="removeSymbol(row.id)">移除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
        <div class="manager-column">
          <h3>新增标的</h3>
          <el-select v-model="selectedSymbolId" filterable placeholder="选择标的" style="width: 100%">
            <el-option v-for="item in allSymbols" :key="item.id" :label="`${item.code} - ${item.name}`" :value="item.id" />
          </el-select>
          <el-button class="add-button" type="primary" @click="addSymbol">添加</el-button>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { watchlistsApi } from '@/api/watchlists'
import type { GroupItem, SymbolItem } from '@/types/api'

const groups = ref<GroupItem[]>([])
const allSymbols = ref<SymbolItem[]>([])
const loading = ref(false)
const saving = ref(false)
const dialogVisible = ref(false)
const symbolDialogVisible = ref(false)
const editingId = ref<number | null>(null)
const selectedGroup = ref<GroupItem | null>(null)
const selectedSymbolId = ref<number | null>(null)
const form = ref({ name: '' })

const selectedGroupName = computed(() => selectedGroup.value?.name || '分组')
const selectedSymbols = computed(() => selectedGroup.value?.symbols || [])

async function loadData() {
  loading.value = true
  try {
    const [groupsResponse, symbolsResponse] = await Promise.all([
      watchlistsApi.groups(),
      watchlistsApi.symbols(),
    ])
    groups.value = groupsResponse.data
    allSymbols.value = symbolsResponse.data
    if (selectedGroup.value) {
      selectedGroup.value = groups.value.find((group) => group.id === selectedGroup.value?.id) || null
    }
  } catch (error) {
    ElMessage.error('分组数据加载失败')
    console.error(error)
  } finally {
    loading.value = false
  }
}

function openDialog(row?: GroupItem) {
  if (row) {
    editingId.value = row.id
    form.value = { name: row.name }
  } else {
    editingId.value = null
    form.value = { name: '' }
  }
  dialogVisible.value = true
}

async function submitGroup() {
  if (!form.value.name.trim()) {
    ElMessage.warning('分组名称不能为空')
    return
  }

  saving.value = true
  try {
    if (editingId.value) {
      await watchlistsApi.updateGroup(editingId.value, { name: form.value.name })
    } else {
      await watchlistsApi.createGroup({ name: form.value.name })
    }
    dialogVisible.value = false
    ElMessage.success('分组保存成功')
    await loadData()
  } catch (error) {
    ElMessage.error('分组保存失败')
    console.error(error)
  } finally {
    saving.value = false
  }
}

async function remove(id: number) {
  try {
    const response = await fetch(`/api/watchlists/groups/${id}/`, {
      method: 'DELETE',
      headers: { 'X-CSRFToken': document.cookie.match(/csrftoken=([^;]+)/)?.[1] || '' },
      credentials: 'same-origin',
    })
    if (!response.ok) throw new Error('delete failed')
    ElMessage.success('删除成功')
    await loadData()
  } catch (error) {
    ElMessage.error('删除失败')
    console.error(error)
  }
}

function openSymbolsDialog(row: GroupItem) {
  selectedGroup.value = row
  symbolDialogVisible.value = true
}

async function addSymbol() {
  if (!selectedGroup.value || !selectedSymbolId.value) return
  try {
    await watchlistsApi.addSymbols(selectedGroup.value.id, [selectedSymbolId.value])
    ElMessage.success('标的已加入分组')
    await loadData()
    selectedSymbolId.value = null
  } catch (error) {
    ElMessage.error('添加标的失败')
    console.error(error)
  }
}

async function removeSymbol(symbolId: number) {
  if (!selectedGroup.value) return
  try {
    const response = await fetch(`/api/watchlists/groups/${selectedGroup.value.id}/remove-symbols/`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': document.cookie.match(/csrftoken=([^;]+)/)?.[1] || '',
      },
      body: JSON.stringify({ symbol_ids: [symbolId] }),
    })
    if (!response.ok) throw new Error('remove failed')
    ElMessage.success('标的已移除')
    await loadData()
  } catch (error) {
    ElMessage.error('移除失败')
    console.error(error)
  }
}

onMounted(loadData)
</script>

<style scoped>
.page-container { max-width: 1280px; margin: 0 auto; }
.page-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 24px; }
.eyebrow { color: #d97706; font-size: 11px; font-weight: 700; letter-spacing: 1.8px; }
h1 { margin: 6px 0; color: #172033; font-size: 36px; }
p { color: #667085; }
.symbol-list { display: flex; flex-wrap: wrap; gap: 6px; }
.symbol-manager { display: grid; grid-template-columns: 1.3fr 0.7fr; gap: 16px; }
.manager-column h3 { margin: 0 0 12px; }
.add-button { width: 100%; margin-top: 12px; }
</style>
