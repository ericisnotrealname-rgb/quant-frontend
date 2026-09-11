<template>
<div class="designer-page">
    <div class="page-heading">
      <div><span class="eyebrow">SUITE CANVAS</span><h1>策略设计器</h1><p>拖拽编排 Case 与子 Suite，配置边条件，并回放执行轨迹。</p></div>
      <div class="heading-actions">
        <el-select v-model="selectedSuiteId" filterable placeholder="选择 Suite" style="width: 220px" :loading="suitesLoading" @change="onSuiteChange">
          <el-option v-for="suite in suites" :key="suite.id" :label="suiteOptionLabel(suite)" :value="suite.id" />
        </el-select>
        <el-button :loading="topologyLoading" @click="loadTopology"><el-icon><Refresh /></el-icon>刷新</el-button>
        <el-button type="primary" :loading="saving" :disabled="!selectedSuiteId" @click="saveTopology">保存拓扑</el-button>
        <el-button type="success" plain :disabled="!selectedSuiteId" @click="publishSuite">发布</el-button>
        <el-button type="warning" plain :disabled="!selectedSuiteId" @click="replayVisible = true"><el-icon><VideoPlay /></el-icon>执行轨迹回放</el-button>
        <el-tag v-if="dirty" type="danger" effect="plain">未保存</el-tag>
      </div>
    </div>
    <el-alert v-if="loadError" :title="loadError" type="error" show-icon class="error-alert" />
    <div class="designer-body">
      <aside class="palette">
        <div class="palette-title">节点面板</div>
        <div v-for="item in paletteItems" :key="item.key" class="palette-item" draggable="true" @dragstart="onPaletteDragStart($event, item)">
          <span class="palette-dot" :class="item.key" /><div><div class="palette-name">{{ item.label }}</div><div class="palette-desc">{{ item.description }}</div></div>
        </div>
        <el-divider />
        <div class="palette-title">连线说明</div>
        <div class="legend-line"><span class="legend-edge membership" />根 Suite → Case（成员边）</div>
        <div class="legend-line"><span class="legend-edge orchestration" />根 Suite → 子 Suite（编排边，双击配置）</div>
        <p class="palette-tip">从面板拖拽节点到画布；从根 Suite 右侧锚点拖出连线。选中后按 Backspace 删除。</p>
      </aside>
<div class="canvas-wrap" @drop="onDrop" @dragover.prevent>
        <el-empty v-if="!selectedSuiteId" description="请选择一个 Suite 开始编排" class="canvas-empty" />
        <VueFlow v-else v-model:nodes="flowNodes" v-model:edges="flowEdges" class="flow-canvas" :min-zoom="0.2" :max-zoom="2" :delete-key-code="['Backspace', 'Delete']"
          @connect="onConnect" @node-click="onNodeClick" @edge-double-click="onEdgeDoubleClick" @nodes-change="onNodesChange" @edges-change="onEdgesChange">
          <Background :gap="18" pattern-color="#cbd5e1" />
          <Controls />
          <MiniMap pannable zoomable />
          <template #node-case="{ id, data }">
            <div class="flow-node case-node" :class="['type-' + data.nodeType, data.runStatus ? 'run-' + data.runStatus : '']">
              <Handle type="target" :position="Position.Left" class="node-handle" />
              <div class="node-tag">{{ nodeTypeLabel(data.nodeType) }}</div>
              <div class="node-title" :title="data.label">{{ data.label }}</div>
              <div class="node-sub"><span>{{ data.status === 'published' ? '已发布' : '草稿' }}</span><span v-if="data.runStatus" class="run-badge" :class="['run-' + data.runStatus]">{{ runStatusLabel(data.runStatus) }}</span></div>
              <button class="node-remove" title="移出编排" @click.stop="removeCanvasNode(id)">×</button>
            </div>
          </template>
          <template #node-suite="{ id, data }">
            <div class="flow-node suite-node" :class="[data.isRoot ? 'root' : '', data.runStatus ? 'run-' + data.runStatus : '']">
              <Handle v-if="!data.isRoot" type="target" :position="Position.Left" class="node-handle" />
              <Handle type="source" :position="Position.Right" class="node-handle" />
              <div class="node-tag">{{ data.isRoot ? '根 Suite' : '子 Suite' }}</div>
              <div class="node-title" :title="data.label">{{ data.label }}</div>
              <div class="node-sub"><span>{{ aggregateLabel(data.aggregateMethod) }}</span><span v-if="data.runStatus" class="run-badge" :class="['run-' + data.runStatus]">{{ runStatusLabel(data.runStatus) }}</span></div>
              <button v-if="!data.isRoot" class="node-remove" title="移出编排" @click.stop="removeCanvasNode(id)">×</button>
            </div>
          </template>
        </VueFlow>
      </div>
    </div>
