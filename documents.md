# 量化交易平台 · 前端开发文档

> 版本：v1.0  
> 日期：2026-08-26  
> 状态：开发中 · 基础骨架已完成


## 一、项目概述

### 1.1 技术栈

| 类别 | 技术选型 | 说明 |
|------|----------|------|
| **框架** | Vue 3 (Composition API) | 渐进式 JavaScript 框架 |
| **构建工具** | Vite | 极速构建与热更新 |
| **语言** | TypeScript | 类型安全，提升代码质量 |
| **状态管理** | Pinia | Vue 官方推荐的状态管理库 |
| **路由** | Vue Router 4 | 支持动态路由与导航守卫 |
| **UI 组件库** | Element Plus | 桌面端组件库，丰富且易用 |
| **图标库** | @element-plus/icons-vue | Element Plus 图标集合 |
| **HTTP 客户端** | Axios | 请求拦截、响应拦截、错误统一处理 |
| **流程图/画布** | @vue-flow/core | 用于策略设计器的拖拽连线 |
| **工具库** | @vueuse/core, lodash-es | 组合式工具函数与数据处理 |

### 1.2 项目目标

构建一个**可视化、可交互**的量化策略管理平台，提供：
- 标的与自选池管理
- 策略节点（Case）的拖拽编排
- 工作流（Suite）的图形化设计
- 调度计划（Plan）的配置与发布
- 执行监控与日志查看
- 数据源与 K 线数据管理

### 1.3 与后端协作方式

- **API 基础路径**：通过 `VITE_API_BASE_URL` 环境变量配置
- **开发环境代理**：Vite 代理 `/api` 到 Django 后端 `http://127.0.0.1:8000`
- **认证方式**：预留 JWT 或 Session（当前未实现，后续扩展）


## 二、项目结构

```
quant-frontend/
├── index.html                 # 入口 HTML
├── package.json               # 依赖管理
├── vite.config.ts             # Vite 配置文件（含代理）
├── .env.development           # 开发环境变量
├── .env.production            # 生产环境变量
├── src/
│   ├── main.ts                # 应用入口（注册 Pinia、Router、Element Plus）
│   ├── App.vue                # 根组件（挂载 DefaultLayout）
│   ├── layouts/
│   │   └── DefaultLayout.vue  # 默认布局（顶部导航 + 主内容区）
│   ├── views/                 # 页面级组件
│   │   ├── Home.vue           # 首页
│   │   ├── Designer.vue       # 策略设计器（画布占位）
│   │   ├── Dashboard.vue      # 执行监控
│   │   └── Watchlist.vue      # 自选池管理
│   ├── components/            # 可复用组件（待补充）
│   │   ├── common/            # 通用组件（按钮、卡片、弹窗等）
│   │   ├── designer/          # 设计器专用组件（节点库、属性面板等）
│   │   └── dashboard/         # 监控专用组件（日志表格、统计卡片等）
│   ├── router/
│   │   └── index.ts           # 路由配置
│   ├── stores/                # Pinia Store
│   │   ├── counter.ts         # 示例 Store
│   │   ├── watchlist.ts       # 自选池状态（待补充）
│   │   ├── designer.ts        # 设计器状态（待补充）
│   │   └── execution.ts       # 执行状态（待补充）
│   ├── api/                   # API 请求封装
│   │   ├── index.ts           # Axios 实例（拦截器）
│   │   ├── watchlists.ts      # 自选池相关 API（待补充）
│   │   ├── datasources.ts     # 数据源相关 API（待补充）
│   │   ├── cases.ts           # Case 相关 API（待补充）
│   │   ├── suites.ts          # Suite 相关 API（待补充）
│   │   ├── plans.ts           # Plan 相关 API（待补充）
│   │   └── execution.ts       # 执行相关 API（待补充）
│   ├── types/                 # TypeScript 类型定义
│   │   ├── global.d.ts        # 全局类型
│   │   ├── watchlist.d.ts     # 自选池类型
│   │   ├── designer.d.ts      # 设计器类型（节点、边等）
│   │   └── execution.d.ts     # 执行相关类型
│   └── utils/                 # 工具函数
│       ├── formatters.ts      # 日期/数字格式化
│       └── validators.ts      # 表单校验规则
└── public/                    # 静态资源（不经过构建）
```

---

## 三、核心模块说明

### 3.1 布局与路由

#### 路由配置（`src/router/index.ts`）

当前已定义四个主要路由：
- `/` → `Home`（首页）
- `/designer` → `Designer`（策略设计器）
- `/dashboard` → `Dashboard`（执行监控）
- `/watchlist` → `Watchlist`（自选池）

