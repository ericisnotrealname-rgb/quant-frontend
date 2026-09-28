<template>
  <div class="page-container">
    <div class="page-heading">
      <div>
        <span class="eyebrow">QUICK STRATEGY</span>
        <h1>快速创建策略</h1>
        <p>3 步生成「Case → Suite → Plan」并一键发布，复杂拓扑请使用策略设计器。</p>
      </div>
    </div>

    <el-steps :active="step" align-center finish-status="success" class="wizard-steps">
      <el-step title="模板与信号" description="选择策略形态与指标参数" />
      <el-step title="运行配置" description="标的 / 触发 / 执行方式" />
      <el-step title="预览与创建" description="确认结构并一键发布" />
    </el-steps>

    <el-alert v-if="error" :title="error" type="error" show-icon closable class="block" />

    <!-- ==================== 步骤 1：模板与信号 ==================== -->
    <div v-show="step === 0" class="step-panel">
      <section class="panel">
        <div class="panel-header">
          <div><span class="panel-kicker">TEMPLATE</span><h2>选择策略模板</h2></div>
        </div>
        <el-radio-group v-model="templateKind" class="template-grid">
          <el-radio-button v-for="item in QUICK_TEMPLATES" :key="item.kind" :value="item.kind" class="template-card">
            <div class="template-title">{{ item.label }}</div>
            <div class="template-desc">{{ item.description }}</div>
          </el-radio-button>
        </el-radio-group>
      </section>

      <section class="panel">
        <div class="panel-header">
          <div><span class="panel-kicker">SIGNAL</span><h2>信号参数</h2></div>
        </div>
        <el-form label-width="110px" class="form-grid">
          <el-form-item label="指标">
            <el-select v-model="signal.indicator" style="width: 240px">
              <el-option v-for="id in INDICATOR_IDS" :key="id" :label="INDICATOR_META[id].label" :value="id" />
            </el-select>
          </el-form-item>
          <el-form-item v-if="indicatorMeta?.needsPeriod" label="周期">
            <el-input-number v-model="signal.period" :min="1" :max="500" />
          </el-form-item>
          <template v-if="indicatorMeta?.macd">
            <el-form-item label="Fast"><el-input-number v-model="signal.fast" :min="1" :max="200" /></el-form-item>
            <el-form-item label="Slow"><el-input-number v-model="signal.slow" :min="1" :max="300" /></el-form-item>
            <el-form-item label="Signal"><el-input-number v-model="signal.signal" :min="1" :max="100" /></el-form-item>
          </template>
          <template v-if="indicatorMeta?.rsiKdj">
            <el-form-item label="超卖阈值"><el-input-number v-model="signal.thresholdOversold" :min="0" :max="100" /></el-form-item>
            <el-form-item label="超买阈值"><el-input-number v-model="signal.thresholdOverbought" :min="0" :max="100" /></el-form-item>
          </template>
          <el-form-item v-if="indicatorMeta?.singleThreshold" label="阈值">
            <el-input-number v-model="signal.threshold" :min="-1000000" :max="1000000" />
          </el-form-item>
          <el-form-item label="方向">
            <el-radio-group v-model="signal.direction">
              <el-radio-button :value="1">做多 / 买入</el-radio-button>
              <el-radio-button :value="-1">做空 / 卖出</el-radio-button>
              <el-radio-button :value="0">观望</el-radio-button>
            </el-radio-group>
          </el-form-item>
        </el-form>
      </section>

      <section v-if="templateMeta?.needsFilter" class="panel">
        <div class="panel-header">
          <div><span class="panel-kicker">FILTER</span><h2>过滤器（可选）</h2></div>
          <el-switch v-model="filter.enabled" />
        </div>
        <el-form v-if="filter.enabled" label-width="110px" class="form-grid">
          <el-form-item label="操作"><el-radio-group v-model="filter.op"><el-radio-button value="keep">保留</el-radio-button><el-radio-button value="drop">剔除</el-radio-button></el-radio-group></el-form-item>
          <el-form-item label="字段"><el-input v-model="filter.field" placeholder="如 change / volume" /></el-form-item>
          <el-form-item label="阈值"><el-input-number v-model="filter.threshold" /></el-form-item>
        </el-form>
      </section>

      <section v-if="templateMeta?.needsExecutor" class="panel">
        <div class="panel-header">
          <div><span class="panel-kicker">EXECUTOR</span><h2>执行器（订单）</h2></div>
        </div>
        <el-form label-width="110px" class="form-grid">
          <el-form-item label="方向">
            <el-radio-group v-model="executor.direction"><el-radio-button value="buy">买入</el-radio-button><el-radio-button value="sell">卖出</el-radio-button></el-radio-group>
          </el-form-item>
          <el-form-item label="价格"><el-input v-model="executor.price" placeholder="委托价（0 表示市价风险）" /></el-form-item>
          <el-form-item label="数量"><el-input-number v-model="executor.volume" :min="1" :step="100" /></el-form-item>
        </el-form>
      </section>
    </div>

    <!-- ==================== 步骤 2：运行配置 ==================== -->
    <div v-show="step === 1" class="step-panel">
      <section class="panel">
        <div class="panel-header">
          <div><span class="panel-kicker">RUNTIME</span><h2>运行配置</h2></div>
        </div>
        <el-form label-width="120px" class="form-grid">
          <el-form-item label="策略名称"><el-input v-model="runtime.namePrefix" placeholder="将作为 Case / Suite / Plan 名称前缀" /></el-form-item>

          <el-form-item label="标的范围">
            <el-radio-group v-model="runtime.symbolScopeType">
              <el-radio-button value="all">全市场</el-radio-button>
              <el-radio-button value="groups">自选分组</el-radio-button>
              <el-radio-button value="symbols">指定标的</el-radio-button>
            </el-radio-group>
          </el-form-item>
          <el-form-item v-if="runtime.symbolScopeType === 'groups'" label="分组">
            <el-select v-model="runtime.groupIds" multiple filterable placeholder="选择自选分组" style="width: 100%">
              <el-option v-for="group in groups" :key="group.id" :label="group.name" :value="group.id" />
            </el-select>
          </el-form-item>
          <el-form-item v-if="runtime.symbolScopeType === 'symbols'" label="标的">
            <el-select v-model="runtime.symbolCodes" multiple filterable placeholder="选择标的" style="width: 100%">
              <el-option v-for="symbol in symbols" :key="symbol.code" :label="`${symbol.code} ${symbol.name}`" :value="symbol.code" />
            </el-select>
          </el-form-item>

          <el-form-item label="触发方式">
            <el-radio-group v-model="runtime.triggerType">
              <el-radio-button value="manual">手动</el-radio-button>
              <el-radio-button value="time">定时</el-radio-button>
              <el-radio-button value="event">事件</el-radio-button>
            </el-radio-group>
          </el-form-item>
          <template v-if="runtime.triggerType === 'time'">
            <el-form-item label="触发时间"><el-time-picker v-model="runtime.time" format="HH:mm" value-format="HH:mm" placeholder="每日触发时间" /></el-form-item>
            <el-form-item label="执行星期">
              <el-checkbox-group v-model="runtime.weekdays">
                <el-checkbox v-for="(label, index) in WEEKDAY_LABELS" :key="index" :value="index">{{ label }}</el-checkbox>
              </el-checkbox-group>
            </el-form-item>
          </template>
          <el-form-item v-if="runtime.triggerType === 'event'" label="触发事件">
            <el-select v-model="runtime.eventType" filterable style="width: 260px">
              <el-option v-for="eventType in eventTypes" :key="eventType.name" :label="eventType.name" :value="eventType.name" />
            </el-select>
          </el-form-item>

          <el-form-item label="执行模式">
            <el-radio-group v-model="runtime.execMode">
              <el-radio-button value="serial">串行</el-radio-button>
              <el-radio-button value="parallel">并行</el-radio-button>
              <el-radio-button value="fail_stop">失败停止</el-radio-button>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="重试次数"><el-input-number v-model="runtime.maxRetries" :min="0" :max="20" /></el-form-item>
          <el-form-item label="重试延迟"><el-input-number v-model="runtime.delaySeconds" :min="0" :max="3600" /><span class="hint">秒</span></el-form-item>
          <el-form-item label="Suite 启动">
            <el-radio-group v-model="runtime.suiteStartMode">
              <el-radio-button value="auto">自动</el-radio-button>
              <el-radio-button value="manual">手动</el-radio-button>
            </el-radio-group>
          </el-form-item>

          <el-form-item label="资金账户"><el-input v-model="runtime.accountId" placeholder="可选：gm 模拟账户 ID" /></el-form-item>
          <el-form-item label="占用资金"><el-input v-model="runtime.allocatedCapital" placeholder="可选：账户级资金校验用" /></el-form-item>
        </el-form>
      </section>
    </div>

    <!-- ==================== 步骤 3：预览与一键创建 ==================== -->
    <div v-show="step === 2" class="step-panel">
      <section class="panel">
        <div class="panel-header">
          <div><span class="panel-kicker">PREVIEW</span><h2>生成结构预览</h2></div>
        </div>
        <div class="preview-tree">
          <div v-for="suiteNode in previewSuites" :key="suiteNode.index" class="suite-node">
            <div class="suite-title">
              {{ suiteNode.isRoot ? '根' : '子' }} Suite · {{ suiteNode.name }}
              <el-tag size="small" type="info">{{ suiteNode.aggregate }}</el-tag>
            </div>
            <div v-for="caseIndex in suiteNode.caseIndexes" :key="caseIndex" class="case-node">
              {{ previewCases[caseIndex].node_type }} · {{ previewCases[caseIndex].name }}
              <span class="case-params">{{ summarizeParams(previewCases[caseIndex].params) }}</span>
            </div>
            <div v-for="(edge, index) in suiteNode.outEdges" :key="index" class="edge-line">
              ↓ {{ edgeLabel(edge) }}
            </div>
          </div>
        </div>
        <div class="plan-summary">
          Plan · {{ blueprint.plan.name }}
          <el-tag size="small">{{ triggerLabel }}</el-tag>
          <el-tag size="small" type="success">{{ scopeLabel }}</el-tag>
          <el-tag size="small" type="warning">{{ execModeLabel }}</el-tag>
        </div>
      </section>

      <section v-if="result" class="panel">
        <div class="panel-header"><div><span class="panel-kicker">RESULT</span><h2>创建成功</h2></div></div>
        <el-result icon="success" :title="`策略「${result.plan.name}」已创建并发布`" sub-title="可前往 Plan 管理查看与启动">
          <template #extra>
            <el-button type="primary" @click="router.push('/plans')">前往 Plan 管理</el-button>
            <el-button @click="router.push('/designer')">在设计器中查看</el-button>
          </template>
        </el-result>
        <div class="created-list">
          <div v-for="item in result.cases" :key="item.id" class="created-row">Case #{{ item.id }} · {{ item.name }} · <el-tag size="small">{{ item.status }}</el-tag></div>
          <div v-for="item in result.suites" :key="item.id" class="created-row">Suite #{{ item.id }} · {{ item.name }} · <el-tag size="small">{{ item.status }}</el-tag></div>
          <div class="created-row">Plan #{{ result.plan.id }} · {{ result.plan.name }} · <el-tag size="small">{{ result.plan.status }}</el-tag></div>
        </div>
      </section>

      <section v-if="partial" class="panel">
        <div class="panel-header"><div><span class="panel-kicker">CLEANUP</span><h2>已创建草稿（中途失败）</h2></div></div>
        <p class="muted">以下资源已写入，可一键清理后重试，或保留草稿前往管理页编辑。</p>
        <el-button type="danger" plain :loading="cleaning" @click="handleCleanup">清理已创建草稿</el-button>
      </section>
    </div>

    <div class="wizard-actions">
      <el-button :disabled="step === 0" @click="step -= 1">上一步</el-button>
      <el-button v-if="step < 2" type="primary" :disabled="!!stepError" @click="step += 1">下一步</el-button>
      <el-button v-else type="success" :loading="creating" :disabled="!!stepError" @click="handleCreate">
        <el-icon><MagicStick /></el-icon>一键创建并发布
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { MagicStick } from '@element-plus/icons-vue'
import { executionApi } from '@/api/execution'
import { watchlistsApi } from '@/api/watchlists'
import type { EventTypeItem, GroupItem, SymbolItem } from '@/types/api'
import {
  INDICATOR_IDS,
  INDICATOR_META,
  QUICK_TEMPLATES,
  QuickCreateError,
  buildBlueprint,
  cleanupCreated,
  quickCreateStrategy,
  validateExecutorForm,
  validateFilterForm,
  validateRuntimeForm,
  validateSignalForm,
} from '@/utils/quickStrategy'
import type {
  EdgeBlueprint,
  ExecutorForm,
  FilterForm,
  QuickCreatePartial,
  QuickCreateResult,
  RuntimeForm,
  SignalForm,
  TemplateKind,
} from '@/utils/quickStrategy'

