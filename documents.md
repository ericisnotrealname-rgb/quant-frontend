# 量化交易平台 · 前端开发文档

> 版本：v2.3  
> 日期：2026-09-09  
> 状态：需求冻结 · 按功能清单实现前端界面设计
>
> 变更记录：
> - v2.4（2026-09-10）：新增「策略设计器」模块（对接后端 Suite 拓扑与 NodeRun 轨迹接口）；基于 @vue-flow/core 实现画布拖拽编排、编排边条件配置与执行轨迹回放；侧边导航同步新增菜单项。
> - v2.3（2026-09-09）：新增「告警管理」与「告警渠道配置」两个模块，对接后端 `execution` 告警（Alert / AlertChannel）接口；侧边导航同步新增对应菜单项。
> - v2.2（2026-09-07）：新增「运行状态管理」模块（对接后端 Case/Suite/Plan 三级 run_status 状态机）；Plan/Suite 管理页新增启动/停止按钮、状态标签；Case 列表新增运行状态列。
> - v2.1（2026-09-07）：新增「资金占用管理」模块（对接后端分级资金占用链 FundAllocation）；Plan 管理表单与列表接入交易账户 ID / 占用资金字段。
> - v2.0（2026-08-31）：需求冻结，按功能清单实现前端界面设计。

## 一、整体布局要求

1. 采用经典的“侧边导航 + 顶部栏 + 主内容区”三栏式布局。
2. 侧边导航用于切换不同功能模块，支持折叠/展开，并记住用户偏好设置（例如使用 `localStorage` 记录展开状态）。
3. 顶部栏显示当前页面标题、用户登录状态：
   - 已登录：显示用户名和头像
   - 未登录：显示登录入口按钮
4. 主内容区用于展示各功能模块的具体内容。
5. 页面结构应保持整体一致，所有模块都复用统一的布局 shell。

### 1.1 布局结构建议

- 左侧：导航栏（可折叠）
- 顶部：页面标题、操作区、用户状态
- 中间：主内容区域，统一使用 `Card` / `Table` / `Form` / `Dialog` 组件组织页面
- 右侧：可选属性面板或详情面板（如 Case 编辑时的参数面板）

### 1.2 导航模块

建议导航项如下：
- 用户认证
- 标的管理（Symbol）
- 分组管理（Group）
- Case 管理
- Suite 管理
- 策略设计器
- Plan 管理
- 运行状态（Run Status）
- 资金占用（Fund Allocations）
- 执行日志
- 触发执行
- 事件类型管理
- 告警管理（Alerts）
- 告警渠道（Alert Channels）

## 二、功能模块清单

### 2.1 用户认证模块

#### 2.1.1 登录
- 提供用户名/密码输入框。
- 提供登录按钮。
- 登录成功后应写入 Session，并刷新当前用户信息。
- 登录失败时应提示具体错误信息。
- 未登录状态下，用户应被重定向到登录页。

#### 2.1.2 注册
- 提供注册表单，字段包括：
  - 用户名
  - 密码
  - 邮箱
  - 手机号
  - 公司
- 提交前校验必填字段、邮箱格式、密码强度和手机号格式。
- 注册成功后提示成功信息，并可跳转至登录页。

#### 2.1.3 登出
- 已登录用户可点击顶部栏中的退出按钮一键登出。
- 登出成功后清理当前会话状态，跳转到登录页。

#### 2.1.4 个人资料
- 已登录用户可查看和修改：
  - 邮箱
  - 手机号
  - 公司
- 提供保存按钮，提交成功后刷新用户资料。
- 只允许当前登录用户修改自己的资料。

#### 2.1.5 登录状态保持
- 页面刷新后应保留登录状态。
- 初始化应用时自动获取当前用户信息。
- 未登录状态对应路由跳转逻辑由全局路由守卫处理。

---

### 2.2 标的（Symbol）管理模块

#### 2.2.1 列表展示
- 以表格形式展示所有标的。
- 列包含：
  - 代码
  - 名称
  - 市场
  - 交易所
- 支持分页，每页默认 20 条，可配置。