<el-dialog v-model="edgeDialogVisible" title="编排边条件" width="560px" :close-on-click-modal="false">
      <el-form label-width="110px">
        <el-form-item label="目标 Suite"><el-tag>{{ edgeForm.targetLabel }}</el-tag></el-form-item>
        <el-form-item label="触发事件" required>
          <el-select v-model="edgeForm.eventType" filterable allow-create placeholder="选择或输入事件类型">
            <el-option v-for="eventType in eventTypes" :key="eventType.name" :label="eventType.name" :value="eventType.name">{{ eventType.name }}<small class="option-desc">{{ eventType.description }}</small></el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="来源 Case ID"><el-input-number v-model="edgeForm.caseId" :min="1" controls-position="right" style="width: 200px" /><span class="form-hint">可选</span></el-form-item>
        <el-form-item label="后续事件"><el-input v-model="edgeForm.nextEvent" placeholder="例如 CASE_COMPLETED" /></el-form-item>
        <el-divider />
        <el-form-item label="条件操作符"><el-switch v-model="edgeForm.useOperator" active-text="启用" /><span class="form-hint">对事件 payload 字段数值比较（op+field+threshold 成组）</span></el-form-item>
        <template v-if="edgeForm.useOperator">
          <el-form-item label="操作符"><el-select v-model="edgeForm.op" style="width: 160px"><el-option v-for="op in OPERATOR_OPTIONS" :key="op.value" :label="op.label" :value="op.value" /></el-select></el-form-item>
          <el-form-item label="字段名"><el-input v-model="edgeForm.field" placeholder="例如 direction" style="width: 220px" /></el-form-item>
          <el-form-item label="阈值">
            <template v-if="edgeForm.op === 'between'"><el-input-number v-model="edgeForm.thresholdLow" controls-position="right" style="width: 130px" /><span class="form-hint">~</span><el-input-number v-model="edgeForm.thresholdHigh" controls-position="right" style="width: 130px" /></template>
            <el-input-number v-else v-model="edgeForm.threshold" controls-position="right" style="width: 200px" />
          </el-form-item>
        </template>
        <el-divider />
        <el-form-item label="边权重" required><el-input-number v-model="edgeForm.weight" :min="0.1" :max="1000" :step="0.1" controls-position="right" /><span class="form-hint">0&lt;权重≤1000</span></el-form-item>
      </el-form>
      <template #footer><el-button v-if="edgeForm.isEditing" type="danger" plain @click="removeEdge(edgeForm.edgeId)">删除连线</el-button><el-button @click="cancelEdgeDialog">取消</el-button><el-button type="primary" @click="saveEdgeDialog">保存</el-button></template>
    </el-dialog>
    <el-dialog v-model="casePickerVisible" :title="'选择「' + nodeTypeLabel(casePickerType) + '」Case'" width="560px">
      <el-table :data="casePickerList" v-loading="casePickerLoading" height="300" stripe @row-click="onCasePicked">
        <el-table-column prop="id" label="ID" width="70" /><el-table-column prop="name" label="名称" min-width="180" />
        <el-table-column prop="status" label="状态" width="110"><template #default="{ row }"><el-tag :type="row.status === 'published' ? 'success' : 'info'" size="small">{{ row.status === 'published' ? '已发布' : '草稿' }}</el-tag></template></el-table-column>
      </el-table>
      <p class="picker-hint">点击行加入画布（成员边自动建立）</p>
    </el-dialog>
    <el-dialog v-model="suitePickerVisible" title="选择子 Suite" width="560px">
      <el-table :data="suitePickerList" v-loading="suitePickerLoading" height="300" stripe @row-click="onSuitePicked">
        <el-table-column prop="id" label="ID" width="70" /><el-table-column prop="name" label="名称" min-width="150" />
        <el-table-column prop="aggregate_method" label="聚合方式" width="120"><template #default="{ row }">{{ aggregateLabel(row.aggregate_method) }}</template></el-table-column>
        <el-table-column prop="status" label="状态" width="110"><template #default="{ row }"><el-tag :type="row.status === 'published' ? 'success' : 'info'" size="small">{{ row.status === 'published' ? '已发布' : '草稿' }}</el-tag></template></el-table-column>
      </el-table>
      <p class="picker-hint">点击行确认；加入后从根 Suite 拖出连线建立编排边</p>
    </el-dialog>
<el-drawer v-model="nodeDrawerVisible" :title="nodeDrawerTitle" size="420px">
      <template v-if="drawerNode">
        <el-descriptions :column="1" border size="small"><el-descriptions-item v-for="(entry, idx) in drawerDescriptions" :key="idx" :label="entry.label">{{ entry.value }}</el-descriptions-item></el-descriptions>
        <template v-if="drawerNode.params !== undefined"><div class="drawer-section-title">params</div><pre class="json-box">{{ prettyJson(drawerNode.params) }}</pre></template>
      </template>
    </el-drawer>
    <el-drawer v-model="replayVisible" title="执行轨迹回放" size="500px" @opened="onReplayOpened" @closed="resetReplay">
      <div class="replay-body">
        <el-select v-model="replayRunId" placeholder="选择 SuiteRun" filterable @change="loadReplayRun">
          <el-option v-for="run in replayRuns" :key="run.id" :label="replayOptionLabel(run)" :value="run.id" />
        </el-select>
        <div v-if="replayRunId" v-loading="replayLoading" class="replay-panel">
          <div class="replay-controls">
            <el-button-group>
              <el-button :disabled="!canReplay || stepIndex === 0" @click="stepTo(stepIndex - 1)">上一步</el-button>
              <el-button :type="playing ? 'warning' : 'primary'" :disabled="!canReplay" @click="togglePlay">{{ playing ? '暂停' : '播放' }}</el-button>
              <el-button :disabled="!canReplay || stepIndex >= timeline.length" @click="stepTo(stepIndex + 1)">下一步</el-button>
            </el-button-group>
            <el-button :disabled="!canReplay" @click="stepTo(0)">重置</el-button>
            <span v-if="canReplay" class="step-progress">步骤 {{ stepIndex }} / {{ timeline.length }}</span>
          </div>
          <el-slider v-if="canReplay" :model-value="stepIndex" :min="0" :max="timeline.length" :step="1" @update:model-value="onSliderChange" />
          <div v-if="currentStep" class="current-step"><el-tag size="small" :type="currentStepTagType">{{ currentStep.kindLabel }}</el-tag><span class="step-text">{{ currentStep.label }}</span><span class="step-time">{{ formatTime(currentStep.time) }}</span></div>
          <div v-if="failedRuns.length" class="replay-section-title">失败节点定位</div>
          <div v-for="failed in failedRuns" :key="failed.id" class="failed-row"><span class="failed-name">{{ failed.name }}</span><el-button size="small" type="danger" plain @click="locateNodeRun(failed)">定位</el-button></div>
          <div class="replay-section-title">事件流</div>
          <div class="event-log">
            <div v-for="entry in visibleTimeline" :key="entry.key" class="event-entry" :class="{ current: entry.stepIndex === stepIndex }">
              <span class="entry-time">{{ formatTime(entry.time) }}</span><el-tag size="small" :type="entry.kind === 'event' ? 'warning' : 'info'">{{ entry.kindLabel }}</el-tag><span class="entry-label">{{ entry.label }}</span>
            </div>
            <el-empty v-if="!timeline.length" description="本次运行暂无轨迹" :image-size="60" />
          </div>
        </div>
        <el-empty v-else description="选择一次运行开始回放" :image-size="72" />
      </div>
    </el-drawer>
  </div>
</template>
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, VideoPlay } from '@element-plus/icons-vue'
import { VueFlow, Handle, Position, MarkerType, useVueFlow } from '@vue-flow/core'
import type { Connection, Edge, EdgeMouseEvent, Node, NodeChange, EdgeChange, NodeMouseEvent } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import '@vue-flow/minimap/dist/style.css'
import { strategyApi } from '@/api/strategy'
import { executionApi } from '@/api/execution'
import type { SuiteItem, TopologyPayload, NodeRunItem, EventItem, EventTypeItem } from '@/types/api'

