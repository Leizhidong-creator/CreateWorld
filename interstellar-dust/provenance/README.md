# 源码来源、改造范围与使用限制

固定参考版本：

- 仓库：https://github.com/SSxs-wym/Beyond-The-Walls-
- Commit：93cf4540e8c1d64e0b45844ddb1b14eaf06177d5
- 主代码：Beyond the wall/game/js/main.js
- 控件：Beyond the wall/shared/global-controls.js
- 样式：Beyond the wall/shared/styles.js

## 复用映射

| 本包 | 来源与处理 |
| --- | --- |
| src/controls.js | 直接改编 global-controls.js 的 mount、指针处理、适配器、状态与销毁逻辑；移除 window 单例与样式注入，改成 ESM 导出和可替换 SVG 路径。原文件完整保存为 upstream-global-controls.js.txt。 |
| src/input.js、geometry.js | 参考 main.js 输入归一化、松开停止和 X/Y 分轴移动，抽成独立接口；新增方向键/E、碰撞分步和测试。 |
| src/engine.js | 参考 createBaseScene 的生命周期、游戏帧循环及模态输入隔离；运行时状态和队列重新组织，以支持内容配置。 |
| src/ui.js | 抽取线性对话推进、成就列表、通知等行为；换为通用 DOM UI；新增关键选项与逐字显示。 |
| src/render.js 的 drawMap | 由院子地图的坐标映射、展开、地标、任务引导和探索记录逻辑重构；去除院子/NPC/任务 ID，采用区域级引导。 |
| src/state.js、storage.js | 基于原状态/检查点/成就职责重新设计，原先硬编码剧情字段改为配置实体与通用状态；加入一次性奖励、项目隔离及结构检查。 |
| src/minigames.js | 参考 MiniGameHost 的挂载、token 失效与销毁模式；去除 React 及具体小游戏分支，统一异步工厂与结果。 |
| 校验、基础 SVG/WAV、示例、文档、测试与脚本 | 此次新增。示例故事与程序生成的素材不取自原电影或原项目游戏画面。 |

upstream-main-excerpts.txt 保存了若干直接参考片段及原行号，便于对照；不是完整的上游工程。重构模块没有将原文件整体搬运，也不是声称其所有能力都能不经改造直接复用。

## 原授权状态保持不变

上游 package.json 标记 `UNLICENSED`。上游 README 明确：仓库代码与原创资源不提供开源许可，未经许可不得复制、修改、分发或用于商业用途。本包保留这一限制，未给上游源码或派生部分新增 MIT 等许可，也不代表权利人授予新的使用权限。

保留本来源目录及通知。后续转交、发布或商用须遵循来源代码适用的授权范围。本包 package.json 同样标记 UNLICENSED。

本版本不包含上游 React runtime、Fusion Pixel 字体、原场景/角色图片、原音乐或三个小游戏。运行无第三方包依赖，使用系统字体；因此没有随包捆绑那些第三方组件及其许可。新增外部依赖或素材时，应追加来源及相应许可全文。