#### 2.2.2 搜索与筛选
- 支持按代码和名称搜索。
- 支持按市场筛选：A股 / 港股 / 美股。
- 筛选条件应与表格查询参数联动。

#### 2.2.3 新增标的
- 提供“新增”按钮。
- 点击后弹出表单，填写：
  - 代码
  - 名称
  - 市场
  - 交易所
- 提交前校验必填字段与数据格式。

#### 2.2.4 编辑与删除
- 每行数据提供“编辑”和“删除”操作按钮。
- 编辑时弹出同一表单，并回填当前数据。
- 删除前需二次确认弹窗。

---

### 2.3 分组（Group）管理模块

#### 2.3.1 列表展示
- 以表格形式展示所有分组。
- 列包含：
  - 分组名称
  - 包含标的数量
  - 标的列表

#### 2.3.2 新增分组
- 提供“新增分组”按钮。
- 弹出表单输入分组名称。
- 创建成功后刷新列表。

#### 2.3.3 每行操作
- 每行提供：
  - 编辑
  - 删除
  - 管理标的

#### 2.3.4 管理标的
- 点击“管理标的”时弹窗显示该分组当前所有标的。
- 提供：
  - 添加标的
  - 移除标的
- 添加标的时，从下拉列表中选择已有标的，支持回填和保存。
- 对于移除操作，需二次确认。

---

### 2.4 Case 管理模块

#### 2.4.1 列表展示
- 以表格展示所有 Case。
- 列包括：
  - 名称
  - 节点类型
  - 版本
  - 状态
- 节点类型枚举：
  - signal
  - filter
  - verdict
  - executor
- 状态枚举：
  - draft
  - published
  - archived

#### 2.4.2 新增 Case
- 提供“新增 Case”按钮。
- 弹出表单填写：
  - 名称
  - 节点类型
  - 参数（JSON 格式）
- 提交前进行 JSON 语法校验与必填项校验。

#### 2.4.3 操作权限
- 每行提供：
  - 编辑
  - 发布
  - 删除
- 只有草稿状态（draft）的 Case 可以编辑和发布。
- 已发布 Case 不可删除，若有 Suite 引用则需禁止删除动作并提示原因。

#### 2.4.4 发布规则
- 发布时检查参数合法性、节点类型有效性和必要字段。
- 发布后状态更新为 published。

---

### 2.5 Suite 管理模块

#### 2.5.1 列表展示
- 以表格展示所有 Suite。
- 列包括：
  - 名称
  - 聚合方式
  - 版本
  - 状态
- 聚合方式包括：
  - 加权求和
  - 投票
  - 逻辑与
  - 逻辑或

#### 2.5.2 新增 Suite
- 提供“新增 Suite”按钮。
- 弹出表单填写：
  - 名称
  - 聚合方式
- 提交成功后新增 Suite，并刷新列表。

#### 2.5.3 每行操作
- 每行提供：
  - 编辑
  - 查看拓扑
  - 发布
  - 删除

#### 2.5.4 查看拓扑
- “查看拓扑”功能展示该 Suite 的完整拓扑。
- 以 JSON 树形结构展示，包含所有子 Suite 和 Case 的嵌套关系。
- 可按折叠/展开节点浏览结构。

#### 2.5.5 发布规则
- 发布时自动递归校验所有子节点已发布。
- 若子节点未发布，发布应被阻止并给出明确提示。

---

### 2.6.5 策略设计器

#### 2.6.5.1 概述
- 提供基于 `@vue-flow/core` 的可视化编排画布，用户通过拖拽节点与连线配置 Suite 拓扑。
- 路线 `/designer`（`src/views/Designer.vue`），导航菜单「策略设计器」。
- 拓扑保存时向后端 `POST /api/suites/{id}/topology/` 写入，加载时调用 `GET /api/suites/{id}/topology/` 读取。

#### 2.6.5.2 节点面板
- 左侧面板展示两种可拖拽节点类型：Case（信号/过滤/裁决/执行器）、子 Suite。
- 拖拽进入画布后自动创建对应类型的节点，并根据节点类型显示不同颜色标签。