const router = useRouter()

const WEEKDAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

const step = ref(0)
const templateKind = ref<TemplateKind>('signal_only')
const creating = ref(false)
const cleaning = ref(false)
const error = ref('')
const result = ref<QuickCreateResult | null>(null)
const partial = ref<QuickCreatePartial | null>(null)

const groups = ref<GroupItem[]>([])
const symbols = ref<SymbolItem[]>([])
const eventTypes = ref<EventTypeItem[]>([])

const signal = ref<SignalForm>({
  indicator: 'rsi',
  period: 14,
  fast: 12,
  slow: 26,
  signal: 9,
  thresholdOversold: 30,
  thresholdOverbought: 70,
  threshold: null,
  direction: 1,
})
const filter = ref<FilterForm>({ enabled: false, op: 'drop', field: '', threshold: null })
const executor = ref<ExecutorForm>({ direction: 'buy', price: '', volume: 100 })
const runtime = ref<RuntimeForm>({
  namePrefix: '',
  symbolScopeType: 'all',
  groupIds: [],
  symbolCodes: [],
  triggerType: 'manual',
  time: '09:30',
  weekdays: [0, 1, 2, 3, 4],
  eventType: 'PRICE_SURGE',
  execMode: 'serial',
  maxRetries: 0,
  delaySeconds: 0,
  accountId: '',
  allocatedCapital: '',
  suiteStartMode: 'auto',
})

