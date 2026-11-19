# Create World 本地游戏工作台

在本机浏览器中管理项目，让后台 Codex 将故事材料改编为可独立运行的 2D 像素剧情游戏。用户可查看来源、制作进度、正式素材、真实操作证据，提出局部修改，回退版本并导出游戏。

## 启动

1. 安装 Node.js 24 或更高版本、已登录的 Codex CLI，以及 Google Chrome（或设置 `CW_CHROME_PATH` 指向 Chromium）。
2. 双击 `start.command`。首次缺少依赖时会运行 `npm ci`，需要联网；之后工作台界面和已生成游戏可以在本地运行。
3. 打开 `http://127.0.0.1:8787`。后台制作需要当前 Codex 登录态、网络和可用额度；不会要求另填 API key，也不会自动切换到额外付费服务。

也可在目录内运行：

```sh
npm ci
npm run build
npm start
```

保持启动终端运行。退出会停止当前任务，已完成产物和诊断保留；重启后点击“继续制作”。Node 的 SQLite experimental 提示不表示启动失败。

## 前端入口

- 首页 `/#/`：夜色海岸视觉、案例入口与故事到游戏的介绍。
- 案例 `/#/explore`：无需连接后台即可试玩现有《雾港来信》《轨道余声》探索原型。封面为概念美术，游戏仍使用原型素材；《山风归途》仅展示概念，《高墙之外》使用原作截图展示，原版试玩尚未接入。
- 登录 `/#/login`：本轮为前端体验，支持体验账号 `creator` / `createworld`；注册需用户名、邮箱或手机号、密码与确认密码。可用用户名或联系方式重新登录；注册信息、加盐密码校验值和登录状态保存在本浏览器 localStorage，兼容旧 sessionStorage 数据迁移，不保存明文密码。关闭标签页后仍可保持登录，退出登录会同步其他标签页。没有邮件/短信验证、服务端账号、云存档或项目隔离。
- 游戏世界 `/#/games`：登录后浏览四个示例与本机游戏；支持分类、搜索。《尘埃之外》直接复用同工作区的 `../interstellar-dust` 引擎和故事，打包后的页面无需额外启动该游戏。项目中存在可运行构建的当前/通过验收/候选版本会自动列出，候选状态明确标注。
- 我的项目 `/#/projects`：读取本地工作台项目；创建、制作、修改和版本操作继续使用现有 API。
- 工作区 `/#/studio/项目ID`：试玩与修改并排展示，制作任务、素材与版本仍可访问。旧 `?project=项目ID` 链接保持可用。

未登录时仅可浏览首页与登录/注册页；案例、项目及工作区（包括直接链接和旧项目链接）均转到登录，完成表单后返回原目标页面。该限制仅是前端流程，不构成服务端账号认证或 API 访问控制。

仅开发前端可运行 `npm run dev:web`（5173）。首页与演示页独立可用；
项目操作需另运行 `npm start`（8787）。完整本地使用仍是 `npm run build` 后 `npm start`。
`npm run test:frontend` 针对运行中的 8787 服务验证页面与原型试玩；管理 API 在测试中被拦截，不会启动真实制作任务。
插图提示词、资源来源和原型边界见 `provenance/frontend-worlds.md`。

## 制作与修改

- **文字材料**：导入 UTF-8 `.txt`、`.md`、`.srt`、`.vtt`，或粘贴正文。电影可输入剧本、字幕或整理后的情节材料；本版不直接理解完整影片文件。
- **作品名称**：后台检索来源并识别原作版本。来源不足可补写互动或过渡，但核心动机、关键因果和原结局无法核实时会显示阻塞原因，等待补充材料。
- 默认制作 **约 10 分钟、至少 5 个有效场景**的剧情探索游戏；固定视角与角色比例，题材决定服装、建筑和色彩。实际时长需结合阅读和操作评估，不能只根据节点数量保证。
- 一次提交整部游戏，由 Codex 自主规划、按需调用技能、根据剧情设计核心玩法并测试修复；不固定阶段顺序，不逐阶段确认。运行失败保留候选，不把未通过的结果替换为当前可玩版本。
- 在“修改”中写自然语言要求。对白措辞复用美术；服装只重做相关角色；门的位置需要重新检查对应场景及路线。
- “版本”里可回到已验收版本。回退会核对构建、素材和证据；被手动修改的版本不能直接当作已验收版本。
- ZIP 导出是静态 HTML5 工程。解压后运行 `python3 -m http.server 8000`，无需 Codex 或工作台进程。

## 场景切片（YAML）

导入按 [内容规范](content-spec/2D-pixel-story-content-spec.md) 编写的 YAML 时，可选择“单场景切片”并填写场景 ID。工作台会在创建任务前生成 `sources/scene-slice.yaml`、`sources/scene-slice.md` 和 `slice.json`，只把该场景的事件窗口交给 Codex；验收也改为“单场景 + 边界结局 + 真实输入”，不再要求五场景或小游戏。完整 YAML 仍是权威档案，切片缺失时通过 `cw_content_query` 按 ID 查询。合同见 [docs/SCENE-SLICE.md](docs/SCENE-SLICE.md)，离线生成用 `npm run content:slice -- <yaml> <sceneId>`。

切片完成页不是完整游戏结局；当前没有多切片合并，也没有“改动后只重算受影响场景”的增量机制，内容变化后需重新生成切片。

## 数据与接入

默认 `data/` 保存 SQLite 数据库、项目材料、候选、生成母版、资产包、构建与证据。此目录包含你的材料，不应提交到公共仓库。只需完整备份 `data/` 即可保留项目与版本；旧版本的 `.evidence-key` 也一起保留以便兼容；新版本使用构建和验收记录绑定。