interface CanvasNodeData { kind: 'case' | 'suite'; refId: number; label: string; nodeType?: string; status?: string; aggregateMethod?: string; isRoot?: boolean; params?: Record<string, unknown>; runStatus?: string | null }
interface PaletteItem { key: string; kind: 'case' | 'suite'; label: string; description: string; caseType?: string }
interface ReplayStep { key: string; stepIndex: number; time: string; kind: 'event' | 'node-start' | 'node-end'; kindLabel: string; label: string; nodeRunId?: number }
interface SuiteRunItem { id: number; symbol: string; status: string; created_at: string }

const OPERATOR_OPTIONS = [
  { value: 'eq', label: 'eq（等于）' }, { value: 'neq', label: 'neq（不等于）' },
  { value: 'gt', label: 'gt（大于）' }, { value: 'gte', label: 'gte（≥）' },
  { value: 'lt', label: 'lt（小于）' }, { value: 'lte', label: 'lte（≤）' },
  { value: 'between', label: 'between（区间）' },
] as const
type OperatorValue = (typeof OPERATOR_OPTIONS)[number]['value']

const NODE_TYPE_LABELS: Record<string, string> = { signal: '信号节点', filter: '过滤器', verdict: '裁决节点', executor: '执行器' }
const AGGREGATE_LABELS: Record<string, string> = { weighted_sum: '加权求和', vote: '投票', and: '逻辑与', or: '逻辑或' }
const RUN_STATUS_LABELS: Record<string, string> = { pending: '待执行', running: '执行中', completed: '已完成', failed: '失败', skipped: '已跳过' }

const route = useRoute()
const { addEdges, addNodes, findNode, fitView, project, removeEdges } = useVueFlow()

const suites = ref<SuiteItem[]>([])
const suitesLoading = ref(false)
const selectedSuiteId = ref<number | null>(null)
const topologyLoading = ref(false)
const saving = ref(false)
const dirty = ref(false)
const loadError = ref('')
const rootSuiteId = ref<number | null>(null)
const flowNodes = ref<Node[]>([])
const flowEdges = ref<Edge[]>([])
const eventTypes = ref<EventTypeItem[]>([])
const nodeDrawerVisible = ref(false)
const nodeDrawerTitle = ref('')
const drawerNode = ref<{ title: string; params: Record<string, unknown> | undefined } | null>(null)
const drawerDescriptions = ref<{ label: string; value: string | number }[]>([])

const paletteItems: PaletteItem[] = [
  { key: 'signal', kind: 'case', caseType: 'signal', label: '信号节点', description: 'signal · 技术指标信号' },
  { key: 'filter', kind: 'case', caseType: 'filter', label: '过滤器', description: 'filter · 条件过滤' },
  { key: 'verdict', kind: 'case', caseType: 'verdict', label: '裁决节点', description: 'verdict · 综合裁决' },
  { key: 'executor', kind: 'case', caseType: 'executor', label: '执行器', description: 'executor · 生成委托单' },
  { key: 'child-suite', kind: 'suite', label: '子 Suite', description: '递归执行的编排子树' },
]

interface EdgeFormState { edgeId: string; targetLabel: string; isEditing: boolean; eventType: string; caseId: number | null; nextEvent: string; useOperator: boolean; op: OperatorValue; field: string; threshold: number; thresholdLow: number; thresholdHigh: number; weight: number }

const edgeDialogVisible = ref(false)
const edgeForm = ref<EdgeFormState>({ edgeId: '', targetLabel: '', isEditing: false, eventType: 'CASE_COMPLETED', caseId: null, nextEvent: '', useOperator: false, op: 'gte', field: '', threshold: 0, thresholdLow: 0, thresholdHigh: 100, weight: 1 })

let pendingDropPosition: { x: number; y: number } | null = null
let pendingCaseType: string | null = null

const casePickerVisible = ref(false)
const casePickerLoading = ref(false)
const casePickerType = ref('')
const casePickerList = ref<{ id: number; name: string; status: string }[]>([])

const suitePickerVisible = ref(false)
const suitePickerLoading = ref(false)
const suitePickerList = ref<SuiteItem[]>([])

const replayVisible = ref(false)
const replayRuns = ref<SuiteRunItem[]>([])
const replayRunId = ref<number | null>(null)
const replayLoading = ref(false)
const replayNodeRuns = ref<NodeRunItem[]>([])
const playing = ref(false)
const stepIndex = ref(0)
const timeline = ref<ReplayStep[]>([])
const nodeRunStepIndex = ref(new Map<number, { start: number; end: number | null }>())
let replayTimer: ReturnType<typeof setInterval> | null = null

// Helper: break Vue Flow store generic recursion on assignment
// (flowNodes / flowEdges setter type is deeply recursive; cast through plain arrays)
function setFlowNodes(nodes: Node[]) { flowNodes.value = nodes as unknown as typeof flowNodes.value }
function setFlowEdges(edges: Edge[]) { flowEdges.value = edges as unknown as typeof flowEdges.value }
function flowNodesPlain() { return flowNodes.value as Node[] }
function flowEdgesPlain() { return flowEdges.value as Edge[] }
function suiteOptionLabel(suite: { id: number; name: string }) {
  return '#' + suite.id + ' ' + suite.name
}
function replayOptionLabel(run: SuiteRunItem) {
  return '#' + run.id + ' · ' + run.symbol + ' · ' + runStatusText(run.status)
}
const PRIORITY: Record<ReplayStep['kind'], number> = { 'node-start': 0, event: 1, 'node-end': 2 }

const nodeRunCanvasId = computed(() => {
  const map = new Map<number, string>()
  for (const nodeRun of replayNodeRuns.value) {
    if (nodeRun.node_type === 'suite' && nodeRun.suite != null && findNode(suiteNodeId(nodeRun.suite))) map.set(nodeRun.id, suiteNodeId(nodeRun.suite))
    else if (nodeRun.node_type === 'case' && nodeRun.case != null && findNode(caseNodeId(nodeRun.case))) map.set(nodeRun.id, caseNodeId(nodeRun.case))
  }
  return map
})

const canReplay = computed(() => timeline.value.length > 0)
const currentStep = computed(() => timeline.value.find((step) => step.stepIndex === stepIndex.value) ?? null)
const currentStepTagType = computed(() => {
  const step = currentStep.value
  if (!step) return 'info' as const
  if (step.kind === 'event') return 'warning' as const
  if (step.kind === 'node-end') return step.label.includes('失败') ? ('danger' as const) : ('success' as const)
  return 'primary' as const
})
const visibleTimeline = computed(() => timeline.value.slice(0, stepIndex.value + 1))
const failedRuns = computed(() => replayNodeRuns.value.filter((nr) => nr.status === 'failed').map((nr) => ({ id: nr.id, name: nodeRunName(nr) + (nr.result?.error ? ` · ${String(nr.result.error)}` : '') })))

