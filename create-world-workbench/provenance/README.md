# 来源与迁移记录

本次权威审查输入是用户上传的 `高墙之外_源码版.zip`，精确 SHA-256、文件数及主文件长度见 source.json。原包完成静态源码审计，并通过独立Chrome真实点击/空格从标题进入livingRoom的启动检查，截图与原始观察在 baseline/；未覆盖房间移动、院子地图或完整主线。原包没有附 README/LICENSE/package.json，不能据此推定开源许可。

既有底座为旧版 Pixel Story Kit（2026-10-14；独立目录已于 2026-10-31 移除，来源记录转存于 `interstellar-dust/provenance/`），它记录参考 GitHub `SSxs-wym/Beyond-The-Walls-` commit `93cf4540e8c1d64e0b45844ddb1b14eaf06177d5`。该旧来源标记 UNLICENSED，README 不授予代码/原创资源复制、修改、分发或商用许可；本工作台保留来源状态，不新增 MIT 等再许可。新增 SVG/WAV 由旧 kit 脚本生成，不携带原电影/游戏美术音乐。来源记录不是权利授权证明。

| 目标模块 | 分类 | 来源及处理 |
| --- | --- | --- |
| runtime/controls.js | adapted | 沿用 kit 对原 shared/global-controls.js 的 ESM 适配；与本次 ZIP `shared/global-controls.js:28–224` 的独立指针、context/adapter/release/destroy 对照。本次原文件保存 upstream-global-controls.js.txt。新增测试选择器和自包含默认资源路径。 |
| runtime/input.js/events.js/resources.js/minigames.js | adapted | 迁移 kit 已验证实现；mini主机职责参考新ZIP main.js:10719–10854。保留无React的插件协议。 |
| runtime/geometry.js | adapted + new | 原ZIP main.js:12273 的多边形算法、12548 脚点走区/圆障碍职责，经统一世界坐标重构；新实现圆脚底整体验证、分步移动和坐标逆变换。不是整体搬运 main.js。 |
| runtime/render.js/animation.js | adapted + new | 迁移 kit 渲染，参考原精灵裁切/脚点职责；新增atlas方向帧、归一化脚点、前景层、背景与碰撞解耦。 |
| runtime/state.js | rewritten | 以kit通用状态职责重写候选事务、旧态guard、约束、延迟事件与once成功提交；不再使用原故事布尔字段。 |
| runtime/engine.js/ui.js/storage.js/validate.js | adapted | 迁移kit并接入新事务、几何和atlas；增加稳定测试入口和只读观察；存档兼容/配置检查升级。 |
| compiler/index.ts、fixtures/journeys.json | new | JSON编译、资源校验、独立静态导出、哈希清单与实际输入旅程。 |
| fixtures/harbor.json、station.json、assets | adapted | 将旧kit两套技术示例变为纯JSON，无原作电影人物。它们约5分钟、使用原型美术，并非正式10–20分钟成品。 |
| tests/runtime-legacy.test.ts、runtime-input.test.ts | adapted | 保留旧kit的36项行为回归，调整导入与DOM测试双；新增runtime.test.ts验证升级差异。 |

原ZIP的地图目标按任务名推断、硬编码背包与检查点、剧情分支、三个具体小游戏均未直接搬入核心。彩蛋/成就通用模型来自kit及新增，不能标成这份ZIP原有系统。调试器复用的是只读观察/节点回放职责；现版本只读观察已接入，原版调试跳转界面未随导出暴露。