#### 2.6.5.3 编排画布
- VueFlow 5.x 支撑画布：支持缩放、平移、网格背景、MiniMap、 Controls。
- 从根 Suite 拖出**成员边**（实线，连接到 Case）和**编排边**（实线，连接到子 Suite）。
- 双击编排边弹出「编排边条件」对话框，配置 `event_condition`：
  - 触发事件（下拉或输入，来自 `GET /api/execution/event-types/list-all/`）。
  - 来源 Case ID（可选）。
  - 后续事件（可选）。
  - 条件操作符（开关）：`op`（`eq`/`neq`/`gt`/`gte`/`lt`/`lte`/`between`） + `field` + `threshold`。
- 按 Backspace/Delete 删除节点与连线；点击节点右上角 `×` 可将 Case 移出编排。
- 节点标示运行状态（`runStatus`）：pending/running/completed/failed/skipped，对应颜色标签。

#### 2.6.5.4 操作栏
- **刷新**：重新从 `GET /api/suites/{id}/topology/` 加载拓扑。
- **保存拓扑**：提交当前画布状态到 `POST /api/suites/{id}/topology/`，成功后显示 ElMessage 成功提示。
- **发布**：弹出二次确认后调用 `POST /api/suites/{id}/publish/`，失败时显示错误信息。
- **执行轨迹回放**：开启回放模式，从 `GET /api/execution/runs/` 选取历史 SuiteRun，回放节点状态与事件序列。

#### 2.6.5.5 执行轨迹回放
- 回放面板右侧显示步进控制（上一步/下一步/自动播放/速度）。
- 左侧为历史事件列表，当前执行中高亮。
- 回放数据来自 `GET /api/execution/run/{run_id}/node-runs/`。

---

### 2.6 Plan 管理模块

#### 2.6.1 列表展示
- 以表格展示所有 Plan。
- 列包括：
  - 名称
  - 触发类型
  - 根 Suite ID
  - 状态
- 触发类型包括：
  - time
  - event
  - manual

#### 2.6.2 新增 Plan
- 提供“新增 Plan”按钮。
- 表单字段包括：
  - 名称
  - 触发类型
  - Cron 表达式
  - 根 Suite ID
  - 标的范围（JSON 格式）
- 提交前校验必填项和 Cron 语法。

#### 2.6.3 每行操作
- 每行提供：
  - 编辑
  - 发布
  - 删除
- 发布后 Plan 进入生效状态。

---

### 2.7 执行日志模块

#### 2.7.1 列表展示
- 以表格展示执行日志。
- 列包括：
  - 触发时间
  - 标的代码
  - 最终方向
  - 执行状态
  - 关联 Plan

#### 2.7.2 方向与状态说明
- 最终方向：
  - 卖出/做空：-1
  - 观望/平仓：0
  - 买入/做多：1
- 执行状态：
  - 成功
  - 失败
  - 风控拦截

#### 2.7.3 查看详情
- 每行提供“查看详情”按钮。
- 点击后弹出详情对话框，以 JSON 格式展示该次执行的完整快照数据。
- 内容应保留缩进和换行，便于阅读。

#### 2.7.4 过滤
- 支持按：
  - 标的代码
  - 状态
  - Plan
  做筛选。

---

### 2.8 触发执行模块

#### 2.8.1 手动触发 Plan
- 提供输入框：
  - Plan ID
  - 标的代码
- 提供“触发”按钮。
- 触发后显示执行结果：成功/失败，以及返回数据。

#### 2.8.2 查询运行状态
- 提供“Run ID”输入框。
- 点击查询后显示该次运行的完整状态信息。
- 结果以结构化形式展示，包括状态、时间和返回值。

---

### 2.9 事件类型管理模块

- 以表格展示所有已注册事件类型。
- 列包括：
  - 事件类型名称
  - 作用域
  - 描述
- 作用域枚举：
  - 系统内置
  - 插件定义
  - 用户自定义
- 该模块为只读展示，不提供增删改。

---

