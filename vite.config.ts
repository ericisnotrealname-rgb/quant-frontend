import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  // ⚠️ 必须用绝对路径 '/'，不能用相对路径 './'。
  //
  // 原因：本项目前端路由是 **history 模式**（createWebHistory），
  // 地址形如 /plans/123。base 为 './' 时index.html 里引用的是
  //   src="./assets/index-xxx.js"
  // 浏览器会相对于**当前 URL** 解析，在 /plans/123 页面上解析成
  //   /plans/assets/index-xxx.js
  // 而该路径落进后端 catch-all 路由，会被当成 SPA 入口返回 **index.html**，
  // 浏览器拿到的Content-Type 是 text/html —— <script> 解析失败、页面白屏，
  // 且**不报 404**，很难排查。
  //
  // 改为 '/' 后引用变为 /assets/index-xxx.js，与 STATIC_URL('assets/'，
  // Django 会自动补前导斜杠) 及 collectstatic 产物（staticfiles/ 根）一致。
  base: '/',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  build: {
    outDir: '../static',
    emptyOutDir: true,
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            if (id.includes('element-plus') || id.includes('@element-plus')) return 'element-plus'
            if (id.includes('echarts') || id.includes('zrender')) return 'echarts'
            if (id.includes('vue') || id.includes('pinia')) return 'vue-vendor'
          }
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/api')
      }
    }
  }
})
