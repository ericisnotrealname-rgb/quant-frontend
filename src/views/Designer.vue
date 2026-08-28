<template>
  <div class="page-container">
    <div class="page-heading"><div><span class="eyebrow">STRATEGY WORKBENCH</span><h1>策略配置</h1><p>管理 Case、Suite 与 Plan 的发布链路。</p></div><el-button :loading="loading" @click="loadData"><el-icon><Refresh /></el-icon>刷新</el-button></div>
    <el-alert v-if="error" :title="error" type="error" show-icon closable @close="error = ''" />
    <el-tabs v-model="activeTab" class="tabs">
      <el-tab-pane label="Cases" name="cases"><div class="toolbar"><strong>策略节点</strong><el-button type="primary" @click="caseDialog = true"><el-icon><Plus /></el-icon>新建 Case</el-button></div><el-table v-loading="loading" :data="cases" stripe empty-text="暂无 Case"><el-table-column prop="name" label="名称" /><el-table-column prop="node_type" label="类型" width="120" /><el-table-column prop="version" label="版本" width="90" /><el-table-column prop="status" label="状态" width="110" /><el-table-column label="操作" width="110"><template #default="{ row }"><el-button v-if="row.status !== 'published'" link type="primary" @click="publishCase(row.id)">发布</el-button></template></el-table-column></el-table></el-tab-pane>
      <el-tab-pane label="Suites" name="suites"><div class="toolbar"><strong>策略工作流</strong><el-button type="primary" @click="suiteDialog = true"><el-icon><Plus /></el-icon>新建 Suite</el-button></div><el-table v-loading="loading" :data="suites" stripe empty-text="暂无 Suite"><el-table-column prop="name" label="名称" /><el-table-column prop="aggregate_method" label="聚合方式" width="140" /><el-table-column prop="version" label="版本" width="90" /><el-table-column prop="status" label="状态" width="110" /></el-table></el-tab-pane>
      <el-tab-pane label="Plans" name="plans"><div class="toolbar"><strong>调度计划</strong><el-button type="primary" @click="planDialog = true"><el-icon><Plus /></el-icon>新建 Plan</el-button></div><el-table v-loading="loading" :data="plans" stripe empty-text="暂无 Plan"><el-table-column prop="name" label="名称" /><el-table-column prop="trigger_type" label="触发方式" width="120" /><el-table-column prop="exec_mode" label="执行模式" width="120" /><el-table-column prop="version" label="版本" width="90" /><el-table-column prop="status" label="状态" width="110" /></el-table></el-tab-pane>
    </el-tabs>
    <el-dialog v-model="caseDialog" title="新建 Case" width="420px"><el-form :model="caseForm" label-position="top"><el-form-item label="名称"><el-input v-model="caseForm.name" /></el-form-item><el-form-item label="节点类型"><el-select v-model="caseForm.node_type" style="width: 100%"><el-option v-for="type in caseTypes" :key="type" :label="type" :value="type" /></el-select></el-form-item><el-form-item label="参数 JSON"><el-input v-model="caseForm.params" type="textarea" :rows="5" /></el-form-item></el-form><template #footer><el-button @click="caseDialog = false">取消</el-button><el-button type="primary" :loading="saving" @click="createCase">创建</el-button></template></el-dialog>
    <el-dialog v-model="suiteDialog" title="新建 Suite" width="420px"><el-form :model="suiteForm" label-position="top"><el-form-item label="名称"><el-input v-model="suiteForm.name" /></el-form-item><el-form-item label="聚合方式"><el-select v-model="suiteForm.aggregate_method" style="width: 100%"><el-option v-for="method in aggregateMethods" :key="method" :label="method" :value="method" /></el-select></el-form-item></el-form><template #footer><el-button @click="suiteDialog = false">取消</el-button><el-button type="primary" :loading="saving" @click="createSuite">创建</el-button></template></el-dialog>
    <el-dialog v-model="planDialog" title="新建 Plan" width="420px"><el-form :model="planForm" label-position="top"><el-form-item label="名称"><el-input v-model="planForm.name" /></el-form-item><el-form-item label="根 Suite"><el-select v-model="planForm.root_suite" style="width: 100%"><el-option v-for="suite in suites" :key="suite.id" :label="suite.name" :value="suite.id" /></el-select></el-form-item><el-form-item label="触发方式"><el-select v-model="planForm.trigger_type" style="width: 100%"><el-option label="时间驱动" value="time" /><el-option label="手动触发" value="manual" /></el-select></el-form-item><el-form-item v-if="planForm.trigger_type === 'time'" label="Cron"><el-input v-model="planForm.cron_expr" placeholder="*/5 * * * *" /></el-form-item></el-form><template #footer><el-button @click="planDialog = false">取消</el-button><el-button type="primary" :loading="saving" @click="createPlan">创建</el-button></template></el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus, Refresh } from '@element-plus/icons-vue'