function markDirty() { dirty.value = true }
function onNodesChange(changes: NodeChange[]) { if (changes.some((c) => c.type === 'add' || c.type === 'remove')) markDirty() }
function onEdgesChange(changes: EdgeChange[]) { if (changes.some((c) => c.type === 'add' || c.type === 'remove')) markDirty() }

function onSuiteChange() {
  stopReplayPlayback()
  replayRunId.value = null
  replayRuns.value = []
  replayNodeRuns.value = []
  timeline.value = []
  void loadTopology()
}

function nodeTypeLabel(value?: string) { return NODE_TYPE_LABELS[value ?? ''] ?? value ?? '节点' }
function aggregateLabel(value?: string) { return AGGREGATE_LABELS[value ?? ''] ?? value ?? '—' }
function runStatusLabel(value?: string | null) { return RUN_STATUS_LABELS[value ?? ''] ?? value ?? '' }
function runStatusText(value: string) { return ({ pending: '待启动', running: '运行中', completed: '已完成', failed: '失败', stopped: '已停止' } as Record<string, string>)[value] ?? value }
function formatTime(iso?: string | null) { if (!iso) return '—'; return iso.length >= 19 ? iso.slice(11, 19) : iso }
function prettyJson(value: unknown) { try { return JSON.stringify(value, null, 2) } catch { return String(value) } }
function caseNodeId(id: number) { return `case-${id}` }
function suiteNodeId(id: number) { return 'suite-' + id }

async function loadSuites() {
  suitesLoading.value = true
  try { suites.value = (await strategyApi.suites()).data } catch (error) { ElMessage.error('Suite 列表加载失败'); console.error(error) } finally { suitesLoading.value = false }
}

async function loadTopology() {
  if (!selectedSuiteId.value) return
  topologyLoading.value = true
  loadError.value = ''
  try {
    const response = await strategyApi.suiteTopology(selectedSuiteId.value)
    renderTopology(response.data)
    dirty.value = false
  } catch (error) { loadError.value = '拓扑数据加载失败，请确认后端服务已启动'; console.error(error) } finally { topologyLoading.value = false }
}

function renderTopology(payload: TopologyPayload) {
  const previousPositions = currentPositions()
  const suite = payload.suite
  rootSuiteId.value = suite.id
  selectedSuiteId.value = suite.id
  const nodes: Node[] = []
  const edges: Edge[] = []
  nodes.push({ id: suiteNodeId(suite.id), type: 'suite', position: previousPositions.get(suiteNodeId(suite.id)) ?? { x: 40, y: 260 }, data: { kind: 'suite', refId: suite.id, label: suite.name, aggregateMethod: suite.aggregate_method, status: suite.status, isRoot: true, runStatus: null } as CanvasNodeData })
  payload.cases.forEach((item, index) => {
    nodes.push({ id: caseNodeId(item.id), type: 'case', position: previousPositions.get(caseNodeId(item.id)) ?? { x: 430, y: 40 + index * 130 }, data: { kind: 'case', refId: item.id, label: item.name, nodeType: item.node_type, status: item.status, params: item.params, runStatus: null } as CanvasNodeData })
    edges.push({ id: `member-${item.id}`, source: suiteNodeId(suite.id), target: caseNodeId(item.id), type: 'smoothstep', style: { stroke: '#94a3b8', strokeWidth: 1.5, strokeDasharray: '5 3' }, data: { kind: 'membership', caseId: item.id } })
  })
  const targetIds = [...new Set(payload.edges.map((edge) => edge.to_suite))]
  targetIds.forEach((suiteId, index) => {
    nodes.push({ id: suiteNodeId(suiteId), type: 'suite', position: previousPositions.get(suiteNodeId(suiteId)) ?? { x: 850, y: 40 + index * 170 }, data: { kind: 'suite', refId: suiteId, label: `Suite #${suiteId}`, aggregateMethod: '', status: '', isRoot: false, runStatus: null } as CanvasNodeData })
  })
  payload.edges.forEach((edge) => {
    edges.push({ id: `orchestra-${edge.id}`, source: suiteNodeId(edge.from_suite), target: suiteNodeId(edge.to_suite), type: 'smoothstep', markerEnd: MarkerType.ArrowClosed, style: { stroke: '#3b82f6', strokeWidth: 2 }, label: edgeLabel(edge.event_condition, edge.weight), data: { kind: 'orchestration', dbEdgeId: edge.id, toSuiteId: edge.to_suite, condition: edge.condition ?? {}, event_condition: edge.event_condition ?? { event_type: 'CASE_COMPLETED' }, weight: edge.weight } })
  })
  flowNodes.value = nodes
  flowEdges.value = edges
  void nextTick(async () => { await nextTick(); void fitView({ padding: 0.15, duration: 300 }) })
  void loadChildSuiteInfo(targetIds)
}

async function loadChildSuiteInfo(suiteIds: number[]) {
  const nodeMap = flowNodes.value
  const results = await Promise.allSettled(suiteIds.map(async (id) => ({ id, data: (await strategyApi.suites()).data.find((s) => s.id === id) })))
  for (const result of results) {
    if (result.status !== 'fulfilled' || !result.value.data) continue
    const { id, data } = result.value
    const targetId = 'suite-' + id
    let matchNode: Record<string, unknown> | undefined
    for (let i = 0; i < nodeMap.length; i++) { const n = nodeMap[i] as Record<string, unknown>; if (String(n.id) === targetId) { matchNode = n; break } }
    const node = matchNode as Node | undefined
    if (node?.data) node.data = { ...node.data, label: data.name, aggregateMethod: data.aggregate_method, status: data.status }
  }
}

function edgeLabel(eventCondition: TopologyPayload['edges'][number]['event_condition'], weight: number) {
  const parts = [eventCondition?.event_type || 'CASE_COMPLETED']
  if (eventCondition?.op && eventCondition.field) parts.push(`${eventCondition.field} ${eventCondition.op} ${Array.isArray(eventCondition.threshold) ? eventCondition.threshold.join('~') : eventCondition.threshold}`)
  parts.push(`w=${weight}`)
  return parts.join(' · ')
}