后续可根据需要添加：
- `/cases/:id` – 编辑单个 Case
- `/suites/:id` – 编辑 Suite
- `/plans/:id` – 编辑 Plan
- `/execution/logs` – 执行日志详情

#### 布局组件（`src/layouts/DefaultLayout.vue`）

- 使用 Element Plus 的 `el-container`, `el-header`, `el-main`
- 顶部导航栏包含 Logo 和菜单项
- 菜单使用 `el-menu` 的 `router` 模式，与 Vue Router 联动

### 3.2 API 调用（`src/api/index.ts`）

Axios 实例配置：
- `baseURL`：从环境变量读取
- `timeout`：30 秒
- 请求拦截器：预留添加 Token 的位置
- 响应拦截器：直接返回 `response.data`，错误统一打印

**扩展示例：** 为每个业务模块创建独立的 API 文件，例如 `api/watchlists.ts`：

```typescript
import api from './index';
import type { Symbol, Group, Watchlist } from '@/types/watchlist';

export const watchlistApi = {
  getSymbols(params?: any) {
    return api.get('/watchlists/symbols/', { params });
  },
  createSymbol(data: Partial<Symbol>) {
    return api.post('/watchlists/symbols/', data);
  },
  // ... 更多方法
};
```

### 3.3 状态管理（Pinia）

**示例 Store 设计（`stores/watchlist.ts`）**：

```typescript
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { watchlistApi } from '@/api/watchlists';

export const useWatchlistStore = defineStore('watchlist', () => {
  const symbols = ref([]);
  const groups = ref([]);
  const watchlist = ref(null);

  const fetchSymbols = async () => {
    const data = await watchlistApi.getSymbols();
    symbols.value = data;
  };

  return { symbols, groups, watchlist, fetchSymbols };
});
```

### 3.4 策略设计器（`views/Designer.vue`）

当前为占位页面，后续将集成 Vue Flow：
- 左侧工具栏：拖拽节点（Case）至画布
- 画布区域：渲染节点和连线，支持拖拽、缩放、选择
- 右侧属性面板：编辑选中节点的参数（RSI 周期、阈值等）
- 顶部操作栏：保存、发布、撤销/重做等

**Vue Flow 基础配置示例**：

```typescript
import { VueFlow, useVueFlow } from '@vue-flow/core';
import '@vue-flow/core/dist/style.css';
```

### 3.5 执行监控（`views/Dashboard.vue`）

计划实现功能：
- 统计卡片：今日执行数、成功率、拦截数
- 执行日志列表：按时间倒序，支持按标的/Plan/状态筛选
- 日志详情弹窗：展示树形执行轨迹（Suite → Case 的嵌套结果）
- 委托单列表：显示待发送/已成交/已拒绝的委托

### 3.6 自选池管理（`views/Watchlist.vue`）

计划实现功能：
- 标的列表：分页、搜索（按代码/名称）、过滤（按市场）
- 分组管理：左侧分组列表，右侧属于该分组的标的
- 用户自选池：勾选分组作为自选，保存配置
- 批量操作：批量导入标的（上传 CSV）


## 四、开发环境配置

### 4.1 环境变量

- **`.env.development`**：`VITE_API_BASE_URL = 'http://127.0.0.1:8000/api'`
- **`.env.production`**：`VITE_API_BASE_URL = '/api'`（生产环境使用 Nginx 代理）

### 4.2 Vite 代理（`vite.config.ts`）

```typescript
server: {
  proxy: {
    '/api': {
      target: 'http://127.0.0.1:8000',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api/, '/api')
    }
  }
}
```

### 4.3 启动命令

```bash
# 安装依赖
npm install

# 开发模式（热更新）
npm run dev

# 生产构建
npm run build

# 预览构建产物
npm run preview
```


## 五、开发规范

### 5.1 代码风格

- 使用 ESLint + Prettier（已由 Vite 模板配置）
- 组件命名采用 PascalCase（如 `DefaultLayout.vue`）
- 组合式 API 优先使用 `script setup` 语法
- 类型定义放在 `src/types/` 目录下

### 5.2 组件开发

- **页面组件**：放在 `views/`，对应路由
- **通用组件**：放在 `components/common/`，不包含业务逻辑
- **业务组件**：按模块放在 `components/{module}/`（如 `designer/`, `dashboard/`）

### 5.3 API 调用