- `CW_DATA_DIR`：数据目录，默认当前工程的 `data/`。
- `CW_PORT` / `CW_PREVIEW_PORT`：管理端口 / 独立来源的游戏预览端口，默认 8787 / 8790。
- `CODEX_BINARY`：Codex 可执行文件；默认使用 PATH 中的 `codex`。
- `CW_BROWSER`：自动验收浏览器引擎，可选 `chromium`（默认）、`firefox` 或 `webkit`。
- `CW_BROWSER_PATH`：当前浏览器引擎的可执行文件路径；Chromium 也兼容 `CW_CHROME_PATH`，Firefox/WebKit 可分别使用 `CW_FIREFOX_PATH`、`CW_WEBKIT_PATH`。
- 触屏自动验收使用 Chromium 的触屏协议；Firefox/WebKit 可用于桌面键鼠验收，不能据此宣称完成真机触屏兼容性认证。
- `CREATE_WORLD_PYTHON`：具备素材脚本依赖的 Python。新版美术工具需要 Pillow、PyYAML、jsonschema，依赖范围见相应技能的 `requirements.txt`。自动检查本机 Codex 依赖运行时，找不到时使用 `python3`。本次整合的隔离验证环境位于 `../outputs/skill-validation-env/Scripts/python.exe`；可显式用于本机工具，不作为发行包依赖。

项目材料导入是文本文件，不会当作 AGENTS 或技能指令执行。Codex 子任务仅可写本次工作区；工作台拥有构建和可信验收目录。预览使用另一个本地来源，与管理 API 隔离。

## 开发与验证

```sh
npm run typecheck
npm test
npm run build
```

单元测试覆盖事务、条件、几何、存档、插件、资产工具和编译完整性。真实浏览器证据与模型视觉审阅分别记录；单元测试、模型自报和真人游玩属于不同证据，不能互相替代。开发期完整验收记录见 `docs/ACCEPTANCE.md`（以实际运行结果为准）。

- `apps/web`：React 工作台，资源状态由 `workspace/useWorkspace` 管理；`apps/server`：本地 API、SSE 与预览，路由只做传输适配，项目/版本查询与导出在 `services/`。
- `packages/contracts`：纯领域记录与 API DTO；`packages/shared`：宿主文件、哈希和路径安全工具。
- `packages/runtime`：从原游戏和旧 kit 迁移的运行时，场景转场统一为 `scene-transition.js` 事务；`packages/compiler`：静态编译与有界状态分析。
- `packages/orchestrator`：SQLite 任务、恢复、版本、修改与接受规则；`workspace-layout` 集中声明工作区文件，`tool-runtime`/`candidate-records`/`production-policy` 拆分工具执行、候选记录与生产阈值。
- `packages/codex-adapter`：App Server JSON-RPC、原生图片落盘与中断。
- `packages/assets`：原角色/场景技能工艺、宿主重跑检查、视觉审阅与复用。
- `packages/browser-runner`：真实键盘、点击、路径导航与独立证据。
- `packages/skill-adapters`、`skills`：共用校验与 15 个按需技能；其中 `world-kit` 提供固定的摇杆、地图和交互键源码库；旧阶段提示词仅作历史兼容。
- `fixtures`：两个配置示例和验收材料；`provenance`：源码来源及改造记录。

本项目继承的源码、素材和技能保留各自来源。原上传 ZIP 未提供统一开源许可，不能把它们重新宣称为另一种开源许可；对外分发前应按来源记录核对权利。

## v2 改造与验证

本版是可运行开发版，尚不宣称任意故事能够稳定生成正式成品。完整样本目前的素材服务与质量限制，以及已通过的工程证据，均记录在 docs/ACCEPTANCE.md。

改造对照见 docs/REDESIGN.md；详细结构见 docs/ARCHITECTURE.md；完整制作合同见 docs/PRODUCTION-CONTRACT.md。项目技能编辑 ../.agents/skills 后执行 npm run skills:sync。改造前快照位于上层 output/redesign-v2/before-redesign.zip。

`npm run test:browser` 实际运行五场景技术回归，并通过真实导出脚本打包、解压再通关。它是人工编写的技术夹具，不冒充AI生成游戏。`npm run test:codex` 会使用当前Codex额度，实际验证动态工具与同一线程恢复。

新版人物工艺支持直接四向图集与独立动作包，保留旧母版兼容方式。基础动画的数值检查不能代替动作语义和身份读图验证；特殊动作按需实现，不承诺所有动作通用。

## 文本流程后台与最终 YAML 确认

新增 `/api/text` 后台：创意补全/原作处理 → 完整粗剧本 → 用户启动 YAML → 自审 → 用户明确确认最终版本 → 自动启动现有整部游戏制作。粗剧本阶段仍可编辑和采纳候选，游戏后续使用自然语言修改，不默认重走 YAML。新链路按已确认 YAML 的实际规模制作，旧入口规则保持不变。

本轮没有接入工作台页面或小人气泡。接口与前端接入说明见 [TEXT-GAME-HANDOFF.md](docs/TEXT-GAME-HANDOFF.md)，文本接口见 [TEXT-WORKFLOW-API.md](docs/TEXT-WORKFLOW-API.md)。Windows 可从仓库根目录运行 `start-local.ps1`，选择本机原生 Codex 可执行文件与 Python，环境变量只在当前进程中生效。

文本任务目前从 `../workflows/story-adaptation/sources.lock.json` 指定的本机路径读取两份权威规范，并核对 SHA256。仅克隆仓库不会自动取得这些外部文件；在其他机器启用文本任务前，需配置可读取的规范路径并保留对应版本校验。
