<template>
  <div class="page-container">
    <div class="page-heading">
      <div>
        <span class="eyebrow">FUNDS</span>
        <h1>资金占用管理</h1>
        <p>Plan 占用账户资金 → Suite 向 Plan 申请 → Case 向 Suite 申请，下单按 Case → Suite → Plan 逐级扣减。</p>
      </div>
      <el-button type="primary" @click="openDialog()">新增申请</el-button>
    </div>

    <el-card>
      <el-table :data="allocations" v-loading="loading" stripe>
        <el-table-column prop="level" label="层级" width="100">
          <template #default="{ row }">
            <el-tag :type="row.level === 'plan' ? 'danger' : row.level === 'suite' ? 'warning' : 'success'">
              {{ levelLabel(row.level) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="plan" label="Plan" width="90" />
        <el-table-column prop="suite" label="Suite" width="90">
          <template #default="{ row }">{{ row.suite ?? '—' }}</template>
        </el-table-column>
        <el-table-column prop="case" label="Case" width="90">
          <template #default="{ row }">{{ row.case ?? '—' }}</template>
        </el-table-column>
        <el-table-column prop="amount" label="申请额度" width="120" />
        <el-table-column label="已占用 / 剩余" min-width="160">
          <template #default="{ row }">
            <span>{{ row.used_amount }} / {{ remain(row) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'info'">{{ row.status === 'active' ? '生效中' : '已释放' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="openDialog(row)">编辑</el-button>
            <el-popconfirm title="确认删除该资金申请？" @confirm="remove(row.id)">
              <template #reference>
                <el-button size="small" type="danger" plain>删除</el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑资金申请' : '新增资金申请'" width="560px">
      <el-form :model="form" label-width="110px">
        <el-form-item label="层级" required>
          <el-radio-group v-model="form.level" :disabled="!!editingId">
            <el-radio-button value="plan">Plan 级</el-radio-button>
            <el-radio-button value="suite">Suite 级</el-radio-button>
            <el-radio-button value="case">Case 级</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="Plan" required>
          <el-select v-model="form.plan" filterable style="width: 100%">
            <el-option v-for="plan in plans" :key="plan.id" :label="`${plan.id} ${plan.name}`" :value="plan.id" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="form.level !== 'plan'" label="Suite" required>
          <el-select v-model="form.suite" filterable style="width: 100%">
            <el-option v-for="suite in suites" :key="suite.id" :label="`${suite.id} ${suite.name}`" :value="suite.id" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="form.level === 'case'" label="Case" required>
          <el-select v-model="form.case" filterable style="width: 100%">
            <el-option v-for="c in cases" :key="c.id" :label="`${c.id} ${c.name}`" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="申请额度" required>
          <el-input-number v-model="form.amount" :min="0.01" :precision="2" :controls="false" style="width: 100%" />
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
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { strategyApi } from '@/api/strategy'
import type { CaseItem, FundAllocation, PlanItem, SuiteItem } from '@/types/api'

const allocations = ref<FundAllocation[]>([])
const plans = ref<PlanItem[]>([])
const suites = ref<SuiteItem[]>([])
const cases = ref<CaseItem[]>([])
const loading = ref(false)
const saving = ref(false)
const dialogVisible = ref(false)
const editingId = ref<number | null>(null)
const form = ref({
  level: 'plan' as FundAllocation['level'],
  plan: undefined as number | undefined,
  suite: undefined as number | undefined,
  case: undefined as number | undefined,
  amount: undefined as number | undefined,
})

function levelLabel(level: string) {
  return ({ plan: 'Plan 级', suite: 'Suite 级', case: 'Case 级' } as Record<string, string>)[level] || level
}

function remain(row: FundAllocation) {
  return (Number(row.amount) - Number(row.used_amount)).toFixed(2)
}

function resetForm() {
  form.value = { level: 'plan', plan: undefined, suite: undefined, case: undefined, amount: undefined }
  editingId.value = null
}

function openDialog(row?: FundAllocation) {
  if (row) {
    editingId.value = row.id
    form.value = {
      level: row.level,
      plan: row.plan,
      suite: row.suite ?? undefined,
      case: row.case ?? undefined,
      amount: Number(row.amount),
    }
  } else {
    resetForm()
  }
  dialogVisible.value = true
}

function pickList<T>(data: unknown): T[] {
  return Array.isArray(data) ? data : (data as { results?: T[] })?.results ?? []
}

async function loadData() {
  loading.value = true
  try {
    const response = await strategyApi.fundAllocations()
    allocations.value = pickList<FundAllocation>(response.data)
  } catch (error) {
    ElMessage.error('资金申请列表加载失败')
    console.error(error)
  } finally {
    loading.value = false
  }
}

async function submitForm() {
  if (!form.value.plan || !form.value.amount) {
    ElMessage.warning('Plan 与申请额度为必填项')
    return
  }
  if (form.value.level !== 'plan' && !form.value.suite) {
    ElMessage.warning('Suite 级 / Case 级申请必须选择 Suite')
    return
  }
  if (form.value.level === 'case' && !form.value.case) {
    ElMessage.warning('Case 级申请必须选择 Case')
    return
  }
  const payload: Partial<FundAllocation> = {
    plan: form.value.plan,
    suite: form.value.level === 'plan' ? null : form.value.suite!,
    case: form.value.level === 'case' ? form.value.case! : null,
    amount: String(form.value.amount),
  }
  saving.value = true
  try {
    if (editingId.value) {
      await strategyApi.updateFundAllocation(editingId.value, payload)
      ElMessage.success('资金申请已更新')
    } else {
      await strategyApi.createFundAllocation(payload)
      ElMessage.success('资金申请已创建')
    }
    dialogVisible.value = false
    resetForm()
    await loadData()
  } catch (error: any) {
    const detail = error?.response?.data
    const message = typeof detail === 'string' ? detail
      : detail?.detail || Object.values(detail ?? {}).flat().join('；') || '保存失败'
    ElMessage.error(String(message))
    console.error(error)
  } finally {
    saving.value = false
  }
}

async function remove(id: number) {
  try {
    await strategyApi.deleteFundAllocation(id)
    ElMessage.success('删除成功')
    await loadData()
  } catch (error) {
    ElMessage.error('删除失败')
    console.error(error)
  }
}

onMounted(async () => {
  await loadData()
  const [planResponse, suiteResponse, caseResponse] = await Promise.all([
    strategyApi.plans(), strategyApi.suites(), strategyApi.cases(),
  ])
  plans.value = pickList<PlanItem>(planResponse.data)
  suites.value = pickList<SuiteItem>(suiteResponse.data)
  cases.value = pickList<CaseItem>(caseResponse.data)
})
</script>