### 2.10 告警管理模块（v2.3 新增）

对接后端 `execution.Alert`，集中查看与处理系统中的各类告警（订单失败 / 策略执行失败 / 计划执行失败 / 风控违规 / 系统错误）。

#### 2.10.1 统计概览
- 页面顶部展示统计卡片：待处理、已确认、高 / 紧急、告警总数（来自 `GET /api/execution/alerts/statistics/` 的 `overview`）。

#### 2.10.2 列表展示
- 以表格展示告警，列包括：
  - 级别（低 / 中 / 高 / 紧急，彩色标签）
  - 类型
  - 告警内容（标题 + 错误代码）
  - 关联 Plan
  - 状态（待处理 / 已确认 / 已解决）
  - 通知状态（应用内 + 邮件指示灯，悬停显示详情）
  - 创建时间

#### 2.10.3 筛选
- 支持按：关键词（标题 / 消息 / 错误代码）、告警类型、严重程度、处理状态 做筛选。

#### 2.10.4 每行操作
- 确认：仅待处理告警可操作，调用 `POST /api/execution/alerts/{id}/actions/`（`action=acknowledge`）。
- 解决：待处理 / 已确认可操作，弹窗填写备注后提交（`action=resolve` + `note`）。
- 详情：弹出对话框展示完整字段与消息正文；已解决 / 未解决告警可"重新发送通知"（`POST /{id}/resend-notifications/`）。

---

### 2.11 告警渠道配置模块（v2.3 新增）

对接后端 `execution.AlertChannel`，配置应用内 / 邮件通知渠道，决定哪些告警通过何种渠道送达。

#### 2.11.1 列表展示
- 表格列：渠道类型（应用内 / 邮件）、是否启用、最低级别、邮件收件人、告警类型白名单、更新时间。

#### 2.11.2 新增 / 编辑
- 渠道类型单选（编辑时锁定）；启用开关；最低告警级别下拉；类型白名单多选（空表示全部）。
- 邮件渠道额外提供：收件人列表（逐行输入邮件，前端做格式校验）、邮件主题前缀。

#### 2.11.3 删除
- 删除前二次确认（popconfirm）。

#### 2.11.4 重新加载
- 页面提供"重新加载"按钮，调用 `POST /api/execution/alert-channels/reload/`，使渠道配置变更立即在 `alert_service` 生效。

---

## 二.10 前端模块与后端 API 对照

以下为前端各模块对应的后端接口清单，确保文档与真实 Django API 保持一致。

### 2.10.1 用户认证模块
- 登录：`POST /api/users/login/`
- 注册：`POST /api/users/register/`
- 登出：`POST /api/users/logout/`
- 当前用户信息：`GET /api/users/profile/`
- 修改个人资料：`PATCH /api/users/profile/`
- 角色管理：`POST /api/users/<user_id>/roles/`（管理员用，前端本期可按需适配）

### 2.10.2 标的（Symbol）管理模块
- 列表与筛选：`GET /api/watchlists/symbols/`
- 创建标的：`POST /api/watchlists/symbols/`
- 更新标的：`PATCH /api/watchlists/symbols/<id>/`
- 删除标的：`DELETE /api/watchlists/symbols/<id>/`
- 批量同步：`POST /api/watchlists/symbols/sync/`
- 批量导入：`POST /api/watchlists/symbols/batch-import/`

### 2.10.3 分组（Group）管理模块
- 分组列表：`GET /api/watchlists/groups/`
- 新增分组：`POST /api/watchlists/groups/`
- 更新分组：`PATCH /api/watchlists/groups/<id>/`
- 删除分组：`DELETE /api/watchlists/groups/<id>/`
- 管理分组标的：`POST /api/watchlists/groups/<id>/add-symbols/`
- 移除分组标的：`POST /api/watchlists/groups/<id>/remove-symbols/`
- 当前用户自选池：`GET /api/watchlists/watchlist/`、`PATCH /api/watchlists/watchlist/`

