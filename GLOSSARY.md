# dsh-tui-kimi-usage

dsh-tui 的状态行插件：在输入框上方常驻显示 Kimi Code 订阅的配额窗口余量。本文件只定义领域语言，不含实现细节。

## Language

**5h 窗口**:
订阅的滚动 5 小时配额窗口，含已用比例与重置时间。决定"现在还能不能造"。
_Avoid_: 短窗口、rate limit、5 小时额度

**7d 窗口**:
订阅的滚动 7 天配额窗口，含已用比例与重置时间。决定"这周要不要省着点"。
_Avoid_: 周窗口、周额度、weekly quota

**加量包**:
服务端可能额外返回的一次性配额。当前账号未出现过，插件只定义不显示。
_Avoid_: 加油包、booster

**订阅端点**:
Kimi Code 订阅 API 的根地址，默认 `https://api.kimi.com/coding/v1`。与按量计费的 Open Platform（`api.moonshot.cn`）是两套凭据与额度体系，不混用。
_Avoid_: API 地址、base URL（实现细节词，不进术语表）

**用量读数**:
一次 `/usages` 拉取得到的快照，含 5h 窗口与 7d 窗口各一份。读数缺失不等于额度为零。
_Avoid_: 余额、额度快照
