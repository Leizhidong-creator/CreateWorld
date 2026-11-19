# 技术示例与真实验收

`harbor.json` 与 `station.json` 是相同 runtime 下的两个可替换题材，资源均取自本目录 `assets/`，不需要远程 CDN。它们是约 5 分钟、占位美术的框架回归示例，不代表工作台正式的 10–20 分钟制作目标。`journeys.json` 按 `config` 字段区分每套配置的两条结局路线。

- 核心回归：`node --import tsx --test tests/runtime*.test.ts`。
- 真实浏览器边界验收：`node --import tsx scripts/runtime-acceptance.ts`。默认调用本机 Chrome，macOS 路径可用 `CW_CHROME_PATH` 改写；会开启浏览器窗口。
- `runtime-acceptance/<时间>/` 为每次测试的独立构建、真实输入证据和截图。脚本不改游戏状态；CDP 仅发送实际触屏事件，游戏观察器只读。双指证据来自桌面 Chrome 的触屏协议，尚不等于物理手机验收。
- 双结局操作由宿主 `packages/browser-runner/testBuild` 执行：真实方向键导航、E 交互、DOM 点击选择，检查地图/暂停/刷新与两个结局。没有调用设置状态或跳关接口。
- `verify-upstream-baseline.mjs` 为原 ZIP 的启动检查辅助脚本；需要将原包临时解压至 `.source-baseline/` 才能执行。源码原包不随框架重复分发；已完成检查的记录位于 `provenance/baseline/`，范围仅标题进入 `livingRoom`。
