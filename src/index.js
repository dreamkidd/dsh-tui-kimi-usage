/**
 * dsh-tui-kimi-usage — Kimi Code 订阅配额窗口的状态行插件。
 *
 * 优先以富文本视图渲染在输入框上方（`ctx.tuiStatus.registerView`，接缝
 * 十一）：`kimi 5h ████▎85% ↻21:46 · 7d █▏17% ↻10-29`，配色用语义色
 * 跟随主题；宿主无 registerView（旧版）或被拒（行预算耗尽）时退回纯文本
 * `set()` 格。
 *
 * 凭据走 host 凭据服务 `ctx.credentials.resolve(apiKeyEnv)`——与
 * llm-pi-ai 的 kimi-coding 路由同一条取 key 路径（先凭据库后环境变量）；
 * 服务缺席时兜底 process.env。不解析 credentials.yaml，不缓存凭据
 * （每次拉取前重新 resolve，轮换即生效）。
 *
 * 行为约定（Q5/Q13 决策）：
 * - 无凭据：整格隐藏；
 * - 首次拉取失败：隐藏（读数缺失不等于额度为零）；
 * - 后续失败：保留最后一次成功读数，尾部加 ` ?`；
 * - 不发 toast、不写转录、不钩会话事件。
 *
 * 设计依据见 docs/adr/0001-pure-statusline-no-oauth.md。
 *
 * @module dsh-tui-kimi-usage
 */
import z from '@deepseek-ai/schemastery'
import { fetchUsage } from './usage.js'
import { formatStatus } from './format.js'
import { buildUsageView } from './view.js'

export const name = 'kimi-usage'

const DEFAULT_BASE_URL = 'https://api.kimi.com/coding/v1'

export const Config = z.object({
  baseUrl: z.string().default(DEFAULT_BASE_URL),
  apiKeyEnv: z.string().default('KIMI_CODING_API_KEY'),
  refreshSeconds: z.number().min(30).max(600).default(60),
  format: z.union(['full', 'compact']).default('full'),
  warnThreshold: z.number().min(0).max(100).default(90),
})

/** 状态行条目的 key，按插件名空间约定命名。 */
const STATUS_KEY = 'kimi-usage'

/**
 * 经 host 凭据服务解析凭据引用；服务缺席时兜底进程环境变量。
 * CredentialRef 是编译期 brand，运行时就是字符串，直接传入。
 *
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @param {string} envName
 * @returns {Promise<string | undefined>}
 */
async function resolveApiKey(ctx, envName) {
  const credentials = ctx.get('credentials', false)
  if (credentials) {
    try {
      const hit = await credentials.resolve(/** @type {any} */ (envName))
      if (hit?.value) return hit.value
    } catch {
      // 凭据服务拒绝该引用时退回环境变量，不让一格状态行拖垮插件。
    }
  }
  const fromEnv = process.env[envName]
  return fromEnv && fromEnv.length > 0 ? fromEnv : undefined
}

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @param {z.infer<typeof Config>} config
 */
export function apply(ctx, config) {
  // 无 TUI 组合（headless、其他内核）时静默不挂——这不是错误。
  // 真实 TUI 里 tuiStatus 由 dsh-tui-extensions 行在 UI 初始化阶段注册，
  // 晚于本插件行的 apply：apply 时拿不到不等于永远没有，bootstrap 会持续
  // 探测直到拿到为止（dsh-tui-find 同样靠延迟定时器绕开这个时序）。
  let status = ctx.get('tuiStatus', false)
  const acquire = () => {
    if (!status) status = ctx.get('tuiStatus', false)
    return status
  }

  const baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '')
  const apiKeyEnv = config.apiKeyEnv ?? 'KIMI_CODING_API_KEY'
  const format = config.format ?? 'full'
  const warnThreshold = config.warnThreshold ?? 90
  const refreshMs = (config.refreshSeconds ?? 60) * 1000

  /** 上一次成功解析的用量读数；陈旧渲染与"是否首次成功"的判定都靠它。 */
  let lastReading
  /** 首格是否已落定（首次拿到 key 并完成一次渲染决策）。 */
  let settled = false

  // ---- 视图模式的状态存储（useSyncExternalStore 契约：emit 间快照引用稳定） ----
  let hidden = true
  let stale = false
  let snapshot = { hidden: true }
  const listeners = new Set()
  const store = {
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getSnapshot: () => snapshot,
  }
  const publish = () => {
    snapshot = hidden
      ? { hidden: true }
      : { hidden: false, reading: lastReading, stale, format, warnThreshold }
    for (const listener of listeners) listener()
  }

  // ---- 渲染模式：富文本视图优先，纯文本兜底 ----
  /** @type {'view' | 'text' | undefined} */
  let mode
  let viewDispose
  /** 文本兜底：上一次写入的 disposer 与文本（去重避免闪烁与 effect 堆积）。 */
  let textDispose
  let lastText

  const writeText = (text) => {
    if (text === undefined) {
      textDispose?.()
      textDispose = undefined
      return
    }
    const dispose = status.set(STATUS_KEY, text, ctx)
    textDispose?.()
    textDispose = dispose
  }

  /** 拿到接缝后确定一次渲染模式；registerView 不可用/被拒/抛错都退回文本。 */
  const ensureMode = () => {
    if (mode || !acquire()) return mode
    if (typeof status.registerView === 'function') {
      try {
        const dispose = status.registerView(
          { key: STATUS_KEY, maxRows: 1, component: buildUsageView(store) },
          ctx,
        )
        if (dispose !== undefined) {
          mode = 'view'
          viewDispose = dispose
        } else {
          // 宿主拒绝不抛错（行预算耗尽等），warn 在它内部。
          mode = 'text'
        }
      } catch {
        mode = 'text'
      }
    } else {
      mode = 'text'
    }
    return mode
  }

  /**
   * 渲染一次意图：hidden 为整格隐藏。服务未就绪时只记状态，由 bootstrap
   * 拿到接缝后补渲染。
   */
  const render = (nextHidden, nextStale = false) => {
    hidden = nextHidden
    stale = nextStale
    settled = true
    if (!ensureMode()) return
    if (mode === 'view') {
      publish()
      return
    }
    const text = hidden
      ? undefined
      : formatStatus(lastReading, { format, warnThreshold, stale })
    if (text === lastText) return
    lastText = text
    writeText(text)
  }

  const tick = async () => {
    const apiKey = await resolveApiKey(ctx, apiKeyEnv)
    if (!apiKey) {
      render(true)
      return
    }
    try {
      lastReading = await fetchUsage(baseUrl, apiKey)
      render(false)
    } catch {
      // 首次失败整格隐藏；后续失败保留最后读数并标陈旧。
      render(!lastReading, true)
    }
  }

  const timer = setInterval(() => void tick(), refreshMs)
  // apply 里不 await：耗时工作脱离组合流程启动（plugins.md 的组合约束）。
  void tick()

  // 首轮上屏前快速自举：tuiStatus 与 credentials 都晚于本行 apply 注册，
  // 首轮 tick 往往空跑；3 秒一档直到第一格落定，之后交给正常轮询。
  const bootstrap = setInterval(() => {
    if (!acquire()) return
    if (settled && ensureMode()) {
      render(hidden, stale) // 补渲染已落定的状态（view: publish 幂等）
      clearInterval(bootstrap)
    } else {
      void tick()
    }
  }, 3000)

  ctx.effect(
    () => () => {
      clearInterval(timer)
      clearInterval(bootstrap)
      viewDispose?.()
      writeText(undefined)
    },
    'kimi-usage status line',
  )
}
