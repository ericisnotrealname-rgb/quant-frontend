<template>
  <div class="page-container">
    <h1>?? 策略设计器</h1>
    <p>拖拽编排策略 (Vue Flow 画布占位)</p>
    <div class="canvas-placeholder">
      <el-empty description="画布区域等待实现" />
    </div>
  </div>
</template>

<style scoped>
.canvas-placeholder {
  height: 500px;
  border: 2px dashed #dcdfe6;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