function currentPositions() {
  const map = new Map<string, { x: number; y: number }>()
  for (const node of flowNodes.value) map.set(node.id, { x: node.position.x, y: node.position.y })
  return map
}

function onConnect(connection: Connection) {
  const sourceNode = findNode(connection.source)
  const targetNode = findNode(connection.target)
  if (!sourceNode || !targetNode) return
  const sourceData = sourceNode.data as CanvasNodeData
  const targetData = targetNode.data as CanvasNodeData
  if (connection.source === connection.target) { ElMessage.warning('不能连接到自身'); return }
  if (!sourceData.isRoot) { ElMessage.warning('只允许从根 Suite 拖出连线'); return }
  if (targetData.kind === 'case') {
    const exists = flowEdgesPlain().some((edge) => edge.data?.kind === 'membership' && edge.target === connection.target)
    if (exists) { ElMessage.warning('该 Case 已在编排中'); return }
    addEdges([{ ...connection, id: `member-new-${Date.now()}`, type: 'smoothstep', style: { stroke: '#94a3b8', strokeWidth: 1.5, strokeDasharray: '5 3' }, data: { kind: 'membership', caseId: targetData.refId } }])
    markDirty()
    return
  }
  if (targetData.kind === 'suite' && !targetData.isRoot) {
    const exists = flowEdges.value.some((edge) => edge.data?.kind === 'orchestration' && edge.target === connection.target)
    if (exists) { ElMessage.warning('到该子 Suite 的编排边已存在，可双击边修改'); return }
    const edgeId = `orchestra-new-${Date.now()}`
    addEdges([{ ...connection, id: edgeId, type: 'smoothstep', markerEnd: MarkerType.ArrowClosed, style: { stroke: '#3b82f6', strokeWidth: 2 }, label: 'CASE_COMPLETED · w=1', data: { kind: 'orchestration', dbEdgeId: null, toSuiteId: targetData.refId, condition: {}, event_condition: { event_type: 'CASE_COMPLETED' }, weight: 1 } }])
    markDirty()
    openEdgeDialog(edgeId, false)
    return
  }
  ElMessage.warning('不允许该连线方向（仅支持根 Suite → Case / 子 Suite）')
}

function onNodeClick({ node }: NodeMouseEvent) {
  const data = node.data as CanvasNodeData
  drawerNode.value = { title: data.kind === 'case' ? `Case 节点 · ${data.label}` : `${data.isRoot ? '根 Suite' : '子 Suite'} · ${data.label}`, params: data.params }
  if (data.kind === 'case') {
    drawerDescriptions.value = [{ label: 'Case ID', value: data.refId }, { label: '节点类型', value: nodeTypeLabel(data.nodeType) }, { label: '状态', value: data.status === 'published' ? '已发布' : '草稿' }]
  } else {
    drawerDescriptions.value = [{ label: 'Suite ID', value: data.refId }, { label: '聚合方式', value: aggregateLabel(data.aggregateMethod) }, { label: '状态', value: data.isRoot ? (data.status === 'published' ? '已发布' : '草稿') : '—' }]
  }
  nodeDrawerVisible.value = true
}

function onEdgeDoubleClick({ edge }: EdgeMouseEvent) {
  if ((edge.data as { kind?: string } | undefined)?.kind !== 'orchestration') { ElMessage.info('成员边由 Case 编排自动维护，无需配置'); return }
  openEdgeDialog(edge.id, true)
}

function removeCanvasNode(nodeId: string) {
  const nodes = flowNodes.value as Node[]
  const edges = flowEdges.value as Edge[]
  setFlowNodes(nodes.filter((node) => node.id !== nodeId))
  setFlowEdges(edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId))
  markDirty()
}

async function saveTopology() {
  if (!rootSuiteId.value) return
  const nodes = flowNodesPlain()
  const caseIds = nodes.filter((node) => node.type === 'case').map((node) => (node.data as CanvasNodeData).refId)
  const edges = flowEdgesPlain().filter((edge) => (edge.data as { kind?: string } | undefined)?.kind === 'orchestration').map((edge) => {
    const data = edge.data as { toSuiteId: number; condition: Record<string, unknown>; event_condition: Record<string, unknown>; weight: number }
    return { from_suite: rootSuiteId.value as number, to_suite: data.toSuiteId, condition: data.condition ?? {}, event_condition: data.event_condition, weight: data.weight }
  })
  saving.value = true
  try {
    await strategyApi.updateTopology(rootSuiteId.value, { case_ids: caseIds, edges })
    ElMessage.success('拓扑已保存')
    await loadTopology()
  } catch (error) {
    const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail
    ElMessage.error(detail || '拓扑保存失败')
    console.error(error)
  } finally { saving.value = false }
}

async function publishSuite() {
  if (!selectedSuiteId.value) return
  try { await ElMessageBox.confirm('发布前会递归校验所有子节点已发布，并生成不可变拓扑快照。确认发布？', '发布 Suite', { confirmButtonText: '发布', cancelButtonText: '取消', type: 'warning' }) } catch { return }
  saving.value = true
  try {
    await strategyApi.publishSuite(selectedSuiteId.value)
    ElMessage.success('Suite 已发布')
    await loadTopology()
  } catch (error) {
    const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail
    ElMessage.error(detail || '发布失败')
    console.error(error)
  } finally { saving.value = false }
}

function openEdgeDialog(edgeId: string, isEditing: boolean) {
  const edge = flowEdgesPlain().find((item) => item.id === edgeId)
  if (!edge) return
  const data = edge.data as { event_condition?: { event_type: string; case_id?: number; next_event?: string; op?: OperatorValue; field?: string; threshold?: number | [number, number] }; weight?: number }
  const condition = data.event_condition ?? { event_type: 'CASE_COMPLETED' }
  const threshold = Array.isArray(condition.threshold) ? condition.threshold : [0, 100]
  const targetNode = findNode(edge.target)
  edgeForm.value = { edgeId, targetLabel: (targetNode?.data as CanvasNodeData | undefined)?.label ?? edge.target, isEditing, eventType: condition.event_type || 'CASE_COMPLETED', caseId: condition.case_id ?? null, nextEvent: condition.next_event ?? '', useOperator: Boolean(condition.op), op: condition.op ?? 'gte', field: condition.field ?? '', threshold: Array.isArray(condition.threshold) ? 0 : (condition.threshold as number | undefined) ?? 0, thresholdLow: threshold[0], thresholdHigh: threshold[1], weight: data.weight ?? 1 }
  edgeDialogVisible.value = true
}

