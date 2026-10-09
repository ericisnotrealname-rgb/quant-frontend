<template>
  <div class="page-container">
    <div class="page-heading">
      <div>
        <span class="eyebrow">ACCOUNTS</span>
        <h1>账户管理</h1>
        <p>预配置 gm user id，系统按该账户同步真实资金与持仓；Plan 的资金占用按账户匹配。</p>
      </div>
      <el-button type="primary" @click="openDialog()">新增账户</el-button>
    </div>

    <el-alert
      v-if="list.some((a) => a.is_stale)"
      title="存在尚未同步 gm 资金的账户"
      type="warning"
      show-icon
      :closable="false"
      description="额度可能与券商真实资产不符，请点击「立即同步」拉取最新资金。"
      class="mb"
    />

    <el-card>
      <el-table :data="list" v-loading="loading" stripe>
        <el-table-column label="账户" min-width="180">
          <template #default="{ row }">
            <div class="cell-strong">{{ row.display_name || row.masked_account_id }}</div>
            <div class="cell-sub">{{ row.masked_account_id }}</div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.is_active ? 'success' : 'info'">{{ row.is_active ? '启用' : '停用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="额度 / 空闲" min-width="170">
          <template #default="{ row }">
            <div>{{ money(row.total_capital) }}</div>
            <div class="cell-sub">空闲 {{ money(row.available_capital) }} · 已占用 {{ money(row.allocated_capital) }}</div>
          </template>
        </el-table-column>
        <el-table-column label="额度口径" width="130">
          <template #default="{ row }">
            <el-tag effect="plain">{{ basisLabel(row.capital_basis) }}</el-tag>
            <el-tooltip v-if="row.basis_suggestion && row.basis_suggestion !== row.capital_basis" placement="top">
              <template #content>该账户存在外部持仓，建议改用「账面资金」口径</template>
              <el-tag type="warning" size="small" class="ml">建议调整</el-tag>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column label="持仓" min-width="150">
          <template #default="{ row }">
            <div>{{ row.position_count }} 只 · 市值 {{ money(row.market_value) }}</div>
            <div v-if="row.has_external_position" class="cell-sub">
              含外部持仓 {{ row.external_position_symbols.length }} 只
            </div>
          </template>
        </el-table-column>
        <el-table-column label="同步时间" width="160">
          <template #default="{ row }">
            <span :class="{ 'cell-warn': row.is_stale }">{{ row.synced_at ? formatTime(row.synced_at) : '未同步' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="230" fixed="right">
          <template #default="{ row }">
            <el-button size="small" :loading="syncingId === row.id" @click="doSync(row)">立即同步</el-button>
            <el-button size="small" @click="openPositions(row)">持仓</el-button>
            <el-button size="small" @click="openDialog(row)">编辑</el-button>
            <el-popconfirm title="确认删除该账户配置？" @confirm="remove(row)">
              <template #reference><el-button size="small" type="danger">删除</el-button></template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!loading && !list.length" description="尚未预配置 gm 账户" />
    </el-card>

    <!-- 新增 / 编辑 -->
    <el-dialog v-model="dialogVisible" :title="editing ? '编辑账户' : '新增账户'" width="520px">
      <el-form :model="form" label-width="120px">
        <el-form-item label="gm user id" required>
          <el-input v-model="form.account_id" :disabled="!!editing" placeholder="掘金终端的 user id" />
          <div class="cell-sub">编辑时不可修改——Plan 已按该 id 绑定账户</div>
        </el-form-item>
        <el-form-item label="账户名称">
          <el-input v-model="form.display_name" placeholder="便于识别，如「主账户」" />
        </el-form-item>
        <el-form-item label="额度口径">
          <el-select v-model="form.capital_basis" style="width: 100%">
            <el-option label="账户总资产（账面资金 + 持仓市值）" value="total" />
            <el-option label="账面资金（忽略持仓市值）" value="cash" />
            <el-option label="券商可用资金（最保守）" value="available" />
          </el-select>
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="form.is_active" />
          <span class="cell-sub">停用后不可为 Plan 分配占用资金</span>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>

    <!-- 持仓明细 -->
    <el-dialog v-model="positionsVisible" :title="`持仓明细 · ${current?.display_name || current?.masked_account_id || ''}`" width="720px">
      <el-alert
        v-if="current?.has_external_position"
        title="该账户存在本项目未纳管的持仓"
        type="warning"
        show-icon
        :closable="false"
        :description="`外部持仓：${current.external_position_symbols.join('、')}。其市值随行情波动，建议将额度口径改为「账面资金」。`"
        class="mb"
      />
      <el-table :data="current?.positions || []" stripe size="small">
        <el-table-column prop="symbol" label="标的" min-width="130" />
        <el-table-column label="数量" width="110">
          <template #default="{ row }">{{ row.volume }}</template>
        </el-table-column>
        <el-table-column label="价格" width="110">
          <template #default="{ row }">{{ row.price ?? '—' }}</template>
        </el-table-column>
        <el-table-column label="市值" width="120">
          <template #default="{ row }">{{ money(row.market_value) }}</template>
        </el-table-column>
        <el-table-column label="归属" width="100">
          <template #default="{ row }">
            <el-tag :type="row.is_external ? 'warning' : 'success'" size="small">
              {{ row.is_external ? '外部' : '纳管' }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!current?.positions?.length" description="该账户当前无持仓" />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { executionApi } from '@/api/execution'
import type { AccountCapitalBasis, AccountFundConfig } from '@/types/api'

const list = ref<AccountFundConfig[]>([])
const loading = ref(false)
const saving = ref(false)
const syncingId = ref<number | null>(null)
const dialogVisible = ref(false)
const positionsVisible = ref(false)
const editing = ref<AccountFundConfig | null>(null)
const current = ref<AccountFundConfig | null>(null)
const form = reactive({
  account_id: '', display_name: '', remark: '',
  is_active: true, capital_basis: 'total' as AccountCapitalBasis,
})

const BASIS: Record<AccountCapitalBasis, string> = {
  total: '账户总资产', cash: '账面资金', available: '券商可用',
}
function basisLabel(v: AccountCapitalBasis) { return BASIS[v] ?? v }
function money(v: string | number | null | undefined) {
  const n = Number(v ?? 0)
  return Number.isFinite(n) ? n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'
}
function formatTime(v: string) { return new Date(v).toLocaleString('zh-CN') }

async function load() {
  loading.value = true
  try { list.value = await executionApi.accounts().then((r) => r.data) }
  catch { ElMessage.error('加载账户列表失败') }
  finally { loading.value = false }
}

function openDialog(row?: AccountFundConfig) {
  editing.value = row ?? null
  Object.assign(form, {
    account_id: row?.account_id ?? '',
    display_name: row?.display_name ?? '',
    remark: row?.remark ?? '',
    is_active: row?.is_active ?? true,
    capital_basis: row?.capital_basis ?? 'total',
  })
  dialogVisible.value = true
}

async function save() {
  if (!form.account_id.trim()) { ElMessage.warning('请填写 gm user id'); return }
  saving.value = true
  try {
    if (editing.value) await executionApi.updateAccount(editing.value.id, { ...form })
    else await executionApi.createAccount({ ...form })
    ElMessage.success('已保存')
    dialogVisible.value = false
    await load()
  } catch (e: unknown) {
    const detail = (e as { response?: { data?: Record<string, string[]> | { detail?: string } } })?.response?.data
    const msg = typeof detail?.detail === 'string' ? detail.detail : Object.values(detail ?? {}).flat()[0]
    ElMessage.error(msg || '保存失败')
  } finally { saving.value = false }
}

async function remove(row: AccountFundConfig) {
  try { await executionApi.deleteAccount(row.id); ElMessage.success('已删除'); await load() }
  catch { ElMessage.error('删除失败（若仍被 Plan 引用会失败）') }
}

async function doSync(row: AccountFundConfig) {
  syncingId.value = row.id
  try {
    const { data } = await executionApi.syncAccount(row.id)
    const suggestion = data.sync?.basis_suggestion
    ElMessage.success(suggestion
      ? '同步完成；检测到外部持仓，建议将额度口径改为「账面资金」'
      : '同步完成')
    await load()
  } catch (e: unknown) {
    const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
    ElMessage.error(detail || '同步失败（请检查 gm 通道配置）')
  } finally { syncingId.value = null }
}

function openPositions(row: AccountFundConfig) { current.value = row; positionsVisible.value = true }

onMounted(load)
</script>

<style scoped>
.cell-strong { font-weight: 600; color: #172033; }
.cell-sub { font-size: 12px; color: #8a94a6; margin-top: 2px; }
.cell-warn { color: #d97706; font-weight: 600; }
.mb { margin-bottom: 16px; }
.ml { margin-left: 6px; }
</style>