import { strategyApi } from '@/api/strategy'
import type { CaseItem, PlanItem, SuiteItem } from '@/types/api'

const activeTab = ref('cases'); const loading = ref(false); const saving = ref(false); const error = ref('')
const cases = ref<CaseItem[]>([]); const suites = ref<SuiteItem[]>([]); const plans = ref<PlanItem[]>([])
const caseDialog = ref(false); const suiteDialog = ref(false); const planDialog = ref(false)
const caseTypes = ['signal', 'filter', 'verdict', 'executor']; const aggregateMethods = ['weighted_sum', 'vote', 'and', 'or']
const caseForm = reactive({ name: '', node_type: 'signal' as CaseItem['node_type'], params: '{"trigger":{"event_type":"SUITE_INIT"}}' })
const suiteForm = reactive({ name: '', aggregate_method: 'weighted_sum' as SuiteItem['aggregate_method'] })
const planForm = reactive({ name: '', root_suite: 0, trigger_type: 'manual' as PlanItem['trigger_type'], cron_expr: '' })

async function loadData() { loading.value = true; error.value = ''; try { const [caseResponse, suiteResponse, planResponse] = await Promise.all([strategyApi.cases(), strategyApi.suites(), strategyApi.plans()]); cases.value = caseResponse.data; suites.value = suiteResponse.data; plans.value = planResponse.data } catch (cause) { error.value = '策略数据加载失败，请确认后端服务已启动。'; console.error(cause) } finally { loading.value = false } }
async function createCase() { await runSave(async () => { await strategyApi.createCase({ name: caseForm.name, node_type: caseForm.node_type, params: JSON.parse(caseForm.params) }); caseDialog.value = false; await loadData() }) }
async function createSuite() { await runSave(async () => { await strategyApi.createSuite({ name: suiteForm.name, aggregate_method: suiteForm.aggregate_method }); suiteDialog.value = false; await loadData() }) }
async function createPlan() { await runSave(async () => { await strategyApi.createPlan({ name: planForm.name, root_suite: planForm.root_suite, trigger_type: planForm.trigger_type, cron_expr: planForm.cron_expr || null, symbol_scope: { type: 'all' }, exec_mode: 'serial', retry_policy: {} }); planDialog.value = false; await loadData() }) }
async function publishCase(id: number) { await runSave(async () => { await strategyApi.publishCase(id); await loadData() }) }
async function runSave(action: () => Promise<void>) { saving.value = true; try { await action(); ElMessage.success('操作已完成') } catch (cause) { ElMessage.error(cause instanceof SyntaxError ? '参数 JSON 格式错误' : '操作失败，请检查输入'); console.error(cause) } finally { saving.value = false } }
onMounted(loadData)
</script>

<style scoped>
.page-container { max-width: 1280px; margin: 0 auto; }.page-heading, .toolbar { display: flex; align-items: center; justify-content: space-between; gap: 20px; }.page-heading { margin-bottom: 24px; }.eyebrow { color: #d97706; font-size: 11px; font-weight: 700; letter-spacing: 1.8px; }h1 { margin: 6px 0; color: #172033; font-size: 36px; }p { color: #667085; }.tabs { padding: 22px 24px; background: #fff; border: 1px solid #e6e8ec; border-radius: 8px; box-shadow: 0 10px 30px rgba(23, 32, 51, .06); }.toolbar { margin-bottom: 22px; color: #172033; }@media (max-width: 760px) { .page-heading { align-items: flex-start; } h1 { font-size: 30px; } }
</style>