function buildEventCondition(form: EdgeFormState): Record<string, unknown> {
  const condition: Record<string, unknown> = { event_type: form.eventType.trim() }
  if (form.caseId != null) condition.case_id = form.caseId
  if (form.nextEvent.trim()) condition.next_event = form.nextEvent.trim()
  if (form.useOperator) { condition.op = form.op; condition.field = form.field.trim(); condition.threshold = form.op === 'between' ? [form.thresholdLow, form.thresholdHigh] : form.threshold }
  return condition
}

function validateEdgeForm(form: EdgeFormState): string | null {
  if (!form.eventType.trim()) return '触发事件必填'
  if (form.useOperator) { if (!form.field.trim()) return '启用条件操作符时，字段名必填'; if (form.op === 'between' && form.thresholdLow > form.thresholdHigh) return 'between 的低边界不能大于高边界' }
  if (!(form.weight > 0) || form.weight > 1000) return '边权重必须大于 0 且不超过 1000'
  return null
}

function saveEdgeDialog() {
  const form = edgeForm.value
  const error = validateEdgeForm(form)
  if (error) { ElMessage.warning(error); return }
  const edge = flowEdgesPlain().find((item) => item.id === form.edgeId)
  if (!edge) return
  const eventCondition = buildEventCondition(form)
  edge.data = { ...(edge.data as Record<string, unknown>), kind: 'orchestration', event_condition: eventCondition, weight: form.weight }
  edge.label = edgeLabel(eventCondition as TopologyPayload['edges'][number]['event_condition'], form.weight)
  markDirty()
  edgeDialogVisible.value = false
  ElMessage.success('边条件已更新（需保存拓扑生效）')
}

function cancelEdgeDialog() {
  const form = edgeForm.value
  if (!form.isEditing && form.edgeId) { const edge = flowEdgesPlain().find((item) => item.id === form.edgeId); if (edge) removeEdges([edge.id]) }
  edgeDialogVisible.value = false
}

function removeEdge(edgeId: string) {
  const edge = flowEdgesPlain().find((item) => item.id === edgeId)
  if (edge) removeEdges([edge.id])
  markDirty()
  edgeDialogVisible.value = false
  ElMessage.success('连线已删除（需保存拓扑生效）')
}

