# dsh-tui-kimi-usage

Kimi Code 订阅的 5h / 7d 配额窗口，常驻在 dsh-tui 输入框上方的状态行（`tuiStatus.registerView` 富文本视图，进度条与配色跟随主题；旧版宿主或视图行预算耗尽时自动退回 `set()` 纯文本格）：

```text
kimi 5h █████ 98% ↻21:46 · 7d ███░░ 60% ↻10-29
```

纯状态行插件：不接管模型路由、不做 OAuth 登录、不发 toast。凭据经 host 凭据服务解析，与 `kimi-coding` 路由同源——你已经有可用的订阅 key 时，装上就能看到用量。

术语见 [GLOSSARY.md](./GLOSSARY.md)；"为什么不做 OAuth / 为什么不复用 dsh-kimi-subscription"见 [docs/adr/0001](./docs/adr/0001-pure-statusline-no-oauth.md)。

## 安装

```sh
dsh plugin --profile dsh-tui add /absolute/path/to/dsh-tui-kimi-usage
```

重启 dsh-tui（`dt`）后生效。

## 配置

在 `~/.dsh/profiles/dsh-tui/cordis.patch.yml` 里按 id 覆盖（不要插入第二行同 id 条目）：

```yaml
- id: kimi-usage
  config:
    refreshSeconds: 120
```

| 配置 | 默认 | 说明 |
| --- | --- | --- |
| `baseUrl` | `https://api.kimi.com/coding/v1` | 订阅端点根地址 |
| `apiKeyEnv` | `KIMI_CODING_API_KEY` | 凭据引用名（host 凭据服务解析，环境变量兜底） |
| `refreshSeconds` | `60` | 轮询间隔，30–600 |
| `format` | `full` | `full` 带重置时间；`compact` 为 `kimi 98/60` |
| `warnThreshold` | `90` | 已用百分比达到该值时变告警色（文本模式加 `!`） |

## 行为约定

- 无凭据 / 首次拉取失败：整格隐藏（读数缺失不等于额度为零）；
- 后续拉取失败：保留最后一次成功读数，尾部加 ` ?`；
- 任一窗口已用 ≥ `warnThreshold`：该窗口变黄色告警（≥99 变红；文本模式加 `!`）；
- 重置时间：当天 `↻HH:mm`，跨天 `↻MM-dd`（本地时区）。

## 开发

```sh
pnpm install  # 必须：本地 link: 安装按真实路径解析依赖，host 共享层
              # （~/.dsh/profiles/node_modules）覆盖不到，peer 依赖
              # 要靠本仓库 devDependencies 里的副本解析
pnpm test     # node --test，纯函数，不依赖 TUI
```

改完源码无需重装（link: 实时生效），重启 `dt` 即可看到改动。
