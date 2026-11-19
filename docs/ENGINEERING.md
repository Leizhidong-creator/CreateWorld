# CreateWorldAgent

> 本仓库当前用于纯前端演示。项目新建、修改、删除和版本记录保存在各自浏览器中，不调用真实后端或 Codex。部署只需构建并托管静态文件，不要运行下文工作台后端启动命令。参见 [纯前端演示部署](docs/FRONTEND-DEMO.md)。

将小说、剧本、字幕或结构化故事档案改编为可独立运行的 **2D 像素剧情游戏**的本地工作台。用户提交故事与要求，后台 Codex 负责改编、玩法设计、素材制作、实现和测试；用户可以查看制作记录、试玩候选、提出修改、切换版本并导出静态 HTML5 游戏。

当前工作台版本为 **0.2.0，可运行开发版**。本说明按 **2026-10-31 当前源码**整理，已包含 YAML 场景切片、17 个项目技能、新版统一美术入口和内容边界审核。现有发布 ZIP 是历史快照，不包含此后全部改动。工程测试通过不代表任意故事都能稳定生成正式成品，实际验证范围见下文。

## 可以做什么

- **从故事开始**：输入作品名并检索来源，或导入 UTF-8 文本、Markdown、SRT 字幕和 YAML 内容档案，也可直接粘贴材料。当前新建项目界面的文件入口支持 `.txt`、`.md`、`.srt`；结构化 YAML 可通过工作台 API 或内容切片脚本导入，不直接理解完整影片文件。
- **完整游戏制作**：默认目标约 10 分钟、至少 5 个有效场景，包含剧情驱动的操作、跨场景条件和简单机制。时长是设计目标，不能用自动速通时间保证。
- **单场景切片**：从规范 YAML 中指定场景 ID，制作具有入口、事件窗口和边界结局的独立场景，不套用完整游戏的五场景要求。
- **正式素材制作**：按确定的场景、角色、动作和道具清单生成像素资产，保留母版、来源记录及检查结果，并在游戏中核对组合效果。
- **持续修改**：自然语言提出对白、服装、场景或玩法修改，保留无关内容和旧可用版本；中断或失败时保留候选、产物与诊断，支持继续制作。
- **试玩与导出**：在工作台查看版本和证据，导出可通过 HTTP 服务独立运行的静态游戏。导出后的游戏不需要 Codex 或工作台进程。

工作台包含首页、案例、游戏世界与本机项目列表。《尘埃之外》复用同仓库游戏的引擎、故事和素材；部分其他案例是探索原型或概念展示，不能据此视为已完成正式 AI 生成验收。

## 快速启动

### 环境要求

| 依赖 | 用途 |
| --- | --- |
| Node.js 24+ 与 npm | 本地 API、SQLite、前端构建与任务执行 |
| 已登录的 Codex CLI | 后台内容制作、宿主工具调用和原生图片生成；需要网络及可用额度 |
| Python 3 | 素材处理、技能脚本与游戏导出 |
| Python 素材依赖 | 按所用技能的 `requirements.txt` 安装，主要为 Pillow、PyYAML、jsonschema |
| Chrome / Chromium / Edge | 默认的真实浏览器操作验收；自定义路径见环境变量 |

仅浏览已有页面、试玩已有构建，不需要启动新的模型制作任务。正式制作需要当前 Codex 环境具备相应能力；工作台不要求另填 API key，也不自动切换到额外付费图片服务。

在仓库根目录运行：

```sh
cd create-world-workbench
npm ci
npm run build
npm start
```