### 2.10.4 数据源管理模块
- 数据源列表：`GET /api/datasources/sources/`
- 新增数据源：`POST /api/datasources/sources/`
- 更新数据源：`PATCH /api/datasources/sources/<id>/`
- 删除数据源：`DELETE /api/datasources/sources/<id>/`
- 实时快照列表：`GET /api/datasources/snapshots/`
- K 线同步日志：`GET /api/datasources/sync-logs/`
- 查询 K 线数据：`GET /api/datasources/kline/query/`
- 触发 K 线同步：`POST /api/datasources/kline/sync/`

#### 2.10.4.1 通过 watchlists Symbol 拉取并更新数据源
- 前端优先从 `GET /api/watchlists/symbols/` 获取 Symbol 列表，用户在页面中选择一个 Symbol。
- 选择后，前端通过 `GET /api/datasources/kline/query/?symbol=<code>&start=<date>&end=<date>` 拉取该标的 K 线数据并展示。
- 页面使用 Apache ECharts（Canvas 渲染）绘制主图 K 线蜡烛图，并叠加 MA5 / MA10 / MA20 均线；主图支持缩放、交叉提示和分时数据查看。
- 成交量为可选附图，默认打开；同时支持可选显示 MACD、KDJ、RSI 的独立子图，且各指标采用分图堆叠显示。
- 附图设计为“按需显示”，通过页面勾选控制 `成交量 / MACD / KDJ / RSI` 是否打开；指标图表通过独立 grid 分层渲染，便于对照主图走势。
- 用户点击“更新数据源”后，前端调用 `POST /api/datasources/kline/sync/`，参数包含 `symbol`、`sync_type`、`start_date`、`end_date`、`adjust`。
- 更新成功后自动刷新同步日志与当前 K 线结果，确保界面与后端数据同步。
- 该流程的核心数据源是 `watchlists.symbol`，而非直接假定 DataSource 记录绑定了 Symbol；因此前端必须以 `Symbol.code` 作为查询/同步标识。

### 2.10.5 Case 管理模块
- Case 列表：`GET /api/cases/`
- 新增 Case：`POST /api/cases/`
- 更新 Case：`PATCH /api/cases/<id>/`
- 删除 Case：`DELETE /api/cases/<id>/`
- 发布 Case：`POST /api/cases/<id>/publish/`
- Case 历史版本：`GET /api/cases/<id>/versions/`

### 2.10.6 Suite 管理模块
- Suite 列表：`GET /api/suites/`
- 新增 Suite：`POST /api/suites/`
- 更新 Suite：`PATCH /api/suites/<id>/`
- 删除 Suite：`DELETE /api/suites/<id>/`
- 查看拓扑：`GET /api/suites/<id>/topology/`
- 更新拓扑：`POST /api/suites/<id>/topology/`
- 发布 Suite：`POST /api/suites/<id>/publish/`
- 节点运行轨迹（回放用）：`GET /api/execution/run/<run_id>/node-runs/`

### 2.10.7 Plan 管理模块
- Plan 列表：`GET /api/plans/`
- 新增 Plan：`POST /api/plans/`
- 更新 Plan：`PATCH /api/plans/<id>/`
- 删除 Plan：`DELETE /api/plans/<id>/`
- 发布 Plan：`POST /api/plans/<id>/publish/`
- 解析 Plan 标的范围：`GET /api/plans/<id>/symbols/`
- Plan 版本记录：`GET /api/plans/<id>/versions/`

### 2.10.8 运行状态管理模块
- Plan 启动：`POST /api/plans/<id>/start/`
- Plan 停止：`POST /api/plans/<id>/stop/`
- Suite 启动：`POST /api/suites/<id>/start/`
- Suite 停止：`POST /api/suites/<id>/stop/`
- Case 运行状态：`GET /api/cases/`（列表中包含 `run_status` 字段）
- 状态标签：new（草稿）、running（运行中）、done（已完成）、interrupt（已中断）、failed（失败）
- 启动/停止按钮：仅在允许操作时显示（Plan 为 new 时显示启动，running 时显示停止）

