<template>
  <div class="page-container">
    <h1>? 执行监控</h1>
    <p>实时查看策略执行状态</p>
    <el-table :data="[]" style="width:100%">
      <el-table-column prop="time" label="时间" />
      <el-table-column prop="symbol" label="标的" />
      <el-table-column prop="direction" label="方向" />
      <el-table-column prop="status" label="状态" />
    </el-table>
  </div>
</template>
