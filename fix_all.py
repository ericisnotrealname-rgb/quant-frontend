import pathlib

# Fix Suites.vue - add missing functions
p = pathlib.Path("src/views/Suites.vue")
content = p.read_text(encoding="utf-8")

# Add runStatusType and runStatusLabel after statusType
old = """function aggregateLabel(value: string) {
  return ({ weighted_sum: '加权求和', vote: '投票', and: '逻辑与', or: '逻辑或' } as Record<string, string>)[value] || value
}"""
new = """function aggregateLabel(value: string) {
  return ({ weighted_sum: '加权求和', vote: '投票', and: '逻辑与', or: '逻辑或' } as Record<string, string>)[value] || value
}

function runStatusLabel(value: string) {
  return ({ new: '草稿', running: '运行中', done: '已完成', interrupt: '已中断', failed: '失败' } as Record<string, string>)[value] || value
}

function runStatusType(value: string) {
  return ({ new: 'info', running: 'primary', done: 'success', interrupt: 'warning', failed: 'danger' } as Record<string, string>)[value] || 'info'
}

async function start(id: number) {
  try {
    await fetch(`/api/suites/${id}/start/`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'X-CSRFToken': document.cookie.match(/csrftoken=([^;]+)/)?.[1] || '' },
    })
    ElMessage.success('Suite 已启动')
    await loadData()
  } catch (error) {
    ElMessage.error('启动失败')
  }
}

async function stop(id: number) {
  try {
    await fetch(`/api/suites/${id}/stop/`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'X-CSRFToken': document.cookie.match(/csrftoken=([^;]+)/)?.[1] || '' },
    })
    ElMessage.success('Suite 已停止')
    await loadData()
  } catch (error) {
    ElMessage.error('停止失败')
  }
}"""
content = content.replace(old, new)
p.write_text(content, encoding="utf-8")
print("Suites.vue fixed")

# Fix Plans.vue - trigger_type issue
p2 = pathlib.Path("src/views/Plans.vue")
content2 = p2.read_text(encoding="utf-8")

# Fix the trigger_type type issue by adding type assertion
content2 = content2.replace(
    "const form = ref({ name: '', trigger_type: 'time', cron_expr: null, root_suite: null, symbol_scope: { type: 'all' } as PlanItem['symbol_scope'], account_id: '', allocated_capital: null, suite_start_mode: 'manual' as PlanItem['suite_start_mode'] })",
    "const form = ref({ name: '', trigger_type: 'time' as const, cron_expr: null, root_suite: null, symbol_scope: { type: 'all' } as PlanItem['symbol_scope'], account_id: '', allocated_capital: null, suite_start_mode: 'manual' as PlanItem['suite_start_mode'] })"
)
p2.write_text(content2, encoding="utf-8")
print("Plans.vue fixed")
