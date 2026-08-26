<template>
  <div class="app-layout">
    <el-container>
      <el-header>
        <div class="logo">? 量化引擎</div>
        <el-menu mode="horizontal" router>
          <el-menu-item index="/">首页</el-menu-item>
          <el-menu-item index="/designer">策略设计器</el-menu-item>
          <el-menu-item index="/dashboard">执行监控</el-menu-item>
          <el-menu-item index="/watchlist">自选池</el-menu-item>
        </el-menu>
      </el-header>
      <el-main>
        <router-view />
      </el-main>
    </el-container>
  </div>
</template>

<script setup lang="ts">
import { ElContainer, ElHeader, ElMain, ElMenu, ElMenuItem } from 'element-plus';
</script>

<style scoped>
.app-layout {
  height: 100vh;
  display: flex;
  flex-direction: column;
}
.el-header {
  display: flex;
  align-items: center;
  border-bottom: 1px solid #e4e7ed;
  background: #fff;
  padding: 0 24px;
  height: 60px;
}
.logo {
  font-size: 20px;
  font-weight: bold;
  margin-right: 40px;
  color: #409eff;
}
.el-main {
  flex: 1;
  padding: 20px;
  background: #f5f7fa;
  overflow: auto;
}
</style>