const templateMeta = computed(() => QUICK_TEMPLATES.find((item) => item.kind === templateKind.value))
const indicatorMeta = computed(() => INDICATOR_META[signal.value.indicator])

const stepError = computed(() => {
  if (step.value === 0) {
    return (
      validateSignalForm(signal.value)
      || (templateMeta.value?.needsFilter ? validateFilterForm(filter.value) : null)
      || (templateMeta.value?.needsExecutor ? validateExecutorForm(executor.value) : null)
    )
  }
  if (step.value === 1) return validateRuntimeForm(runtime.value)
  return null
})

const blueprint = computed(() =>
  buildBlueprint(templateKind.value, signal.value, filter.value, executor.value, runtime.value),
)

interface PreviewSuite {
  index: number
  name: string
  isRoot: boolean
  aggregate: string
  caseIndexes: number[]
  outEdges: EdgeBlueprint[]
}

const previewSuites = computed<PreviewSuite[]>(() => {
  const bp = blueprint.value
  return bp.suites.map((suite, index) => ({
    index,
    name: suite.name,
    isRoot: suite.parent === undefined,
    aggregate: suite.aggregate_method,
    caseIndexes: suite.caseIndexes,
    outEdges: bp.edges.filter((edge) => edge.fromSuiteIndex === index),
  }))
})
const previewCases = computed(() => blueprint.value.cases)

