# 正式素材生产宿主

```ts
const result = await produceAssets({workspaceDir,skillsDir,config,plan,change,signal,onProgress,runModel,
  hostEvidenceDir: path.join(dataRoot, 'asset-evidence')});
// 宿主保存 result.config 并重新编译/通关；自行将 result 写 assets-manifest.json。
```

`runModel({prompt,images?,logDir,imageDir?})` 由 Codex App Server 适配器实现。第一调用按冻结技能用原生生图生产母版和候选记录；第二调用读取宿主最终图像，形成独立模型视觉报告。候选记录写入提示中指定的文件；函数还必须返回真实 `CodexResult`，至少包含 `items`（原生 `imageGeneration` 完成事件）和 `images:[{path,sha256}]`（宿主从事件结果保存的 PNG）。没有这两项，即使模型自报 generationCalls 和 passed 也拒绝接收。无工具、无法生图、视觉不通过均失败，不换付费 API，不画占位图。

## 运行依赖与权限

宿主需要 Node.js 24 或以上、项目 npm 依赖中的 sharp、可用的 Codex App Server，以及有 Pillow 10–12 的 Python 3。工作台不会自动安装软件或改变全局设置。Python 选择顺序为调用参数 `pythonExecutable`、环境变量 `CREATE_WORLD_PYTHON`、用户主目录下已存在的 Codex bundled Python 候选、PATH 中的解释器；Windows 先探测可用的 `python`，避免把 Microsoft Store 的 `python3` 别名当成运行时。仓库没有固定某位开发者的本机绝对路径；若所选环境缺 Pillow，生产停止并显示原脚本错误。

模型只获得候选 workspace 的写权限；`hostEvidenceDir` 必须在其外面，且应在同一数据根下跨 revision 保持稳定。直接调用未指定时默认 workspace 同级 `.asset-host-evidence`。部署者不得把这个目录再加入模型的可写根。冻结技能脚本只读，发行 manifest 中每个文件都先校验哈希。

计划路径与 `game.assets[].src` 均相对 `workspace/assets`，例如 `hero.png`、`scenes/library.png`。角色最终4×4 atlas；原3×4母版经过未改动的原 `build_character_pack.py`，宿主从源母版重新构建而非相信模型现成pack。方向合成只重排已通过的像素，脚点来自character.json，不自行假设底部。相位QA、透明、尺寸、调色板和动画检查保留。

场景要求scene.png与collision.json实际尺寸一致，最终像素必须等于原生母版或其最近邻整幅尺寸规范化；模型不能一边保留原生图片作来源、一边交付程序画的另一张图。宿主用原render完成几何验证与覆盖图，不再重复同一份validate；另按实际runtime碰撞体验证并核对红线像素不变量。旧脚底矩形锚点在底边；当前运行时为以脚点为圆心的圆。宿主额外将测试锚点下移r，用2r矩形覆盖居中圆，重跑完整身体路径检查。几何全部转换回world；仅接受当前框架支持的单个walkPolygon，多区域不可静默丢弃。每个出口/互动锚点必须用运行时ID；素材校正后的config必须重新编译并真实输入验收。

## 来源、严格 QA 与停止策略

母版、方向补图、动作补图都要与本次 provider 捕获的原始 PNG 字节哈希对应。原生完成事件按实际次数计数：角色最多 4 次、场景最多 2 次。模型的调用列表仅作说明，不能证明调用发生。视觉审查前宿主冻结素材、母版、pack 与确定性报告哈希；审查结束或抛错后均检查，发现越权修改就拒绝。视觉审查也不能另行生图。

`asset-results/<id>.json` 与 `asset-jobs/<id>/attempt-*` 保留源母版、转换、冻结技能版本、实际 Python 命令/退出码/完整 QA、视觉报告和失败记录。脚本使用 `python -B` 不污染发行技能。严格相位、透明度、几何、身体通路或模型视觉任一未通过，返回 `AssetProductionError`，包含 failures 与 partial；独立任务仍继续，失败资产不进入已通过 manifest。不会修改阈值、删掉动作帧或拿灰盒代替。取消或任一脚本超时也不会被算作通过。

## 续跑与局部修改

已通过记录在 workspace 的 manifest/partial 中列出，同时在外部 `hostEvidenceDir` 保存宿主 receipt。续跑同时核验外部原记录、输入指纹、最终素材哈希；输入指纹包含任务、相关游戏配置、美术规格、共同参考图片内容与冻结技能树哈希。只改参考图或美术规格也会使缓存失效。仅模型可写的缓存不可信。旧 job 的自报生成记录不能满足新任务来源要求。丢失外部 receipt 时不会悄悄接受旧结果，需要重做相应素材；因此备份项目时应一起备份数据根的 asset-evidence。

服装修改按 change.assetIds 或 targetIds 仅选中对应角色；即使模型给出整个素材清单，也不会重画无关场景。纯对白修改无需进入素材生产。场景缓存只回填几何和图像绑定，不覆盖本轮新对白、奖励、交互条件和出口条件。场景布局变化和正式图像通过后仍必须重新编译、真实键盘与触屏验证，图片通过不代表游戏通关。

语义视觉报告是模型证据，不能称作真实玩家偏好或证明图像美感。确定性通过也不替代最终游戏截图与浏览器验证。宿主最终PNG存在之前必须满足两类检查。运行记录可以证明模型被调用；测试中的runModel stub仅验证宿主边界，不是生产证据。

基础声音使用项目原创WAV（ambient/tap/notice/success），记录来源哈希并检查PCM不是数字静音。其它声音须提供本地WAV；没有音频生成器时不偷偷拿灰盒静音当成正式音频。浏览器还要真正加载与解码。

## 检查与返修边界

`workflow.ts` 管失败归属和资源级持久预算；`candidate-checkpoint.ts` 管已验证原生来源的检查点；`index.ts` 只串联这些能力和各类素材处理。素材层不依赖游戏剧情或通用工具调度器。

失败返回 `owner/code/nextAction/resumeCandidate?`。有候选时先修几何、处理参数或审阅范围，在任务上设置 `resumeCandidate` 后重验：不调用生图，仍检查原生文件哈希和必要QA。背景可用 `sceneContent.baked/runtime/state` 区分烘焙与运行时元素。完整流程见 [制作合同](../../docs/PRODUCTION-CONTRACT.md#素材返修与检查职责)。