function onPaletteDragStart(event: DragEvent, item: PaletteItem) {
  event.dataTransfer?.setData('application/canvas-node', JSON.stringify(item))
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

function onDrop(event: DragEvent) {
  if (!selectedSuiteId.value || !rootSuiteId.value) return
  const raw = event.dataTransfer?.getData('application/canvas-node')
  if (!raw) return
  let item: PaletteItem
  try { item = JSON.parse(raw) as PaletteItem } catch { return }
  const canvasEl = (event.currentTarget as HTMLElement).querySelector('.flow-canvas') as HTMLElement | null
  const bounds = (canvasEl ?? (event.currentTarget as HTMLElement)).getBoundingClientRect()
  pendingDropPosition = project({ x: event.clientX - bounds.left, y: event.clientY - bounds.top })
  if (item.kind === 'case' && item.caseType) { pendingCaseType = item.caseType; casePickerType.value = item.caseType; casePickerVisible.value = true; void loadCasePicker(item.caseType) }
  else { suitePickerVisible.value = true; void loadSuitePicker() }
}

async function loadCasePicker(nodeType: string) {
  casePickerLoading.value = true
  try {
    const list = (await strategyApi.cases({ node_type: nodeType })).data
    const onCanvas = new Set(flowNodesPlain().filter((node) => node.type === 'case').map((node) => (node.data as CanvasNodeData).refId))
    casePickerList.value = list.filter((item) => item.node_type === nodeType && !onCanvas.has(item.id)).map((item) => ({ id: item.id, name: item.name, status: item.status }))
  } catch (error) { ElMessage.error('Case 列表加载失败'); console.error(error) } finally { casePickerLoading.value = false }
}

async function loadSuitePicker() {
  suitePickerLoading.value = true
  try {
    const list = (await strategyApi.suites()).data
    const onCanvas = new Set(flowNodesPlain().filter((node) => node.type === 'suite').map((node) => (node.data as CanvasNodeData).refId))
    suitePickerList.value = list.filter((item) => item.id !== rootSuiteId.value && !onCanvas.has(item.id))
  } catch (error) { ElMessage.error('Suite 列表加载失败'); console.error(error) } finally { suitePickerLoading.value = false }
}

function onCasePicked(row: { id: number; name: string; status: string }) {
  if (!rootSuiteId.value || !pendingDropPosition) return
  const id = caseNodeId(row.id)
  if (findNode(id)) { ElMessage.warning('该 Case 已在画布中'); return }
  addNodes([{ id, type: 'case', position: { ...pendingDropPosition }, data: { kind: 'case', refId: row.id, label: row.name, nodeType: pendingCaseType ?? 'signal', status: row.status, params: {}, runStatus: null } as CanvasNodeData }])
  addEdges([{ id: `member-new-${Date.now()}`, source: suiteNodeId(rootSuiteId.value), target: id, type: 'smoothstep', style: { stroke: '#94a3b8', strokeWidth: 1.5, strokeDasharray: '5 3' }, data: { kind: 'membership', caseId: row.id } }])
  markDirty()
  casePickerVisible.value = false
  ElMessage.success(`已加入 Case「${row.name}」，记得保存拓扑`)
}

function onSuitePicked(row: SuiteItem) {
  if (!pendingDropPosition) return
  const id = suiteNodeId(row.id)
  if (findNode(id)) { ElMessage.warning('该 Suite 已在画布中'); return }
  addNodes([{ id, type: 'suite', position: { ...pendingDropPosition }, data: { kind: 'suite', refId: row.id, label: row.name, aggregateMethod: row.aggregate_method, status: row.status, isRoot: false, runStatus: null } as CanvasNodeData }])
  markDirty()
  suitePickerVisible.value = false
  ElMessage.success('已加入子 Suite，请从根 Suite 拖出连线建立编排边')
}

async function loadReplayRuns() {
  if (!selectedSuiteId.value) return
  try { const response = await executionApi.runs({ suite: selectedSuiteId.value }); replayRuns.value = response.data } catch (error) { ElMessage.error('运行记录加载失败'); console.error(error) }
}

async function loadReplayRun() {
  if (!replayRunId.value) return
  replayLoading.value = true
  try {
    stopReplayPlayback()
    const [nodeRunResponse, eventResponse] = await Promise.all([executionApi.runNodeRuns(replayRunId.value), executionApi.events({ run: replayRunId.value })])
    const nodeRuns = Array.isArray(nodeRunResponse.data) ? nodeRunResponse.data : []
    const events = Array.isArray(eventResponse.data) ? eventResponse.data : []
    replayNodeRuns.value = nodeRuns
    buildTimeline(nodeRuns, events)
    stepIndex.value = 0
    applyStep()
  } catch (error) { ElMessage.error('轨迹数据加载失败'); console.error(error) } finally { replayLoading.value = false }
}

function buildTimeline(nodeRuns: NodeRunItem[], events: EventItem[]) {
  const steps: ReplayStep[] = []
  const stepIndexByNodeRun = new Map<number, { start: number; end: number | null }>()
  for (const nodeRun of nodeRuns) { steps.push({ key: 'node-start-' + nodeRun.id, stepIndex: 0, time: nodeRun.started_at, kind: 'node-start', kindLabel: '节点开始', label: nodeRunName(nodeRun) + ' 开始执行', nodeRunId: nodeRun.id }) }
  for (const event of events) { steps.push({ key: 'event-' + event.id, stepIndex: 0, time: event.created_at, kind: 'event', kindLabel: event.event_type, label: event.event_type + '（' + (event.status === 'failed' ? '处理失败' : '已处理') + '）' }) }
  for (const nodeRun of nodeRuns) { if (!nodeRun.ended_at) continue; steps.push({ key: 'node-end-' + nodeRun.id, stepIndex: 0, time: nodeRun.ended_at, kind: 'node-end', kindLabel: '节点结束', label: nodeRunName(nodeRun) + ' → ' + runStatusLabel(nodeRun.status), nodeRunId: nodeRun.id }) }
  steps.sort((a, b) => { const d = new Date(a.time).getTime() - new Date(b.time).getTime(); if (d !== 0) return d; return PRIORITY[a.kind] - PRIORITY[b.kind] })
  steps.forEach((step, index) => {
    step.stepIndex = index + 1
    if (step.nodeRunId != null) {
      const meta = stepIndexByNodeRun.get(step.nodeRunId) ?? { start: index + 1, end: null as number | null }
      if (step.kind === 'node-start') meta.start = index + 1
      if (step.kind === 'node-end') meta.end = index + 1
      stepIndexByNodeRun.set(step.nodeRunId, meta)
    }
  })
  timeline.value = steps
  nodeRunStepIndex.value = stepIndexByNodeRun
}

function nodeRunName(nodeRun: NodeRunItem) { return nodeRun.node_type === 'suite' ? 'Suite ' + (nodeRun.suite_name ?? nodeRun.suite ?? '') : 'Case ' + (nodeRun.case_name ?? nodeRun.case ?? '') }

function nodeRunStateAt(nodeRunId: number, index: number): string {
  const meta = nodeRunStepIndex.value.get(nodeRunId)
  if (!meta) return 'pending'
  const nodeRun = replayNodeRuns.value.find((item) => item.id === nodeRunId)
  if (meta.end != null && index >= meta.end) return nodeRun?.status ?? 'completed'
  if (index >= meta.start) return 'running'
  return 'pending'
}

function applyStep() {
  const index = stepIndex.value
  const runStatusByNode = new Map<string, string>()
  for (const nodeRunId of nodeRunStepIndex.value.keys()) {
    const canvasId = nodeRunCanvasId.value.get(nodeRunId)
    if (canvasId) runStatusByNode.set(canvasId, nodeRunStateAt(nodeRunId, index))
  }
  setFlowNodes(flowNodesPlain().map((node) => {
    const runStatus = runStatusByNode.get(node.id) ?? null
    if ((node.data as CanvasNodeData).runStatus === runStatus) return node
    return { ...node, data: { ...node.data, runStatus } }
  }))
}

function togglePlay() {
  if (playing.value) { stopReplayPlayback(); return }
  playing.value = true
  replayTimer = setInterval(() => { if (stepIndex.value >= timeline.value.length) { stopReplayPlayback(); return } stepIndex.value += 1; applyStep() }, 900)
}

function stopReplayPlayback() { if (replayTimer) { clearInterval(replayTimer); replayTimer = null } playing.value = false }

function stepTo(index: number) { stopReplayPlayback(); stepIndex.value = Math.max(0, Math.min(timeline.value.length, index)); applyStep() }
function onSliderChange(value: number | number[]) { stopReplayPlayback(); stepIndex.value = Math.max(0, Math.min(timeline.value.length, Number(value))); applyStep() }
function resetReplay() { stopReplayPlayback(); stepIndex.value = 0; applyStep() }

function locateNodeRun(failed: { id: number; name: string }) {
  const canvasId = nodeRunCanvasId.value.get(failed.id)
  if (!canvasId) { ElMessage.info('该节点不在当前画布（子 Suite 内部节点），请切换到对应 Suite 查看'); return }
  const node = findNode(canvasId)
  if (!node) return
  node.selected = true
  void fitView({ nodes: [canvasId], duration: 400, padding: 0.6, maxZoom: 1.4 })
}

async function onReplayOpened() {
  replayRunId.value = null
  await loadReplayRuns()
  if (replayRuns.value[0]) { replayRunId.value = replayRuns.value[0].id; await loadReplayRun() }
}

async function init() {
  await loadSuites()
  const querySuite = Number(route.query.suite)
  if (querySuite && suites.value.some((suite) => suite.id === querySuite)) selectedSuiteId.value = querySuite
  if (!selectedSuiteId.value && suites.value[0]) selectedSuiteId.value = suites.value[0].id
  if (selectedSuiteId.value) await Promise.all([loadTopology(), loadReplayRuns()])
  try { eventTypes.value = (await executionApi.eventTypesAll()).data } catch (error) { console.warn('事件类型列表加载失败', error) }
}

onMounted(init)
onBeforeUnmount(() => stopReplayPlayback())
</script>
<style scoped>
.designer-page {
  height: calc(100vh - 112px);
  padding: 0 4px;
}
.page-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 14px; flex-wrap: wrap; }
.eyebrow { color: #d97706; font-size: 11px; font-weight: 700; letter-spacing: 1.8px; }
h1 { margin: 4px 0; color: #172033; font-size: 28px; }
p { color: #667085; margin: 0; }
.heading-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.error-alert { margin-bottom: 10px; }
.designer-body { flex: 1; display: flex; gap: 12px; min-height: 0; }
.palette { width: 230px; flex-shrink: 0; overflow: auto; background: #fff; border: 1px solid #e6e8ec; border-radius: 10px; padding: 14px; box-shadow: 0 10px 30px rgba(23, 32, 51, 0.05); }
.palette-title { font-weight: 700; color: #172033; margin-bottom: 10px; font-size: 13px; }
.palette-item { display: flex; align-items: center; gap: 10px; padding: 10px; margin-bottom: 8px; border: 1px solid #e6e8ec; border-radius: 8px; cursor: grab; background: #f8fafc; transition: border-color .15s ease; }
.palette-item:hover { border-color: #3b82f6; background: #eff6ff; }
.palette-item:active { cursor: grabbing; }
.palette-dot { width: 10px; height: 10px; border-radius: 3px; background: #94a3b8; flex-shrink: 0; }
.palette-dot.signal { background: #10b981; }
.palette-dot.filter { background: #f59e0b; }
.palette-dot.verdict { background: #8b5cf6; }
.palette-dot.executor { background: #ef4444; }
.palette-dot.child-suite { background: #3b82f6; }
.palette-name { font-weight: 600; color: #172033; font-size: 13px; }
.palette-desc { color: #98a2b3; font-size: 11px; }
.legend-line { display: flex; align-items: center; gap: 8px; color: #475569; font-size: 12px; margin-bottom: 8px; }
.legend-edge { width: 26px; height: 0; border-top: 2px solid #94a3b8; }
.legend-edge.membership { border-top-style: dashed; }
.legend-edge.orchestration { border-top-color: #3b82f6; border-top-style: solid; }
.palette-tip { color: #98a2b3; font-size: 11px; line-height: 1.6; }
.canvas-wrap { flex: 1; min-width: 0; border: 1px solid #e6e8ec; border-radius: 10px; overflow: hidden; background: #f8fafc; position: relative; }
.flow-canvas { width: 100%; height: 100%; }
.canvas-empty { position: absolute; inset: 0; display: grid; place-items: center; }
.flow-node { width: 190px; background: #fff; border: 2px solid #cbd5e1; border-radius: 10px; padding: 10px 12px; box-shadow: 0 6px 18px rgba(23, 32, 51, .08); font-size: 12px; position: relative; }
.flow-node.case-node.type-signal { border-color: #10b981; }
.flow-node.case-node.type-filter { border-color: #f59e0b; }
.flow-node.case-node.type-verdict { border-color: #8b5cf6; }
.flow-node.case-node.type-executor { border-color: #ef4444; }
.flow-node.suite-node.root { border-color: #0f172a; background: linear-gradient(180deg, #101828, #1e293b); color: #fff; }
.flow-node.suite-node:not(.root) { border-color: #3b82f6; background: #eff6ff; }
.flow-node.run-pending { border-style: dashed; opacity: .72; }
.flow-node.run-running { border-color: #2563eb; border-width: 3px; animation: pulse 1.2s infinite; }
.flow-node.run-completed { border-color: #16a34a; box-shadow: 0 0 0 4px rgba(22, 163, 74, .15); }
.flow-node.run-failed { border-color: #dc2626; border-width: 3px; animation: pulse .8s infinite; }
.flow-node.run-skipped { opacity: .5; border-style: dotted; }
.node-tag { font-size: 10px; font-weight: 700; letter-spacing: .8px; color: #94a3b8; text-transform: uppercase; }
.suite-node.root .node-tag { color: rgba(255, 255, 255, .65); }
.suite-node:not(.root) .node-tag { color: #3b82f6; }
.node-title { font-weight: 700; color: #172033; margin: 4px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.suite-node.root .node-title { color: #fff; }
.node-sub { display: flex; align-items: center; justify-content: space-between; gap: 6px; color: #98a2b3; font-size: 11px; }
.suite-node.root .node-sub { color: rgba(255, 255, 255, .7); }
.run-badge { font-weight: 700; }
.run-badge.run-running { color: #2563eb; }
.run-badge.run-completed { color: #16a34a; }
.run-badge.run-failed { color: #dc2626; }
.node-remove { position: absolute; top: -9px; right: -9px; width: 20px; height: 20px; border-radius: 50%; border: 1px solid #e5e7eb; background: #fff; color: #ef4444; font-size: 13px; line-height: 1; cursor: pointer; display: none; }
.flow-node:hover .node-remove { display: block; }
.node-handle { width: 9px; height: 9px; background: #64748b; border: 2px solid #fff; }
@keyframes pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(37, 99, 235, .3); } 50% { box-shadow: 0 0 0 8px rgba(37, 99, 235, 0); } }
.option-desc { color: #98a2b3; margin-left: 10px; font-size: 11px; }
.form-hint { color: #98a2b3; font-size: 11px; margin-left: 10px; }
.picker-hint { color: #98a2b3; font-size: 12px; margin: 10px 0 0; }
.drawer-section-title, .replay-section-title { font-weight: 700; color: #172033; font-size: 13px; margin: 14px 0 8px; }
.json-box { margin: 0; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; overflow: auto; max-height: 360px; font-size: 12px; }
.replay-body { display: flex; flex-direction: column; gap: 12px; height: 100%; }
.replay-panel { flex: 1; display: flex; flex-direction: column; gap: 10px; min-height: 0; }
.replay-controls { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.step-progress { color: #667085; font-size: 12px; }
.current-step { display: flex; align-items: center; gap: 8px; padding: 10px; border: 1px solid #e6e8ec; border-radius: 8px; background: #f8fafc; font-size: 12px; }
.step-text { flex: 1; color: #172033; font-weight: 600; }
.step-time { color: #98a2b3; }
.failed-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 12px; color: #b91c1c; padding: 4px 0; }
.failed-name { flex: 1; word-break: break-all; }
.event-log { flex: 1; overflow: auto; border: 1px solid #e6e8ec; border-radius: 8px; padding: 8px; min-height: 140px; }
.event-entry { display: flex; align-items: center; gap: 8px; padding: 5px 6px; border-radius: 6px; font-size: 12px; color: #344054; }
.event-entry.current { background: #eff6ff; outline: 1px solid #bfdbfe; }
.entry-time { color: #98a2b3; font-variant-numeric: tabular-nums; }
.entry-label { flex: 1; word-break: break-all; }
@media (max-width: 900px) {
  .designer-body { flex-direction: column; }
  .palette { width: 100%; }
  .canvas-wrap { min-height: 420px; }
  .designer-page { height: auto; }
}
</style>