function summarizeParams(params: Record<string, unknown>): string {
  const parts: string[] = []
  if (params.indicator) parts.push(String(params.indicator))
  if (params.period) parts.push(`周期 ${params.period}`)
  if (params.fast) parts.push(`fast ${params.fast}`)
  if (params.slow) parts.push(`slow ${params.slow}`)
  if (params.threshold_oversold !== undefined) parts.push(`超卖 ${params.threshold_oversold}`)
  if (params.threshold_overbought !== undefined) parts.push(`超买 ${params.threshold_overbought}`)
  if (params.threshold !== undefined) parts.push(`阈值 ${params.threshold}`)
  if (params.order) parts.push(`订单 ${((params.order as { direction?: string }).direction ?? '')}`)
  if (params.filter) parts.push('过滤器')
  return parts.join(' · ') || '(声明式)'
}

function edgeLabel(edge: EdgeBlueprint): string {
  const cond = edge.event_condition as { event_type?: string; op?: string; field?: string; threshold?: unknown }
  if (cond.op && cond.field !== undefined) {
    return `${cond.event_type ?? ''} 且 ${cond.field} ${cond.op} ${String(cond.threshold)}`
  }
  return `事件 ${cond.event_type ?? ''}`
}

const triggerLabel = computed(() => {
  const plan = blueprint.value.plan
  if (plan.trigger_type === 'manual') return '手动触发'
  if (plan.trigger_type === 'time') return `定时 ${runtime.value.time}`
  return `事件 ${plan.event_type || ''}`
})
// 标的范围由 Case 声明（blueprint.cases[*].params.symbol_scope），从首个 Case 读取用于预览
const scopeLabel = computed(() => {
  const scope = (blueprint.value.cases[0]?.params?.symbol_scope ?? { type: 'all' }) as {
    type?: string
    group_ids?: number[]
    symbol_codes?: string[]
  }
  if (scope.type === 'all') return '全市场'
  if (scope.type === 'groups') return `分组 ×${scope.group_ids?.length ?? 0}`
  return `标的 ×${scope.symbol_codes?.length ?? 0}`
})
const execModeLabel = computed(() => {
  const labels: Record<string, string> = { serial: '串行', parallel: '并行', fail_stop: '失败停止' }
  return labels[blueprint.value.plan.exec_mode] ?? blueprint.value.plan.exec_mode
})

