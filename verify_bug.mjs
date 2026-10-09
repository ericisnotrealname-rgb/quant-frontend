// 用同一套真实 vue-router 测试，验证「修复前的守卫」确实会死循环（回归防护有效性）
import { createRouter, createMemoryHistory } from 'vue-router'
const ROUTES = ['watchlist','login','setup']
function makeRouter(needsSetupValue, fixed) {
  let checked = false, setupRequired = null
  const auth = {
    get setupRequired() { return setupRequired },
    loadSetupStatus: async () => { if (checked) return setupRequired; checked = true; setupRequired = needsSetupValue; return setupRequired },
    loadProfile: async () => ({ username: 'u' }), user: { username: 'u' },
  }
  const router = createRouter({ history: createMemoryHistory(),
    routes: ROUTES.map(n => ({ path: '/' + n, name: n, component: {}, meta: {} })) })
  router.beforeEach(async (to) => {
    if (fixed) {
      const needsSetup = await auth.loadSetupStatus()
      if (needsSetup && to.name !== 'setup') return { name: 'setup' }
      if (!needsSetup && to.name === 'setup') return { name: 'login' }
    } else {
      // 修复前的原始写法（条件取反）
      if (to.name !== 'setup' && !(await auth.loadSetupStatus())) return { name: 'setup' }
      if (to.name === 'setup' && auth.setupRequired === false) return { name: 'login' }
    }
    if (auth.user) return true
    return { name: 'login' }
  })
  return router
}
for (const fixed of [false, true]) {
  const r = makeRouter(false, fixed)   // 已初始化（生产态）
  let err = null
  try { await r.push('/watchlist') } catch (e) { err = e }
  console.log(`${fixed?'修复后':'修复前'} -> 落点=${r.currentRoute.value.name} 报错=${err? err.message.slice(0,60):'无'}`)
}
