export const CASE_ALLOWED_KEYS = [
  'trigger',
  'period',
  'threshold_oversold',
  'threshold_overbought',
  'direction',
  'result',
  'order',
] as const

export const CASE_TRIGGER_ALLOWED_KEYS = ['event_type'] as const
export const CASE_ORDER_ALLOWED_KEYS = ['direction', 'price', 'volume'] as const

export const PLAN_SCOPE_ALLOWED_KEYS = ['type', 'group_ids', 'symbol_codes'] as const
export const SUITE_EVENT_CONDITION_ALLOWED_KEYS = ['event_type', 'case_id', 'next_event'] as const

function ensureObject(value: unknown, label: string) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} 必须是 JSON 对象`)
  }
}

export function parseJsonObject(raw: string, label: string): Record<string, unknown> {
  if (!raw || !raw.trim()) {
    throw new Error(`${label} 不能为空`)
  }

  try {
    const parsed = JSON.parse(raw)
    ensureObject(parsed, label)
    return parsed as Record<string, unknown>
  } catch (error) {
    const message = error instanceof Error ? error.message : 'JSON 格式错误'
    throw new Error(`${label}: ${message}`)
  }
}

export function validateCaseParamsJson(raw: string) {
  const value = parseJsonObject(raw, 'Case.params')
  const unknown = Object.keys(value).filter((key) => !(CASE_ALLOWED_KEYS as readonly string[]).includes(key))
  if (unknown.length) {
    throw new Error(`Case.params 不允许的字段: ${unknown.join(', ')}`)
  }

  if ('trigger' in value) {
    const trigger = value.trigger
    ensureObject(trigger, 'Case.params.trigger')
    const triggerKeys = Object.keys(trigger as Record<string, unknown>)
    const triggerUnknown = triggerKeys.filter((key) => !(CASE_TRIGGER_ALLOWED_KEYS as readonly string[]).includes(key))
    if (triggerUnknown.length) {
      throw new Error(`Case.params.trigger 不允许的字段: ${triggerUnknown.join(', ')}`)
    }
    if (typeof (trigger as Record<string, unknown>).event_type !== 'string' || !(trigger as Record<string, unknown>).event_type) {
      throw new Error('Case.params.trigger.event_type 必须是非空字符串')
    }
  }

  if ('period' in value) {
    const period = value.period
    if (typeof period !== 'number' || Number.isNaN(period) || !Number.isInteger(period) || period < 1) {
      throw new Error('Case.params.period 必须是大于等于 1 的整数')
    }
  }

  if ('direction' in value) {
    const direction = value.direction
    if (direction !== -1 && direction !== 0 && direction !== 1) {
      throw new Error('Case.params.direction 必须是 -1、0 或 1')
    }
  }

  if ('order' in value) {
    const order = value.order
    ensureObject(order, 'Case.params.order')
    const orderUnknown = Object.keys(order as Record<string, unknown>).filter(
      (key) => !(CASE_ORDER_ALLOWED_KEYS as readonly string[]).includes(key),
    )
    if (orderUnknown.length) {
      throw new Error(`Case.params.order 不允许的字段: ${orderUnknown.join(', ')}`)
    }
    const required = ['direction', 'price', 'volume']
    const missing = required.filter((key) => !(key in (order as Record<string, unknown>)))
    if (missing.length) {
      throw new Error(`Case.params.order 缺少字段: ${missing.join(', ')}`)
    }
    if ((order as Record<string, unknown>).direction !== 'buy' && (order as Record<string, unknown>).direction !== 'sell') {
      throw new Error('Case.params.order.direction 必须是 buy 或 sell')
    }
    const volume = (order as Record<string, unknown>).volume
    if (typeof volume !== 'number' || !Number.isInteger(volume) || volume < 1) {
      throw new Error('Case.params.order.volume 必须是大于等于 1 的整数')
    }
  }

  return value
}

export function validatePlanSymbolScopeJson(raw: string) {
  const value = parseJsonObject(raw, 'Plan.symbol_scope')
  const unknown = Object.keys(value).filter((key) => !(PLAN_SCOPE_ALLOWED_KEYS as readonly string[]).includes(key))
  if (unknown.length) {
    throw new Error(`Plan.symbol_scope 不允许的字段: ${unknown.join(', ')}`)
  }

  const type = value.type
  if (type !== 'all' && type !== 'groups' && type !== 'symbols') {
    throw new Error('Plan.symbol_scope.type 必须是 all、groups 或 symbols')
  }

  if (type === 'all' && Object.keys(value).length !== 1) {
    throw new Error('all 类型只能包含 type 字段')
  }

  if (type === 'groups') {
    if (!Array.isArray(value.group_ids)) {
      throw new Error('groups 类型必须提供 group_ids 数组')
    }
  }

  if (type === 'symbols') {
    if (!Array.isArray(value.symbol_codes)) {
      throw new Error('symbols 类型必须提供 symbol_codes 数组')
    }
  }

  return value
}

export function validateSuiteEventConditionJson(raw: string) {
  const value = parseJsonObject(raw, 'Edge.event_condition')
  const unknown = Object.keys(value).filter((key) => !(SUITE_EVENT_CONDITION_ALLOWED_KEYS as readonly string[]).includes(key))
  if (unknown.length) {
    throw new Error(`event_condition 不允许的字段: ${unknown.join(', ')}`)
  }

  if (typeof value.event_type !== 'string' || !value.event_type) {
    throw new Error('event_condition.event_type 是必填字段')
  }

  if ('case_id' in value && (typeof value.case_id !== 'number' || Number.isNaN(value.case_id) || !Number.isInteger(value.case_id))) {
    throw new Error('event_condition.case_id 必须是整数')
  }

  if ('next_event' in value && (typeof value.next_event !== 'string' || !value.next_event)) {
    throw new Error('event_condition.next_event 必须是非空字符串')
  }

  return value
}