async function loadOptions() {
  try {
    groups.value = (await watchlistsApi.groups()).data
  } catch (cause) {
    console.error('分组加载失败：', cause)
  }
  try {
    symbols.value = (await watchlistsApi.symbols()).data
  } catch (cause) {
    console.error('标的加载失败：', cause)
  }
  try {
    eventTypes.value = (await executionApi.eventTypesAll()).data
  } catch (cause) {
    console.error('事件类型加载失败：', cause)
  }
}

async function handleCreate() {
  error.value = ''
  result.value = null
  partial.value = null
  creating.value = true
  try {
    result.value = await quickCreateStrategy(blueprint.value)
    ElMessage.success(`策略「${result.value.plan.name}」创建并发布成功`)
  } catch (cause) {
    if (cause instanceof QuickCreateError) {
      error.value = cause.message
      partial.value = cause.partial
      ElMessage.error(cause.message)
    } else {
      error.value = cause instanceof Error ? cause.message : String(cause)
      ElMessage.error(error.value)
    }
  } finally {
    creating.value = false
  }
}

async function handleCleanup() {
  if (!partial.value) return
  cleaning.value = true
  try {
    const removed = await cleanupCreated(partial.value)
    ElMessage.info(`已清理 ${removed} 个已创建资源`)
    partial.value = null
    error.value = ''
  } catch (cause) {
    ElMessage.error('清理失败，请前往管理页手动处理')
    console.error(cause)
  } finally {
    cleaning.value = false
  }
}

onMounted(loadOptions)
</script>

<style scoped>
.page-container {
  max-width: 1280px;
  margin: 0 auto;
}

.page-heading,
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.page-heading {
  margin-bottom: 22px;
}

.eyebrow,
.panel-kicker {
  color: #d97706;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1.8px;
}

h1 {
  margin: 6px 0;
  color: #172033;
  font-size: 36px;
}

h2 {
  margin: 4px 0 0;
  color: #172033;
  font-size: 20px;
}

p {
  color: #667085;
}

.wizard-steps {
  margin-bottom: 22px;
}

.block {
  margin-bottom: 16px;
}

.step-panel .panel {
  margin-bottom: 16px;
}

.panel {
  padding: 24px;
  border: 1px solid #e6e8ec;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 10px 30px rgba(23, 32, 51, 0.06);
}

.template-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  width: 100%;
}

.template-card {
  height: auto;
  min-height: 92px;
  padding: 14px 16px;
  white-space: normal;
  line-height: 1.5;
  text-align: left;
  border-radius: 8px;
}

.template-title {
  font-weight: 700;
  font-size: 15px;
  margin-bottom: 6px;
}

.template-desc {
  font-size: 12px;
  opacity: 0.85;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 0 20px;
}

.hint {
  margin-left: 8px;
  color: #98a2b3;
}

.muted {
  color: #667085;
}

.preview-tree {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.suite-node {
  border: 1px solid #e6e8ec;
  border-left: 3px solid #3b82f6;
  border-radius: 6px;
  padding: 10px 14px;
}

.suite-title {
  font-weight: 700;
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.case-node {
  padding: 4px 0 4px 12px;
  color: #475467;
  font-size: 13px;
}

.case-params {
  color: #98a2b3;
  font-size: 12px;
}

.edge-line {
  color: #f59e0b;
  font-size: 12px;
  padding-left: 12px;
}

.plan-summary {
  margin-top: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #172033;
  font-weight: 600;
}

.created-list {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.created-row {
  color: #475467;
  font-size: 13px;
}

.wizard-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 18px;
}

@media (max-width: 760px) {
  .template-grid {
    grid-template-columns: 1fr;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>)