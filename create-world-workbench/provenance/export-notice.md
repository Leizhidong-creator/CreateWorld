# 源码来源与使用范围说明

本游戏包含 Create World runtime 2 的代码。其来源分为既有 Pixel Story Kit 的适配、新实现，以及用户提供的《高墙之外》源码审查；不能把所有模块统称为直接提取的原项目源码。本通知与 `provenance/source.json`、`provenance/legacy-kit-license-notice.txt` 必须随本包保留。

## 原始来源

- 原仓库：SSxs-wym/Beyond-The-Walls-，https://github.com/SSxs-wym/Beyond-The-Walls-
- 既有 kit 固定参考提交：`93cf4540e8c1d64e0b45844ddb1b14eaf06177d5`。
- 本轮审查来源：用户提供的 `高墙之外_源码版.zip`，SHA-256 `637a3d3082f1c8a33a2ce4c9dbf04e57f17dce0fc3808882205472eaf9d36187`。
- ZIP 主要代码：`shawshank_pixel_escape/js/main.js`（16,678 行）、`shared/global-controls.js`。

## 运行时代码迁移

| 导出文件 | 来源与处理 |
| --- | --- |
| runtime/controls.js | 沿用 kit 对原 global-controls 的 ESM 适配，保留独立指针、context/adapter/release/destroy 职责；新增测试选择器与本地资源路径。 |
| runtime/input.js、events.js、resources.js、minigames.js | 迁移 kit 实现；小游戏宿主参考原 main.js 中挂载、失效令牌与销毁职责，未包含原作三个具体小游戏或 React runtime。 |
| runtime/geometry.js | 参考原脚点、走区多边形与圆障碍职责，经统一世界坐标重构；新增圆形脚底完整检测、分步移动、坐标转换。 |
| runtime/render.js、animation.js | 从 kit 渲染适配，新增方向帧 atlas、脚点、前景遮挡和背景/碰撞分离。 |
| runtime/state.js | 重新实现候选事务、条件、不变量、一次性奖励和延迟事件；不沿用原作人物或剧情布尔字段。 |
| runtime/engine.js、ui.js、storage.js、validate.js | 从 kit 适配并升级，新增只读观察、恢复待处理指令、配置检查与统一流程。 |

导出器、内容配置和新创作的素材不因此取得原项目的名称、剧情、美术或音乐授权。本包没有附带原游戏的角色图、场景图、音乐、Fusion Pixel 字体或具体小游戏。对于另行加入的素材、扩展和剧情，应保留各自来源与适用说明。

## 保留原授权状态

既有 Pixel Story Kit 保留的来源记录指出：上述固定 GitHub 版本的 package.json 标记 `UNLICENSED`，README 不授予代码与原创资源的开源许可，并保留复制、修改、分发和商业使用权。原通知逐字保存在 `provenance/legacy-kit-license-notice.txt`。

本轮收到的 ZIP 未附 README/LICENSE/package.json；缺少许可文件不表示获得了开源许可。此导出不为原有源码或派生部分新增 MIT、Apache 等许可，也不代表权利人授予新的使用权限。保留来源说明不等于获得授权；本工具不扩大来源代码的许可范围。
