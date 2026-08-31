<template>
  <div class="page-container">
    <div class="page-heading">
      <div>
        <span class="eyebrow">TRIGGER</span>
        <h1>触发执行</h1>
        <p>手动执行 Plan 并查询运行状态。</p>
      </div>
    </div>

    <el-row :gutter="20">
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-title">手动触发 Plan</div>
          </template>
          <el-form :model="triggerForm" label-width="90px">
            <el-form-item label="Plan ID" required>
              <el-input v-model.number="triggerForm.plan_id" />
            </el-form-item>
            <el-form-item label="标的代码" required>
              <el-input v-model="triggerForm.symbols" placeholder="例如: AAPL,000001" />
            </el-form-item>
            <el-button type="primary" :loading="triggering" @click="triggerPlan">触发</el-button>
          </el-form>
          <pre v-if="triggerResult" class="result-box">{{ triggerResult }}</pre>
        </el-card>
      </el-col>

      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-title">查询运行状态</div>
          </template>
          <el-form :model="statusForm" label-width="90px">
            <el-form-item label="Run ID" required>
              <el-input v-model.number="statusForm.run_id" />
            </el-form-item>
            <el-button type="success" :loading="querying" @click="queryRun">查询</el-button>
          </el-form>
          <pre v-if="statusResult" class="result-box">{{ statusResult }}</pre>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'

const triggerForm = ref({ plan_id: '', symbols: '' })
const statusForm = ref({ run_id: '' })
const triggerResult = ref('')
const statusResult = ref('')
const triggering = ref(false)
const querying = ref(false)

async function triggerPlan() {
  if (!triggerForm.value.plan_id || !triggerForm.value.symbols.trim()) {
    ElMessage.warning('Plan ID 和标的代码不能为空')
    return
  }
  triggering.value = true
  try {
    const response = await fetch('/api/execution/trigger/', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': document.cookie.match(/csrftoken=([^;]+)/)?.[1] || '',
      },
      body: JSON.stringify({
        plan_id: Number(triggerForm.value.plan_id),
        symbols: triggerForm.value.symbols.split(',').map((item) => item.trim()).filter(Boolean),
      }),
    })
    const payload = await response.json()
    if (!response.ok) throw new Error(payload.detail || 'trigger failed')
    triggerResult.value = JSON.stringify(payload, null, 2)
    ElMessage.success('触发成功')
  } catch (error: any) {
    triggerResult.value = JSON.stringify({ error: error.message }, null, 2)
    ElMessage.error(error.message)
  } finally {
    triggering.value = false
  }
}

async function queryRun() {
  if (!statusForm.value.run_id) {
    ElMessage.warning('Run ID 不能为空')
    return
  }
  querying.value = true
  try {
    const response = await fetch(`/api/execution/run/${statusForm.value.run_id}/`, {
      credentials: 'same-origin',
    })
    const payload = await response.json()
    if (!response.ok) throw new Error(payload.detail || 'query failed')
    statusResult.value = JSON.stringify(payload, null, 2)
  } catch (error: any) {
    statusResult.value = JSON.stringify({ error: error.message }, null, 2)
    ElMessage.error(error.message)
  } finally {
    querying.value = false
  }
}
</script>

<style scoped>
.page-container { max-width: 1100px; margin: 0 auto; }
.page-heading { margin-bottom: 24px; }
.eyebrow { color: #d97706; font-size: 11px; font-weight: 700; letter-spacing: 1.8px; }
h1 { margin: 6px 0; color: #172033; font-size: 36px; }
p { color: #667085; }
.card-title { font-weight: 700; }
.result-box { margin-top: 20px; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; overflow: auto; }
</style>