打开 [本地工作台](http://127.0.0.1:8787)，保持终端运行。游戏预览默认使用独立端口 `8790`。macOS 也可双击 `create-world-workbench/start.command`，脚本会检查依赖并构建前端。

素材脚本依赖可在所用 Python 环境中安装，例如从工作台目录执行：

```sh
python -m pip install -r ../.agents/skills/character-generation/requirements.txt -r ../.agents/skills/scene-generation/requirements.txt -r ../.agents/skills/art-direction/requirements.txt
```

这里的 `python` 应指向 Python 3；如果系统使用 `python3`，请相应替换。通过 `CREATE_WORLD_PYTHON` 指定同一解释器，可避免安装依赖与执行脚本使用不同环境。

前端体验账号为 `creator` / `createworld`，也可在本浏览器注册。注册信息、密码校验值和登录状态保存在 localStorage；这只是前端体验认证，尚未实现服务端账号、用户项目隔离或云存档。页面使用说明见 [工作台 README](create-world-workbench/README.md)。

### 常用配置

| 环境变量 | 含义 |
| --- | --- |
| `CW_DATA_DIR` | 数据目录，默认 `create-world-workbench/data/` |
| `CW_PORT` / `CW_PREVIEW_PORT` | 管理 / 游戏预览端口，默认 `8787` / `8790` |
| `CODEX_BINARY` | Codex 可执行文件，默认使用 PATH 中的 `codex` |
| `CREATE_WORLD_PYTHON` | 具备素材脚本依赖的 Python 解释器 |
| `CW_BROWSER` | 验收引擎：`chromium`（默认）、`firefox`、`webkit` |
| `CW_BROWSER_PATH` | 当前验收引擎的可执行文件路径；Chromium 也兼容 `CW_CHROME_PATH` |

触屏自动验收使用 Chromium；Firefox/WebKit 的桌面验收不等于触屏支持验证。前后端分离部署另见 [部署说明](create-world-workbench/docs/ZION_DEPLOYMENT.md)：只托管静态前端不能提供后台制作、版本管理与导出服务。

## 制作与验收方式

用户一次提交制作要求，Codex 自主安排工作、按需读取技能并调用宿主工具，没有固定的逐阶段人工审批流程。主要职责如下；这张表不是强制执行顺序。

| 环节 | 负责的内容 |
| --- | --- |
| 内容理解与改编 | 核对人物动机、关键因果、原作结局及来源，确定玩家身份和改编范围 |
| 玩法与流程设计 | 将故事转为操作、状态变化、场景依赖、对白和必要的自定义机制 |
| 素材生产 `cw_assets` | 生成选定资产，执行现有素材工艺、确定性检查和实际审图 |
| 检查与实测 `cw_check` / `cw_build_test` | 检查内容契约，构建游戏，通过真实输入验证推进、失败、取消、存档恢复等行为 |
| 游戏审阅 `cw_review` | 阅读实际内容和实现，查看运行证据，审查机制、原作、美术一致性及内容边界 |
| 提交 `cw_finish` | 核对当前候选对应的正式构建、实测、审阅与资源记录后接受版本 |

灰盒可以先验证玩法，但不能替代正式素材和同屏美术验收。模型工作记录、确定性检查、真实浏览器操作、视觉判断和真人体验分别记录；一种证据不能替代另一种。未通过的候选不替换当前已接受版本。

核心事实缺失或需求发生实质冲突时说明具体缺口，普通设计取舍自行完成。正式合同见 [PRODUCTION-CONTRACT.md](create-world-workbench/docs/PRODUCTION-CONTRACT.md)。

## YAML 内容档案与单场景切片

[内容规范](create-world-workbench/content-spec/2D-pixel-story-content-spec.md) 用稳定 ID 描述场景、事件、角色、状态、玩法和来源。完整 YAML 是权威事实源，切片是宿主生成的受限视图。

在新建项目中导入 YAML、选择“单场景切片”并填写场景 ID。宿主在创建制作任务前生成 `sources/scene-slice.yaml`、`sources/scene-slice.md` 和 `slice.json`；Codex 优先阅读切片，仅在缺少必要事实时通过 `cw_content_query` 按 ID 查询完整档案。

也可在工作台目录离线生成切片：

```sh
npm run content:slice -- content-spec/high-wall-beyond.game.yaml S_LIVING
```

切片验收要求单场景、真实输入、存档恢复和指定边界结局；没有声明机制时不强行加入小游戏。切片完成不代表完整游戏通关。当前尚未实现多切片装配、运行时节点到 YAML 事件的完整追溯校验，以及只重算受影响场景的语义增量机制。详见 [SCENE-SLICE.md](create-world-workbench/docs/SCENE-SLICE.md)。

## 项目技能与统一美术

项目技能编辑源为 `.agents/skills/`，共 **17 个入口**；`create-world-workbench/skills/` 是工作台运行副本。使用范围与编辑规则以 [AGENTS.md](AGENTS.md) 为准，全局同名技能不是本项目的编辑源。

| 类别 | 技能 |
| --- | --- |
| 内容与改编 | `content-understanding`、`game-adaptation` |
| 玩法、状态与推进 | `gameplay-design`、`game-state`、`main-flow`、`interaction-generation` |
| 叙事与可选内容 | `narrative-npc-dialogue`、`narrative-branch`、`easter-egg` |
| 美术生产 | `visual-asset-production`、`art-direction`、`scene-generation`、`character-generation`、`prop-generation` |
| 接入、验收与源码复用 | `game-assembly`、`game-reviewer`、`world-kit` |

剧情、玩法和详细资产清单先由上游设计确定；美术统一从 `visual-asset-production` 进入，再按需路由到各制作模块。美术模块不自行增删剧情资产或改写玩法。

正式画面采用星露谷式简洁 2D 像素语言、固定正交斜俯视，游戏视窗保持 16∶9。角色、场景和道具共用一份美术规格及视觉参考；体型和物件比例依据剧本规划，不强制统一人物占屏比或导出尺寸。交付前实际查看角色、背景与物件同屏效果，检查像素颗粒、视角、比例、色板、光照和细节密度。详见 [画法与尺度规范](.agents/skills/art-direction/references/stardew-pixel-profile.md) 和 [合成验收接口](.agents/skills/art-direction/references/visual-standard.md)。

修改项目技能后，在工作台目录执行：

```sh
npm run skills:sync
```

该命令同步发行副本与清单。需要移动、触屏摇杆、地图或情境交互键时，优先读取 `world-kit` 并复用固定源码库。

## 素材与内容审核

**允许正常剧情冲突、武打、轻微伤势、少量血迹和正常恋爱；禁止色情及过度血腥、残酷呈现。** 依据实际画面、文本、连续动作和互动语境判断，不能仅凭武器、关键词、服装、露肤或无依据联想拦截。

审核复用已有需求阅读、素材审图与 `cw_review`，不增加独立审核轮次、模型调用或逐资产人工审批。普通通过项简记实际查看范围；具体问题和必要证据缺口使用已有 `issues`、`unverified` 等记录。未查看不等于违规，也不能推定通过。

发现问题仅处理相关内容；改变关键剧情、结局或明确玩法时返回上游决策，不擅自删除冲突和战斗。内容结论与美术一致性、操作实测分开，不改变原有验收机制。完整尺度、审查方法与校准案例见 [共用内容边界规则](.agents/skills/visual-asset-production/references/content-boundaries.md)。

## 仓库结构

| 路径 | 职责 |
| --- | --- |
| `create-world-workbench/apps/` | React 前端、本地 API、SSE 与独立来源的游戏预览 |
| `create-world-workbench/packages/content-model/` | YAML 解析、实体引用、索引与场景切片 |
| `create-world-workbench/packages/orchestrator/` | 制作任务、持久会话、候选记录、恢复与版本接受 |
| `create-world-workbench/packages/codex-adapter/` | Codex App Server 接入、动态工具与原生图片落盘 |
| `create-world-workbench/packages/assets/` | 资产生产、处理、现有 QA、审图与复用 |
| `create-world-workbench/packages/runtime/`、`compiler/`、`browser-runner/` | 游戏运行、静态编译和真实操作验收 |
| `create-world-workbench/packages/contracts/`、`shared/`、`skill-adapters/`、`source-library/` | 领域契约、宿主工具、共用校验和可复用源码 |
| `.agents/skills/`、`create-world-workbench/skills/` | 技能编辑源、运行副本及清单 |
| `create-world-workbench/content-spec/`、`fixtures/`、`tests/`、`docs/` | 内容规范、配置示例、测试和工程文档 |
| `interstellar-dust/` | 《尘埃之外》游戏，以及工作台直接引用的引擎、故事和素材 |
| `docs/` | 历史项目现状报告与发布浏览器验证记录 |
| `outputs/`、`deploy/`、`releases/` | 本地制作/验证产物、部署包与历史发布包，不作为当前源码能力的唯一依据 |
| `scripts/pack-release.py`、`release-info.json`、`MANIFEST.sha256` | 整体打包脚本、发布元数据与快照文件校验清单 |

工作台构建会引用同级 `interstellar-dust/`；请保留仓库目录结构，不要单独复制工作台目录。旧版 `pixel-story-kit/` 已从工作区移除，其来源与许可记录保留在 `interstellar-dust/provenance/` 和 `interstellar-dust/LICENSE-NOTICE.txt`。模块边界另见 [ARCHITECTURE.md](create-world-workbench/docs/ARCHITECTURE.md)，运行时配置见 [CONFIG.md](create-world-workbench/packages/compiler/CONFIG.md)。

## 数据、版本与独立运行

默认 `create-world-workbench/data/` 保存 SQLite 数据库、故事材料、制作工作区、生成母版、资源、构建与证据；自定义目录以 `CW_DATA_DIR` 为准。备份时完整保留该目录，旧数据中的 `.evidence-key` 也一并保留。前端体验账号和登录状态在浏览器存储中，不包含在这份项目备份里。

源材料作为数据读取，不作为技能或执行指令。后台模型写入本次候选工作区，宿主持有构建与验收证据；预览与管理 API 使用不同本地来源。版本回退和接受会核对对应记录，不把被手动修改的文件直接视为已验收版本。

导出的静态游戏解压后，可在其目录启动 HTTP 服务：

```sh
python -m http.server 8000
```

然后打开 [本地游戏](http://127.0.0.1:8000)。项目材料、数据库和登录资料需要单独管理，不包含在公开源码发布包里。

《尘埃之外》也可独立启动：在 `interstellar-dust/` 运行 `npm start`，按终端提示访问。

## 开发与验证

以下命令在 `create-world-workbench/` 执行：

| 命令 | 用途 |
| --- | --- |
| `npm run dev:web` | Vite 前端开发服务，默认 `5173`；项目操作需另启 `npm start` |
| `npm run typecheck` | TypeScript 检查 |
| `npm test` | 本地程序测试 |
| `npm run build` | 构建前端至 `dist/web/` |
| `npm run check` | 类型检查、程序测试和前端构建 |
| `npm run test:browser` | 五场景技术夹具的真实浏览器与独立导出回归 |
| `npm run test:browser -- --touch` | Chromium 触屏输入回归 |
| `npm run test:frontend` | 对运行中的本地服务执行界面回归；管理 API 使用测试拦截 |
| `npm run test:codex` | 真实 Codex 动态工具与线程恢复验证，会使用当前账号额度 |

验证记录需要按日期和范围阅读：

- **2026-10-31 内容审核接入**：类型检查、5 个修改技能的格式校验、39 项相关测试通过；最后同步后技能清单测试再次通过。未因此重新执行完整生图、整部故事制作或模型误判率验证。
- **2026-10-30 发布快照**：`release-info.json` 记录工作台 112 项测试、类型检查和构建通过；《尘埃之外》49 项通过，旧 Pixel Story Kit 的 36 项为历史记录（旧目录已于 2026-10-31 移除）。这些是历史结果，不代表当前工作区重新完成了同样的全量检查。
- 更早的真实 Codex、五场景、触屏、导出与灰盒生成记录见 [ACCEPTANCE.md](create-world-workbench/docs/ACCEPTANCE.md)；发布界面验证见 [浏览器记录](docs/release-frontend-verification-20261030.json)。

仍需以实际生产验证的内容包括：完整正式美术样本的端到端交付、更换故事后的生成成功率、特殊动作质量、真人游玩时长和移动设备真机表现。技术夹具、灰盒通关和浏览器触控模拟不能替代这些结论。

## 历史发布与重新打包

历史完整包：[CreateWorldAgent-v0.2.0-20261030.zip](releases/CreateWorldAgent-v0.2.0-20261030.zip)，校验值见 [SHA256SUMS](releases/SHA256SUMS)。该包对应 2026-10-30 快照；本次 README、技能及审核流程修改未重新打包，也未更新历史发布元数据和校验清单。

重新发布前，先同步技能、完成所需检查，并将 `release-info.json` 的版本、日期、归档文件名和验证范围更新为实际结果。然后在仓库根目录执行：

```sh
cd create-world-workbench
npm ci
npm run skills:sync
npm run check
cd ..
python scripts/pack-release.py
```

根目录脚本打包当前工作区的发布文件，生成 `MANIFEST.sha256`、ZIP 和 `releases/SHA256SUMS`。默认排除 `node_modules`、运行数据、环境文件和缓存；依赖由首次 `npm ci` 安装。输出文件名取自发布元数据，发布新版本时应使用新的文件名。工作台内旧的同名打包脚本不是完整仓库的发布入口。

## 文档与来源

- [工作台使用与配置](create-world-workbench/README.md)
- [制作合同](create-world-workbench/docs/PRODUCTION-CONTRACT.md) · [架构](create-world-workbench/docs/ARCHITECTURE.md) · [验收记录](create-world-workbench/docs/ACCEPTANCE.md)
- [内容规范](create-world-workbench/content-spec/2D-pixel-story-content-spec.md) · [场景切片](create-world-workbench/docs/SCENE-SLICE.md)
- [项目技能约定](AGENTS.md) · [内容审核边界](.agents/skills/visual-asset-production/references/content-boundaries.md)
- [前后端部署说明](create-world-workbench/docs/ZION_DEPLOYMENT.md)

本项目及继承内容保留原有 `UNLICENSED` 和各自来源声明，没有新增统一开源授权。源码、素材及历史工具包的来源见各组件 `provenance/` 和随附许可说明。
