<template>
  <div class="page-container">
    <div class="hero">
      <span class="eyebrow">QUANT ENGINE</span>
      <h1>欢迎使用量化策略平台</h1>
      <p>从「公开数据采集」到「策略自主决策」的闭环 · 编辑与执行分离 · 事件驱动</p>
    </div>

    <div class="entry-grid">
      <div class="entry-card primary">
        <div class="entry-icon"><el-icon><MagicStick /></el-icon></div>
        <div class="entry-body">
          <h3>快速创建策略</h3>
          <p>3 步生成「Case → Suite → Plan」并一键发布，无需手工串行建链。</p>
        </div>
        <el-button type="primary" @click="router.push('/quick-strategy')">开始创建</el-button>
      </div>

      <div class="entry-card">
        <div class="entry-icon alt"><el-icon><Connection /></el-icon></div>
        <div class="entry-body">
          <h3>策略设计器</h3>
          <p>拖拽节点 / 连线编排复杂拓扑，支持边条件操作符与执行轨迹回放。</p>
        </div>
        <el-button @click="router.push('/designer')">进入画布</el-button>
      </div>

      <div class="entry-card">
        <div class="entry-icon alt"><el-icon><Odometer /></el-icon></div>
        <div class="entry-body">
          <h3>分时监控</h3>
          <p>多市场时区感知分时图，SSE 实时推送与分时技术指标联动。</p>
        </div>
        <el-button @click="router.push('/monitoring')">查看盘面</el-button>
      </div>

      <div class="entry-card">
        <div class="entry-icon alt"><el-icon><DataAnalysis /></el-icon></div>
        <div class="entry-body">
          <h3>执行监控</h3>
          <p>SuiteRun 运行实例、执行日志与委托单一览。</p>
        </div>
        <el-button @click="router.push('/dashboard')">打开面板</el-button>
      </div>
    </div>

    <div class="flow-note">
      <span class="flow-title">关键路径</span>
      <el-steps :active="4" align-center finish-status="success" class="flow-steps">
        <el-step title="创建策略" description="Case / Suite / Plan" />
        <el-step title="发布" description="快照固化 · 热加载" />
        <el-step title="调度执行" description="Scheduler → Worker" />
        <el-step title="事件驱动" description="EventLoop → Order" />
      </el-steps>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { Connection, DataAnalysis, MagicStick, Odometer } from '@element-plus/icons-vue'

const router = useRouter()
</script>

<style scoped>
.page-container {
  max-width: 1080px;
  margin: 0 auto;
}

.hero {
  margin-bottom: 24px;
}

.eyebrow {
  color: #d97706;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1.8px;
}

.hero h1 {
  margin: 6px 0;
  color: #172033;
  font-size: 30px;
}

.hero p {
  color: #667085;
}

.entry-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.entry-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  border: 1px solid #e6e8ec;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 10px 30px rgba(23, 32, 51, 0.06);
}

.entry-card.primary {
  border-left: 4px solid #3b82f6;
}

.entry-icon {
  width: 46px;
  height: 46px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  color: #fff;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  flex-shrink: 0;
}

.entry-icon.alt {
  background: #eef2f7;
  color: #475467;
}

.entry-body {
  flex: 1;
  min-width: 0;
}

.entry-body h3 {
  margin: 0 0 4px;
  color: #172033;
  font-size: 16px;
}

.entry-body p {
  margin: 0;
  color: #667085;
  font-size: 13px;
}

.flow-note {
  margin-top: 24px;
  padding: 20px;
  border: 1px solid #e6e8ec;
  border-radius: 10px;
  background: #fff;
}

.flow-title {
  color: #d97706;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 1.2px;
}

.flow-steps {
  margin-top: 16px;
}

@media (max-width: 900px) {
  .entry-grid {
    grid-template-columns: 1fr;
  }
}
</style>