#### 状态流转规则
```
Case:  new → running → done
                  → failed
Suite: new → running → done      (旗下 cases 全部 done)
                  → interrupt (任一 case 失败 / 手动停止)
Plan:  new → running → done      (旗下 suites 全部 done)
                  → interrupt (手动停止)
```

#### 约束
- 非 running 的 Suite 中的 Case 不可运行；停止时强制标记 running cases 为 failed
- 非 running 的 Plan 中的 Suite 不可运行；停止时强制中断 running suites
- Plan `suite_start_mode=auto` 时启动自动启动根 Suite
- Plan 创建时 `allocated_capital` 必须 ≤ 账户空闲资金（三层行级锁保证并发安全）
- Suite 加入 Plan 时，其 `allocated_capital` 必须 ≤ Plan 空闲资金

### 2.10.9 执行日志模块
- 执行日志列表：`GET /api/execution/logs/`
- 委托单列表：`GET /api/execution/orders/`
- 运行记录列表：`GET /api/execution/runs/`
- 触发执行：`POST /api/execution/trigger/`

### 2.10.10 触发执行模块
- 手动触发 Plan：`POST /api/execution/trigger/`
- 查询运行状态：`GET /api/execution/run/<run_id>/`
- 启动执行：`POST /api/execution/run/<run_id>/start/`
- 处理事件：`POST /api/execution/run/<run_id>/process/`

### 2.10.10 事件类型管理模块
- 事件类型列表：`GET /api/execution/event-types/list-all/`
- 事件类型 CRUD：`GET /api/execution/event-types/`、`POST /api/execution/event-types/`、`PATCH /api/execution/event-types/<id>/`、`DELETE /api/execution/event-types/<id>/`
- 说明：当前前端为只读展示，优先使用 `list-all` 接口，避免直接操作管理型接口。

### 2.10.11 接口使用约束
- 所有前端页面应按上述接口路径访问后端，不得凭空新增与后端不一致的 URL。
- 所有非 GET 请求都必须携带 Django CSRF Token；同源 Session Cookie 需保持开启。
- 页面初始化时，应优先调用当前登录态接口，并在失败时跳转到登录页。
- 需要统一处理响应结构、分页、错误提示与空状态。

### 2.10.12 结构化 JSON 约束（必须遵守）
- `Case.params` 仅允许字段：`trigger`、`period`、`threshold_oversold`、`threshold_overbought`、`direction`、`result`、`order`。
- `Case.params.trigger` 仅允许 `event_type`，且必须已在 `EventRegistry` 中注册。
- `Plan.symbol_scope.type` 仅允许：`all`、`groups`、`symbols`；对应字段必须为 `type` + `group_ids` 或 `type` + `symbol_codes`。
- `Edge.event_condition` 仅允许：`event_type`、`case_id`、`next_event`。
- 前端表单在提交前必须做白名单校验，避免提交自由 JSON 导致后端 `ValidationError` 或执行链断裂。
- 当前前端已在 Case / Plan 表单中接入对应的白名单校验逻辑，避免用户提交非法字段。

### 2.10.13 资金占用管理模块（v2.1 新增）
对应后端分级资金占用链：**Plan 占用账户资金 → Suite 向 Plan 申请 → Case 向 Suite 申请**；运行时下单金额按 Case → Suite → Plan 逐级原子扣减，三级都不足时订单被拒。

#### 数据契约
- `FundAllocation` 字段：`level`（`plan` / `suite` / `case`）、`plan`、`suite`（case/suite 级必填）、`case`（case 级必填）、`amount`（申请额度，字符串金额）、`used_amount`（已占用，只读）、`status`（`active` / `released`，只读）。
- `PlanItem` 新增：`account_id`（交易账户 ID，可空）、`allocated_capital`（占用资金总额，可空；留空表示不启用资金管控）。
- `Order` 新增：`fund_allocation`（下单时实际扣减的额度记录 ID，审计用）。

