<template>
  <div class="page-container">
    <div class="page-heading">
      <div>
        <span class="eyebrow">PLAN</span>
        <h1>Plan 管理</h1>
        <p>配置调度计划并管理发布状态。</p>
      </div>
      <el-button type="primary" @click="openDialog()">新增 Plan</el-button>
    </div>

    <el-card>
      <el-table :data="plans" v-loading="loading" stripe>
        <el-table-column prop="name" label="名称" min-width="180" />
        <el-table-column prop="trigger_type" label="触发类型" width="150">
          <template #default="{ row }">{{ triggerLabel(row.trigger_type) }}</template>
        </el-table-column>
        <el-table-column prop="root_suite" label="根 Suite ID" width="120" />
        <el-table-column prop="account_id" label="账户 ID" width="160">
          <template #default="{ row }">{{ row.account_id || "—" }}</template>
        </el-table-column>
        <el-table-column prop="allocated_capital" label="占用资金" width="120">
          <template #default="{ row }">{{ row.allocated_capital ?? "—" }}</template>
        </el-table-column>
        <el-table-column prop="available_capital" label="空闲资金" width="120">
          <template #default="{ row }">{{ row.available_capital ?? "—" }}</template>
        </el-table-column>
        <el-table-column label="风控限额" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <el-tag v-if="riskSummary(row) === '未设限'" type="info" size="small" effect="plain">未设限</el-tag>
            <span v-else>{{ riskSummary(row) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="suite_start_mode" label="启动模式" width="100">
          <template #default="{ row }">
            <el-tag :type="row.suite_start_mode === 'auto' ? 'success' : 'info'" size="small">
              {{ row.suite_start_mode === 'auto' ? '自动' : '手动' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="120">
          <template #default="{ row }"><el-tag :type="statusType(row.status)">{{ statusLabel(row.status) }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="run_status" label="运行状态" width="120">
          <template #default="{ row }"><el-tag :type="runStatusType(row.run_status)">{{ runStatusLabel(row.run_status) }}</el-tag></template>
        </el-table-column>
        <el-table-column label="操作" width="320" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="openDialog(row)">编辑</el-button>
            <el-button size="small" @click="publish(row.id)">发布</el-button>
            <el-button v-if="row.run_status === 'new'" size="small" type="success" @click="start(row.id)">启动</el-button>
            <el-button v-if="row.run_status === 'running'" size="small" type="warning" @click="stop(row.id)">停止</el-button>
            <el-popconfirm title="确认删除该 Plan？" @confirm="remove(row.id)">
              <template #reference>
                <el-button size="small" type="danger" plain>删除</el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑 Plan' : '新增 Plan'" width="620px">
      <el-form :model="form" label-width="120px">
        <el-form-item label="名称" required>
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="触发类型" required>
          <el-select v-model="form.trigger_type" style="width: 100%">
            <el-option label="time" value="time" />
            <el-option label="event" value="event" />
            <el-option label="manual" value="manual" />
          </el-select>
        </el-form-item>
        <el-form-item label="Cron 表达式">
          <el-input v-model="form.cron_expr" />
        </el-form-item>
        <el-form-item label="根 Suite ID" required>
          <el-input v-model.number="form.root_suite" />
        </el-form-item>
        <el-alert type="info" :closable="false" show-icon style="margin-bottom: 12px">
          标的范围已下沉到 <strong>Case</strong>：请在 Case 的 params.symbol_scope 中声明（全部标的 / 按分组 / 按标的）。
          本 Plan 覆盖的标的 = 根 Suite 编排树内各 Case 声明的<strong>并集</strong>；树内没有任何 Case 声明时无法发布。
        </el-alert>
        <el-form-item label="交易账户 ID">
          <el-input v-model="form.account_id" placeholder="gm 模拟账户 ID（留空则不绑定）" />
        </el-form-item>
        <el-form-item label="占用资金总额">
          <el-input-number v-model="form.allocated_capital" :min="0" :precision="2" :controls="false" style="width: 100%" placeholder="Plan 占用的账户资金（留空则不启用资金管控）" />
        </el-form-item>
        <el-form-item label="Suite 启动模式">
          <el-radio-group v-model="form.suite_start_mode">
            <el-radio value="manual">手动启动</el-radio>
            <el-radio value="auto">Plan 启动时自动启动</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-divider content-position="left">风控限额（留空 = 不限制）</el-divider>
        <el-alert
          type="info" :closable="false" show-icon class="risk-hint"
          title="限额随本 Plan 生效：修改后调度器热加载即生效，无需重启；时段按市场时区判定。"
        />
        <el-form-item label="持仓方向">
          <el-select v-model="form.risk_position_mode" style="width: 100%">
            <el-option label="双向（both）" value="both" />
            <el-option label="仅做多（long_only）" value="long_only" />
            <el-option label="仅做空（short_only）" value="short_only" />
            <el-option label="不开仓（flat）" value="flat" />
          </el-select>
        </el-form-item>
        <el-form-item label="单笔数量上限">
          <el-input-number v-model="form.risk_max_order_volume" :min="1" :controls="false" style="width: 100%" placeholder="留空 = 不限制" />
        </el-form-item>
        <el-form-item label="单笔金额上限">
          <el-input-number v-model="form.risk_max_order_value" :min="0.01" :precision="2" :controls="false" style="width: 100%" placeholder="留空 = 不限制" />
        </el-form-item>
        <el-form-item label="每日累计金额">
          <el-input-number v-model="form.risk_max_daily_value" :min="0.01" :precision="2" :controls="false" style="width: 100%" placeholder="按当日已挂用金额（price × volume）累计；留空 = 不限制" />
        </el-form-item>
        <el-form-item label="账户可用资金">
          <el-input-number v-model="form.risk_max_account_value" :min="0.01" :precision="2" :controls="false" style="width: 100%" placeholder="下单前校验账户可用资金；需接账户快照来源" />
        </el-form-item>
        <el-form-item label="总仓位金额">
          <el-input-number v-model="form.risk_max_position_value" :min="0.01" :precision="2" :controls="false" style="width: 100%" placeholder="留空 = 不限制" />
        </el-form-item>
        <el-form-item label="总仓位数量">
          <el-input-number v-model="form.risk_max_position_volume" :min="1" :controls="false" style="width: 100%" placeholder="留空 = 不限制" />
        </el-form-item>
        <el-form-item label="自定义交易时段">
          <el-switch v-model="form.custom_sessions" />
          <span class="risk-hint-inline">关闭时使用默认 A 股时段（09:30-11:30 / 13:00-15:00）</span>
        </el-form-item>
        <template v-if="form.custom_sessions">
          <el-form-item label="时段一">
            <el-time-picker v-model="form.session_1.start" value-format="HH:mm" format="HH:mm" style="width: 44%" placeholder="开始" />
            <span class="risk-hint-inline">至</span>
            <el-time-picker v-model="form.session_1.end" value-format="HH:mm" format="HH:mm" style="width: 44%" placeholder="结束" />
          </el-form-item>
          <el-form-item label="时段二">
            <el-time-picker v-model="form.session_2.start" value-format="HH:mm" format="HH:mm" style="width: 44%" placeholder="开始" />
            <span class="risk-hint-inline">至</span>
            <el-time-picker v-model="form.session_2.end" value-format="HH:mm" format="HH:mm" style="width: 44%" placeholder="结束" />
          </el-form-item>
        </template>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitForm">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue"
import { ElMessage } from "element-plus"
import { strategyApi } from "@/api/strategy"
import { watchlistsApi } from "@/api/watchlists"
import type { PlanItem, PlanPositionMode, GroupItem, SymbolItem } from "@/types/api"

/** 交易时段窗口（表单用 HH:mm 展示，后端存扁平 [起时,起分,止时,止分]） */
type TimeRange = { start: string; end: string }

const plans = ref<PlanItem[]>([])
const groups = ref<GroupItem[]>([])
const symbols = ref<SymbolItem[]>([])
const loading = ref(false)
const saving = ref(false)
const dialogVisible = ref(false)
const editingId = ref<number | null>(null)
/** 新建/重置时的表单默认值：所有风控限额留空 = 不限制。 */
function defaultForm() {
  return {
    name: "",
    trigger_type: "manual" as "time" | "event" | "manual",
    cron_expr: "",
    root_suite: 0,
    account_id: "",
    allocated_capital: undefined as number | undefined,
    suite_start_mode: "manual" as "auto" | "manual",
    // ---- Plan 级风控限额（F1）----
    // 语义与后端一致：留空 / null = **不限制**（不是 0）；限额会随 PlanRegistry 热加载。
    risk_position_mode: "both" as PlanPositionMode,
    risk_max_order_volume: undefined as number | undefined,
    risk_max_order_value: undefined as number | undefined,
    risk_max_daily_value: undefined as number | undefined,
    risk_max_account_value: undefined as number | undefined,
    risk_max_position_value: undefined as number | undefined,
    risk_max_position_volume: undefined as number | undefined,
    custom_sessions: false,
    session_1: { start: "09:30", end: "11:30" } as TimeRange,
    session_2: { start: "13:00", end: "15:00" } as TimeRange,
  }
}

const form = ref(defaultForm())

function toMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || "").trim())
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}

function toClock(total: number): string {
  const hours = String(Math.floor(total / 60)).padStart(2, "0")
  const minutes = String(total % 60).padStart(2, "0")
  return `${hours}:${minutes}`
}

/** 后端扁平形式 ``[起时, 起分, 止时, 止分]`` → 表单的 ``HH:mm`` 对 */
function sessionToRange(item: number[]): TimeRange | null {
  if (!Array.isArray(item) || item.length < 4) return null
  return { start: toClock(item[0] * 60 + item[1]), end: toClock(item[2] * 60 + item[3]) }
}

/** 表单 ``HH:mm`` 对 → 后端扁平形式；非法或起始不早于结束时返回 null */
function rangeToSession(range: TimeRange): number[] | null {
  const start = toMinutes(range.start)
  const end = toMinutes(range.end)
  if (start === null || end === null || start >= end) return null
  return [Math.floor(start / 60), start % 60, Math.floor(end / 60), end % 60]
}

function buildSessions(): { sessions: number[][] | null; error: string } {
  if (!form.value.custom_sessions) return { sessions: null, error: "" }
  const ranges = [form.value.session_1, form.value.session_2]
  const out: number[][] = []
  for (let i = 0; i < ranges.length; i += 1) {
    const item = rangeToSession(ranges[i])
    if (!item) {
      return { sessions: null, error: `第 ${i + 1} 个交易时段无效：需为 HH:mm 且起始早于结束` }
    }
    out.push(item)
  }
  return { sessions: out, error: "" }
}

function positionModeLabel(value: string): string {
  const map: Record<string, string> = {
    both: "双向",
    long_only: "仅做多",
    short_only: "仅做空",
    flat: "不开仓",
  }
  return map[value] || value
}

/** 列表页的风控摘要（未配置任何限额时提示"未设限"）。 */
function riskSummary(row: PlanItem): string {
  const parts: string[] = []
  if (row.risk_position_mode && row.risk_position_mode !== "both") {
    parts.push(positionModeLabel(row.risk_position_mode))
  }
  if (row.risk_max_order_value) parts.push(`单笔≤${row.risk_max_order_value}`)
  if (row.risk_max_order_volume) parts.push(`单笔量≤${row.risk_max_order_volume}`)
  if (row.risk_max_daily_value) parts.push(`每日≤${row.risk_max_daily_value}`)
  if (row.risk_max_account_value) parts.push(`账户可用≤${row.risk_max_account_value}`)
  if (row.risk_max_position_value) parts.push(`总仓位≤${row.risk_max_position_value}`)
  if (row.risk_max_position_volume) parts.push(`总仓位量≤${row.risk_max_position_volume}`)
  if (row.risk_allowed_sessions && row.risk_allowed_sessions.length) {
    parts.push(`自定义时段×${row.risk_allowed_sessions.length}`)
  }
  return parts.length ? parts.join(" / ") : "未设限"
}

function triggerLabel(value: string): string {
  const map: Record<string, string> = { time: "时间驱动", event: "事件驱动", manual: "手动触发" }
  return map[value] || value
}

function statusType(value: string): "success" | "info" | "warning" | "danger" {
  const map: Record<string, "success" | "info" | "warning" | "danger"> = { draft: "info", published: "success", archived: "warning" }
  return map[value] || "info"
}

function statusLabel(value: string): string {
  const map: Record<string, string> = { draft: "草稿", published: "已发布", archived: "已归档" }
  return map[value] || value
}

function runStatusType(value: string): "success" | "info" | "warning" | "danger" {
  const map: Record<string, "success" | "info" | "warning" | "danger"> = { new: "info", running: "warning", done: "success", interrupt: "danger" }
  return map[value] || "info"
}

function runStatusLabel(value: string): string {
  const map: Record<string, string> = { new: "新建", running: "运行中", done: "已完成", interrupt: "已中断" }
  return map[value] || value
}

function resetForm() {
  form.value = defaultForm()
  editingId.value = null
}

/** 金额字符串 → 数字（留空 = 不限制 → undefined） */
function toAmount(value?: string | null): number | undefined {
  return value == null || value === "" ? undefined : Number(value)
}

function openDialog(row?: PlanItem) {
  if (row) {
    editingId.value = row.id
    const sessions = row.risk_allowed_sessions || []
    form.value = {
      ...defaultForm(),
      name: row.name,
      trigger_type: row.trigger_type,
      cron_expr: row.cron_expr || "",
      root_suite: row.root_suite,
      account_id: row.account_id || "",
      allocated_capital: row.allocated_capital != null ? Number(row.allocated_capital) : undefined,
      suite_start_mode: row.suite_start_mode || "manual",
      risk_position_mode: row.risk_position_mode || "both",
      risk_max_order_volume: row.risk_max_order_volume ?? undefined,
      risk_max_order_value: toAmount(row.risk_max_order_value),
      risk_max_daily_value: toAmount(row.risk_max_daily_value),
      risk_max_account_value: toAmount(row.risk_max_account_value),
      risk_max_position_value: toAmount(row.risk_max_position_value),
      risk_max_position_volume: row.risk_max_position_volume ?? undefined,
      custom_sessions: sessions.length > 0,
      session_1: (sessions[0] ? sessionToRange(sessions[0]) : null) || { start: "09:30", end: "11:30" },
      session_2: (sessions[1] ? sessionToRange(sessions[1]) : null) || { start: "13:00", end: "15:00" },
    }
  } else {
    resetForm()
  }
  dialogVisible.value = true
}

async function loadData() {
  loading.value = true
  try {
    const response = await strategyApi.plans()
    plans.value = response.data
  } catch (error) {
    ElMessage.error("Plan 列表加载失败")
    console.error(error)
  } finally {
    loading.value = false
  }
}

async function submitForm() {
  if (!form.value.name.trim() || !form.value.root_suite) {
    ElMessage.warning("名称和根 Suite ID 为必填项")
    return
  }
  // 时段窗口校验（与后端同契约：HH:mm、起始早于结束）
  const { sessions, error: sessionError } = buildSessions()
  if (sessionError) {
    ElMessage.warning(sessionError)
    return
  }
  // 后端要求限额 > 0（0 会被 400 拒绝），留空才表示"不限制"
  const amountFields: [string, number | undefined][] = [
    ["单笔金额上限", form.value.risk_max_order_value],
    ["每日累计金额上限", form.value.risk_max_daily_value],
    ["账户可用资金上限", form.value.risk_max_account_value],
    ["总仓位金额上限", form.value.risk_max_position_value],
  ]
  for (const [label, value] of amountFields) {
    if (value != null && value <= 0) {
      ElMessage.warning(`${label} 必须大于 0（留空表示不限制）`)
      return
    }
  }
  const volumeFields: [string, number | undefined][] = [
    ["单笔数量上限", form.value.risk_max_order_volume],
    ["总仓位数量上限", form.value.risk_max_position_volume],
  ]
  for (const [label, value] of volumeFields) {
    if (value != null && value <= 0) {
      ElMessage.warning(`${label} 必须大于 0（留空表示不限制）`)
      return
    }
  }
  saving.value = true
  try {
    const payload = {
      name: form.value.name,
      trigger_type: form.value.trigger_type,
      cron_expr: form.value.cron_expr || null,
      root_suite: form.value.root_suite,
      // 标的范围由 Case.params.symbol_scope 声明，Plan 不再下发
      account_id: form.value.account_id.trim() || "",
      allocated_capital: form.value.allocated_capital != null ? String(form.value.allocated_capital) : null,
      suite_start_mode: form.value.suite_start_mode,
      // ---- Plan 级风控限额（F1）----
      risk_position_mode: form.value.risk_position_mode,
      risk_max_order_volume: form.value.risk_max_order_volume ?? null,
      risk_max_order_value: form.value.risk_max_order_value != null ? String(form.value.risk_max_order_value) : null,
      risk_max_daily_value: form.value.risk_max_daily_value != null ? String(form.value.risk_max_daily_value) : null,
      risk_max_account_value: form.value.risk_max_account_value != null ? String(form.value.risk_max_account_value) : null,
      risk_max_position_value: form.value.risk_max_position_value != null ? String(form.value.risk_max_position_value) : null,
      risk_max_position_volume: form.value.risk_max_position_volume ?? null,
      risk_allowed_sessions: sessions,
    }
    if (editingId.value) {
      // 编辑必须走 PATCH：此前误用 createPlan（POST）会新建一条 Plan
      await strategyApi.updatePlan(editingId.value, payload as unknown as PlanItem)
      ElMessage.success("Plan 已更新")
    } else {
      await strategyApi.createPlan(payload as unknown as PlanItem)
      ElMessage.success("Plan 已创建")
    }
    dialogVisible.value = false
    resetForm()
    await loadData()
  } catch (error) {
    ElMessage.error("保存失败")
    console.error(error)
  } finally {
    saving.value = false
  }
}

async function publish(id: number) {
  try {
    await strategyApi.publishPlan(id)
    ElMessage.success("Plan 已发布")
    await loadData()
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.detail || "发布失败")
  }
}