- 所有 API 请求通过 `api/index.ts` 统一管理
- 为每个业务模块创建独立的 API 文件（如 `api/watchlists.ts`）
- 请求参数和响应类型均需定义 `interface`

### 5.4 状态管理

- 全局状态使用 Pinia
- 每个模块一个 Store，按业务拆分
- 组件内局部状态使用 `ref` / `reactive`

### 5.5 样式管理

- 使用 `scoped` 样式隔离组件样式
- 全局样式可在 `App.vue` 或 `main.ts` 中引入
- Element Plus 主题变量可在 `vite.config.ts` 中覆盖


## 六、与后端对接要点

### 6.1 接口路径前缀

所有后端接口统一以 `/api/` 开头，具体路径对应各 Django App 的 `urls.py` 注册。

### 6.2 响应格式约定

后端 DRF 默认返回 JSON，列表接口支持分页（`page`, `page_size` 参数）。示例响应：

```json
{
  "count": 100,
  "next": "/api/watchlists/symbols/?page=2",
  "previous": null,
  "results": [ ... ]
}
```

### 6.3 错误处理

后端错误响应统一为：
```json
{
  "error": "错误描述"
}
```
或 DRF 默认的：
```json
{
  "detail": "错误描述"
}
```
前端应统一拦截，使用 Element Plus 的 `ElMessage` 或 `ElNotification` 提示用户。


## 七、后续迭代计划

前端优先级按“能否阻塞主流程、后端接口是否已具备、实现成本”衡量。当前前端仍是骨架，目标应先打通“登录 → 选择标的 → 配置策略 → 发布 → 查看执行结果”的最小闭环。

### 7.1 P0：主流程与联调基础

| 顺序 | 模块 | 任务 | 原因/依赖 |
|------|------|------|-----------|
| 0 | 工程基线 | 修复 Vue/TypeScript 声明与路径别名，确保 `npm run build` 通过 | 当前构建被类型解析阻塞；所有 P0 都依赖它 |
| 1 | 认证与 API 基础 | Session 登录/注册/退出、Axios 凭证、错误提示、分页响应适配、统一类型 | 所有业务页面依赖；当前认证尚未实现 |
| 2 | 自选池 | 标的列表、搜索过滤、分组管理、自选配置 | Plan 的 `symbol_scope` 依赖；接口已具备，成本低 |
| 3 | 策略配置 | Case/Suite/Plan CRUD、参数校验、发布、版本历史、状态反馈 | 直接对应后端已完成能力，是策略运行前置条件 |
| 4 | 执行监控 | SuiteRun、Event、ExecutionLog、Order 列表与详情、状态筛选和轮询刷新 | 发布后必须能确认执行结果和订单状态 |
| 5 | 策略设计器 MVP | Vue Flow 画布、Case 节点、Edge 连线、保存拓扑、发布 Suite | 核心产品体验；依赖第 1、3 项，先做 MVP 再做高级交互 |

### 7.2 P1：增强体验与数据可视化

| 模块 | 任务 | 原因 |
|------|------|------|
| 数据源 | K 线查询、同步触发、实时快照展示 | 对策略配置有帮助，但不阻塞首个执行闭环 |
| 设计器增强 | 节点属性面板、撤销/重做、缩放小地图、条件编辑、跨 Suite 画布 | 成本较高，应在 MVP 联调稳定后投入 |
| 首页 | 替换示例计数器，显示计划、运行和订单摘要 | 信息聚合价值低于业务主流程 |

### 7.3 P2：上线前质量与运维能力

| 模块 | 任务 |
|------|------|
| 权限 | 管理员功能、角色控制、路由守卫、未授权跳转 |
| 稳定性 | API 重试、请求取消、轮询退避、空态/错误态/加载态统一处理 |
| 质量 | API mock、组件测试、关键流程 E2E、移动端与生产构建验证 |

### 7.4 当前建议

首个前端开发切片应为“认证与 API 基础 + 自选池列表”，随后立即接入 Case/Suite/Plan 的 CRUD 和发布流程。暂不优先投入首页视觉、完整数据源图表或设计器高级功能，这些都不会解除当前的联调阻塞。

---

## 八、参考资源

- [Vue 3 官方文档](https://cn.vuejs.org/)
- [Vite 官方文档](https://cn.vitejs.dev/)
- [Pinia 官方文档](https://pinia.vuejs.org/zh/)
- [Vue Router 官方文档](https://router.vuejs.org/zh/)
- [Element Plus 官方文档](https://element-plus.org/zh-CN/)
- [Vue Flow 官方文档](https://vueflow.dev/)
- [Axios 官方文档](https://axios-http.com/)