#### 接口
- 资金申请列表：`GET /api/execution/fund-allocations/`（支持 `plan` / `suite` / `case` / `level` / `status` 过滤）
- 新增申请：`POST /api/execution/fund-allocations/`（后端统一执行层级校验：父额度存在且子级申请总额不超过父额度）
- 更新申请：`PATCH /api/execution/fund-allocations/<id>/`
- 删除申请：`DELETE /api/execution/fund-allocations/<id>/`

#### 页面实现（`src/views/FundAllocations.vue`，路由 `/funds`）
- 列表：层级彩色标签（Plan 级 / Suite 级 / Case 级）、Plan / Suite / Case ID、申请额度、**已占用 / 剩余**（前端计算 `amount - used_amount`）、状态标签。
- 新增 / 编辑弹窗：按层级切换必选项——Plan 级仅选 Plan；Suite 级选 Plan + Suite；Case 级选 Plan + Suite + Case；编辑时层级不可改。提交前做必填校验（层级 → 对应父级 → 额度）。
- 后端层级校验失败（如「Suite 申请 2000 超过 Plan 剩余额度」）时，错误消息透传到 `ElMessage` 展示。
- Plan / Suite / Case 下拉数据分别在页面挂载时从 `/api/plans/`、`/api/suites/`、`/api/cases/` 拉取，兼容数组与分页（`results`）两种响应结构。

#### Plan 管理页联动（`src/views/Plans.vue`）
- 表单新增「交易账户 ID」（文本，留空则不绑定）与「占用资金总额」（数字，两位小数，留空则不启用资金管控）。
- 列表新增「账户 ID」「占用资金」两列，空值显示 `—`。

### 2.10.14 告警管理 / 告警渠道模块（v2.3 新增）

对接后端 `execution.Alert` 与 `execution.AlertChannel`，实现告警的集中查看、处理与送达渠道配置。

#### 数据契约
- `Alert` 字段：`alert_type`（`order_failed` / `suite_failed` / `plan_failed` / `risk_violation` / `system_error`）、`severity`（`low` / `medium` / `high` / `critical`）、`status`（`pending` / `acknowledged` / `resolved`）、`title`、`message`、`error_code`、`plan` / `plan_name`、`suite_run`、`order`、`in_app_notified`、`email_notified`、`notification_error`、`acknowledged_by/at`、`resolved_by/at`、`created_at/updated_at`，以及 `*_display` 展示字段。
- `AlertChannel` 字段：`channel_type`（`in_app` / `email`，唯一）、`is_enabled`、`email_recipients`（邮件渠道收件人列表）、`email_subject_prefix`、`min_severity`（最低级别）、`alert_types`（类型白名单，空 = 全部）。

#### 接口
- 告警列表：`GET /api/execution/alerts/`（支持 `alert_type` / `severity` / `status` / `plan` 过滤与 `search` 搜索）
- 告警详情：`GET /api/execution/alerts/<id>/`
- 告警统计：`GET /api/execution/alerts/statistics/`（返回 `overview` + `by_type`）
- 告警操作（确认 / 解决）：`POST /api/execution/alerts/<id>/actions/`
- 重新发送通知：`POST /api/execution/alerts/<id>/resend-notifications/`
- 渠道列表：`GET /api/execution/alert-channels/`
- 渠道新增 / 更新 / 删除：`POST /api/execution/alert-channels/`、`PATCH /api/execution/alert-channels/<id>/`、`DELETE /api/execution/alert-channels/<id>/`
- 渠道重载：`POST /api/execution/alert-channels/reload/`

#### 页面实现
- 告警管理（`src/views/Alerts.vue`，路由 `/alerts`）：统计卡片 + 筛选工具栏 + 告警表格；行内确认 / 解决（备注弹窗）/ 详情；详情对话框展示字段与消息正文，支持重新发送通知。
- 告警渠道（`src/views/AlertChannels.vue`，路由 `/alert-channels`）：渠道表格；新增 / 编辑弹窗（邮件渠道逐行收件人 + 前端邮箱格式校验）；删除二次确认；"重新加载"按钮调用渠道重载接口。
- 侧边导航（`src/layouts/DefaultLayout.vue`）与路由（`src/router/index.ts`）：新增「告警管理」「告警渠道」菜单与 `/alerts`、`/alert-channels` 路由。