async function start(id: number) {
  try {
    await strategyApi.startPlan(id)
    ElMessage.success("Plan 已启动")
    await loadData()
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.detail || "启动失败")
  }
}

async function stop(id: number) {
  try {
    await strategyApi.stopPlan(id)
    ElMessage.success("Plan 已停止")
    await loadData()
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.detail || "停止失败")
  }
}

async function remove(id: number) {
  try {
    const response = await fetch(`/api/plans/${id}/`, {
      method: "DELETE",
      credentials: "same-origin",
      headers: { "X-CSRFToken": document.cookie.match(/csrftoken=([^;]+)/)?.[1] || "" },
    })
    if (!response.ok) throw new Error("delete failed")
    ElMessage.success("删除成功")
    await loadData()
  } catch (error) {
    ElMessage.error("删除失败")
    console.error(error)
  }
}

onMounted(async () => { await loadData(); const [groupResponse, symbolResponse] = await Promise.all([watchlistsApi.groups(), watchlistsApi.symbols({ limit: 500 })]); groups.value = groupResponse.data; symbols.value = symbolResponse.data })
</script>

<style scoped>
.page-container { max-width: 1280px; margin: 0 auto; }
.page-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 24px; }
.eyebrow { color: #d97706; font-size: 11px; font-weight: 700; letter-spacing: 1.8px; }
h1 { margin: 6px 0; color: #172033; font-size: 36px; }
p { color: #667085; }
.risk-hint { margin-bottom: 14px; }
.risk-hint-inline { margin-left: 8px; color: #98a2b3; font-size: 12px; }
</style>

