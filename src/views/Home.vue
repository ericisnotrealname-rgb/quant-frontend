<template>
  <div class="page-container">
    <h1>? 首页</h1>
    <p>欢迎使用量化策略平台</p>
    <el-button type="primary" @click="increment">计数: {{ count }}</el-button>
  </div>
</template>

<script setup lang="ts">
import { useCounterStore } from '@/stores/counter';
const { count, increment } = useCounterStore();
</script>

<style scoped>
.page-container {
  background: #fff;
  padding: 24px;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.05);
}
</style>