## 三、交互与反馈要求

1. 所有异步操作（加载、提交、删除等）应有明确的加载状态。可使用按钮 Loading、骨架屏或文本提示。
2. 成功和失败时均应给出明确的视觉反馈，如 `ElMessage` / `ElNotification`。
3. 删除、发布等不可逆操作前必须弹出二次确认窗口。
4. 表单提交前应执行基本客户端校验：必填项、格式、长度和 JSON 语法。
5. 列表为空时应显示友好的空状态提示。
6. 所有非 GET 请求需在前端附带 Django CSRF Token。

## 四、数据展示要求

1. 列表数据支持分页，每页默认 20 条，可配置。
2. 表格支持列排序，例如按时间、名称和状态进行排序。
3. 状态类字段使用不同颜色标签区分：
   - 成功：绿色
   - 失败：红色
   - 草稿：灰色
   - 已发布：蓝色
4. JSON 数据展示时保持可读性，要求缩进和换行。
5. 关键字段应支持展示标签、悬浮提示和简短摘要。

## 五、响应式与可用性要求

1. 默认适配桌面端，支持移动端响应式布局。
2. 移动端下，侧边导航应折叠成图标模式或隐藏。
3. 表单弹窗在移动端应全屏显示，或占屏幕 90% 以上宽度。
4. 表格在窄屏下支持水平滚动。
5. 所有交互区域应满足最小点击热区和较好的可访问性。

## 六、数据流转说明

1. 所有数据均通过 RESTful API 与后端交互。
2. 用户登录后，所有请求都应携带身份凭证（Session / Cookie）。
3. 页面初始化时自动获取当前用户信息。
4. 各模块的数据加载应独立并行加载，互不阻塞。
5. 非 GET 请求必须包含 Django 的 CSRF Token。
6. API 请求失败时，前端需统一抓取错误状态并展示通知。

## 七、前端实现约束

### 7.1 技术要求
- 前端框架：Vue 3 + Composition API
- 路由：Vue Router 4
- 状态管理：Pinia
- UI：Element Plus
- HTTP：Axios
- 图表：Apache ECharts（Canvas 渲染，适用于 K 线、成交量和分时场景）
- 生产构建：Vite

### 7.2 接口约束
- 所有后端 API 统一以 `/api/` 开头。
- 登录态由 Django Session 维护。
- `withCredentials: true` 必须开启。
- 统一处理分页响应、错误响应、空数据状态。

### 7.3 通用页面规范
- 每个模块页面均应包含：
  - 表头操作栏
  - 查询/筛选区
  - 表格或列表区
  - 分页器
  - 空状态
  - 错误状态和加载状态

## 八、后续实现优先级

### P0：主流程闭环
1. 用户认证
2. 标的管理
3. 分组管理
4. Case / Suite / Plan 基础 CRUD
5. 执行日志与手动触发
6. ✅ Suite 拓扑可视化编排（策略设计器，画布拖拽 + 执行轨迹回放）

### P1：战略增强
1. Plan 发布与运行状态追踪
3. 事件类型只读列表
4. 更丰富的表单校验和提示

### P2：体验提升
1. 自动刷新
2. 详情抽屉/弹窗增强
3. 移动端细节优化
4. 性能优化与代码分割

## 九、验收标准

前端实现完成时，需满足以下验收点：

- 侧边导航可折叠，且状态持久化
- 登录/注册/登出/个人资料流程可用
- 标的、分组、Case、Suite、Plan、执行日志、触发执行、事件类型、告警管理及告警渠道、策略设计器均具备对应界面
- 异步状态、二次确认、空状态和错误提示具备完整交互
- 所有页面适配桌面端与移动端
- 所有非 GET 请求附带 CSRF Token
- 前端构建成功，页面可从根路径访问，资源路径稳定

## 十、参考资源

- Vue 3 官方文档
- Vue Router 官方文档
- Pinia 官方文档
- Element Plus 官方文档
- Axios 官方文档
- Vite 官方文档
- Django REST Framework 文档
