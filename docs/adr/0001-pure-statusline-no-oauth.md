# 纯状态行插件，不做 OAuth，不依赖 dsh-kimi-subscription

dsh-tui 里看不到 Kimi 订阅用量，根因不是认证模式——现有的 `kimi-coding` 路由已经走订阅端点，key 也是订阅体系——而是没有任何组件去拉 `/usages`。因此本插件只做一件事：用 host 凭据服务（`ctx.credentials.resolve`，与 llm-pi-ai 同一条取 key 路径）拿现有 key，每 60 秒拉一次用量读数，经 `ctx.tuiStatus.set()` 渲染在输入框上方的状态行。

## Considered Options

- **复用 dsh-kimi-subscription**：它的 OAuth 设备登录、凭据刷新、用量拉取都已实现，但 UI 层是 web client（React 设置页 + 输入框徽章），dsh-tui 渲染不了；复用等于把它的 UI 在 TUI 重写一遍，且其 host 行在 TUI profile 下能否干净组合未经验证。对本插件的目标（看用量）而言是过度依赖。
- **自建 OAuth 设备登录**：kimi-code CLI 的 OAuth 流程未公开文档化，需要逆向并自行维护刷新逻辑；而用户的订阅 API Key 已能调通 `/usages`，OAuth 不解决任何现有痛点。
- **写入底部栏（模型/上下文/费用一行）**：该栏经核实不对插件开放，插件可用的状态行接缝只有"输入框上方一行"（`ctx.tuiStatus`，tui.dsh/v1alpha1 已冻结的公开面）。位置差异是可接受的：用量是低频常驻信息，输入框上方正是视线落点。

## Consequences

- 订阅 API Key 轮换或失效时插件不做补救，只静默隐藏或标记陈旧读数；用户按 dsh-tui 既有方式换 key 即可。
- 若未来要把计费也切成订阅 OAuth 登录（而不只是看用量），那是另一个插件的事，与本插件不冲突。
