# 量化交易平台 · 前端开发文档

> 版本：v1.0  
> 日期：2026-08-26  
> 状态：开发中 · 核心联调页面已完成


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
- **认证方式**：Session；Axios 使用 `withCredentials` 携带会话 Cookie
- **当前联调范围**：用户认证、自选池、Case/Suite/Plan、执行日志和委托单


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
│   │   ├── Designer.vue       # Case/Suite/Plan 策略配置页（Vue Flow 画布待增强）
│   │   ├── Dashboard.vue      # 执行监控：日志、运行中任务、委托单
│   │   ├── Watchlist.vue      # 自选池：标的、分组和自选配置
│   │   └── Login.vue          # Session 登录页
│   ├── components/            # 可复用组件（待补充）
│   │   ├── common/            # 通用组件（按钮、卡片、弹窗等）
│   │   ├── designer/          # 设计器专用组件（节点库、属性面板等）
│   │   └── dashboard/         # 监控专用组件（日志表格、统计卡片等）
│   ├── router/
│   │   └── index.ts           # 路由配置
│   ├── stores/                # Pinia Store
│   │   ├── counter.ts         # 模板遗留示例 Store
│   │   └── auth.ts            # 当前用户与 Session 登录状态
│   ├── api/                   # API 请求封装
│   │   ├── index.ts           # Axios 实例（拦截器）
│   │   ├── watchlists.ts      # 标的、分组和自选配置 API
│   │   ├── strategy.ts        # Case、Suite、Plan API
│   │   ├── users.ts           # 登录、注册、退出、用户资料 API
│   │   └── execution.ts       # 运行记录、执行日志、委托单 API
│   ├── types/                 # TypeScript 类型定义
│   │   └── api.ts             # 业务 API 响应与领域类型
│   └── utils/                 # 工具函数
│       ├── formatters.ts      # 日期/数字格式化
│       └── validators.ts      # 表单校验规则
└── public/                    # 静态资源（不经过构建）
```

---

## 三、核心模块说明

### 3.1 布局与路由

#### 路由配置（`src/router/index.ts`）

当前已定义主要路由：
- `/` → `Home`（首页）
- `/designer` → `Designer`（策略设计器）
- `/dashboard` → `Dashboard`（执行监控）
- `/watchlist` → `Watchlist`（自选池）
- `/login` → `Login`（登录页）

其中 `/watchlist` 已启用登录守卫；未认证用户会被重定向到 `/login`，登录成功后返回原目标页面。

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

**当前实现：** 业务 API 已按领域拆分为 `api/watchlists.ts`、`api/strategy.ts`、`api/users.ts` 和 `api/execution.ts`：

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

### 3.4 策略配置与设计器（`views/Designer.vue`）

当前已实现：
- Case、Suite、Plan 三类对象列表
- 创建 Case、Suite、Plan
- Case 参数 JSON 编辑与基础格式校验
- Case 发布操作
- 后端数据加载、加载态、错误提示和成功提示

尚未实现：
- Vue Flow 拖拽画布
- Case 节点和 Edge 的可视化编辑
- Suite 拓扑保存、发布按钮和版本历史界面
- Plan 发布、版本历史和手动触发界面

**Vue Flow 基础配置示例**：

```typescript
import { VueFlow, useVueFlow } from '@vue-flow/core';
import '@vue-flow/core/dist/style.css';
```

### 3.5 执行监控（`views/Dashboard.vue`）

当前已实现：
- 执行记录总数、成功率、运行中数量和委托单数量
- 执行日志列表及状态筛选
- 方向、状态、耗时和异常信息展示
- 委托单列表，展示方向、价格、数量、状态和更新时间
- 手动刷新和空态/错误态

尚未实现：
- 自动轮询或 WebSocket 实时刷新
- Suite → Case 树形执行轨迹详情
- 按 Plan、日期和标的的组合筛选

### 3.6 自选池管理（`views/Watchlist.vue`）

当前已实现：
- 标的列表加载和按代码/名称搜索
- 分组加载和分组数量展示
- 勾选分组作为当前用户自选配置
- 自选配置保存、刷新、加载态和错误态

尚未实现：
- 按市场/交易所筛选控件
- 分组新增、编辑、删除和标的绑定操作
- 批量导入 CSV


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

### 6.4 当前已对接接口

| 前端 API | 后端路径 | 当前用途 |
|----------|----------|----------|
| `usersApi` | `/api/users/login/`、`register/`、`logout/`、`profile/` | Session 登录、注册、退出和用户资料 |
| `watchlistsApi` | `/api/watchlists/symbols/`、`groups/`、`watchlist/` | 标的、分组和当前用户自选配置 |
| `strategyApi` | `/api/cases/`、`/api/suites/`、`/api/plans/` | 策略对象查询、创建和 Case 发布 |
| `executionApi` | `/api/execution/logs/`、`orders/`、`runs/`、`trigger/` | 执行监控和手动触发 |

Axios 实例设置 `withCredentials: true`，用于携带 Django Session Cookie。当前错误处理保留原始 Promise rejection，由页面负责展示业务提示。

### 6.5 当前限制

- 部分 DRF 列表接口可能返回分页对象 `{ count, next, previous, results }`；当前页面按非分页数组读取，接入分页配置后需统一增加响应解包函数。
- Django Session 的 CSRF 保护需要在生产环境补充 CSRF Cookie 获取和请求头注入。
- `/designer` 当前是策略配置页，不等同于完整 Vue Flow 画布。

### 6.6 前端验证

在 `quant-frontend` 目录执行：

```bash
npm run build
```

当前构建已通过；Vite 仍提示主 bundle 体积较大，代码分割属于后续性能优化项。


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

已完成“认证与 API 基础 + 自选池 + 策略对象基础配置 + 执行监控”的第一阶段联调切片。下一阶段建议按以下顺序推进：

1. 补齐 Session CSRF 处理、分页响应解包和全局错误拦截。
2. 为 Suite 增加拓扑加载/保存/发布界面，为 Plan 增加发布和手动触发界面。
3. 将策略配置页升级为 Vue Flow 画布，支持 Case 拖拽、Edge 连线和条件编辑。
4. 增加执行日志详情、自动刷新和按 Plan/日期筛选。
5. 最后实现数据源 K 线页面、实时快照和首页业务摘要。

---

## 八、参考资源

- [Vue 3 官方文档](https://cn.vuejs.org/)
- [Vite 官方文档](https://cn.vitejs.dev/)
- [Pinia 官方文档](https://pinia.vuejs.org/zh/)
- [Vue Router 官方文档](https://router.vuejs.org/zh/)
- [Element Plus 官方文档](https://element-plus.org/zh-CN/)
- [Vue Flow 官方文档](https://vueflow.dev/)
- [Axios 官方文档](https://axios-http.com/)